/**
 * 房间管理器 —— 与具体游戏、与传输（ws）都解耦，便于单测。
 *
 * 连接（conn）只需提供 `send(obj)`；管理器在 CREATE/JOIN 后给 conn 绑定
 * roomCode / playerId。房间状态由对应游戏适配器的纯函数引擎权威维护，
 * 每次意图处理完后把全量状态广播给房内所有连接。
 */
import { C2S, S2C } from './protocol.js';
import { validateAgentIntent } from './agentProtocol.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

// Agent 会话存活策略：HTTP 轮询会持续刷新 lastSeen；停止轮询超过 TTL 视为离线。
const AGENT_SESSION_TTL_MS = 90_000;
const AGENT_SESSION_MAX_IDLE_MS = 24 * 60 * 60_000;
// 单房间同时有效的 Agent 邀请上限：房主反复签发时淘汰最早的，避免无界增长
const AGENT_INVITES_MAX = 20;

export function createRoomManager({
  getGameAdapter,
  generateRoomCode,
  now = () => Date.now(),
  log = noopLogger
}) {
  /** @type {Map<string, { gameId, adapter, state, conns: Map<string, object> }>} */
  const rooms = new Map();

  function send(conn, type, payload) {
    try {
      conn.send({ type, ...payload });
    } catch (err) {
      log.warn('send failed', { error: err?.message });
    }
  }

  function broadcast(room, exceptConn = null) {
    for (const conn of room.conns.values()) {
      if (conn === exceptConn) continue;
      send(conn, S2C.STATE, { room: room.adapter.project(room.state, conn.playerId) });
    }
  }

  function uniqueRoomCode() {
    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));
    return code;
  }

  function handleCreate(conn, msg) {
    const { gameId, playerId, playerName } = msg;
    if (typeof playerId !== 'string' || typeof playerName !== 'string' || !playerId || !playerName.trim() || playerId.length > 100 || playerName.length > 30) {
      send(conn, S2C.ERROR, { message: '玩家身份格式不正确', fatal: true });
      return;
    }
    if (playerId.startsWith('agent_')) {
      send(conn, S2C.ERROR, { message: 'Agent 身份需通过邀请接口获取', fatal: true });
      return;
    }
    if (conn.roomCode || conn.playerId) {
      send(conn, S2C.ERROR, { message: '连接已加入房间，请先离开', fatal: true });
      return;
    }
    const adapter = getGameAdapter(gameId);
    if (!adapter) {
      send(conn, S2C.ERROR, { message: `未知游戏：${gameId}`, fatal: true });
      return;
    }
    if (!playerId || !playerName) {
      send(conn, S2C.ERROR, { message: '缺少 playerId 或 playerName', fatal: true });
      return;
    }
    const roomCode = uniqueRoomCode();
    const state = adapter.createRoom({ hostId: playerId, hostName: playerName, roomCode });
    const room = { gameId, adapter, state, conns: new Map(), humanSessions: new Map(), agentInvites: new Map(), agentSessions: new Map(), agentRequests: new Map(), revision: 0 };
    rooms.set(roomCode, room);

    bind(conn, roomCode, playerId);
    room.conns.set(playerId, conn);
    log.info('room created', { roomCode, gameId, playerId });
    send(conn, S2C.JOINED, { playerId, roomCode, playerToken: issueHumanSession(room, playerId), room: adapter.project(state, playerId) });
  }

  function handleJoin(conn, msg) {
    const { roomCode, playerId, playerName } = msg;
    if (typeof playerId === 'string' && playerId.startsWith('agent_')) {
      send(conn, S2C.ERROR, { message: '请使用 Agent 凭证重连', fatal: true });
      return;
    }
    if (typeof playerId !== 'string' || typeof playerName !== 'string' || playerId.length > 100 || playerName.length > 30) {
      send(conn, S2C.ERROR, { message: '玩家身份格式不正确', fatal: true });
      return;
    }
    const room = rooms.get(roomCode);
    if (!room) {
      send(conn, S2C.ERROR, { message: '房间不存在或已关闭', fatal: true });
      return;
    }
    if (!playerId || !playerName) {
      send(conn, S2C.ERROR, { message: '缺少 playerId 或 playerName', fatal: true });
      return;
    }

    // 席位凭证：房间已存在该玩家（含断线保留的席位）时，必须持有本人 token。
    // 仅知道 playerId 不再等于拥有席位，避免房内他人顶号接管。
    const hasSeat = room.state.players.some(player => player.id === playerId)
      || (room.state.disconnectedPlayers || []).some(player => player.id === playerId);
    if (hasSeat) {
      const session = room.humanSessions.get(playerId);
      if (!session || !validToken(msg.playerToken, session.hash)) {
        send(conn, S2C.ERROR, { code: 'SESSION_INVALID', message: '席位凭证无效，请以新身份重新加入', fatal: true });
        return;
      }
    }

    // 同 playerId 的旧连接（断线重连场景）：解绑旧连接，避免其断开时误删玩家
    const prev = room.conns.get(playerId);
    if (prev && prev !== conn) {
      prev.roomCode = null;
      prev.playerId = null;
    }

    const result = room.adapter.addPlayer(room.state, { playerId, playerName });
    if (result?.error) {
      send(conn, S2C.ERROR, { message: result.error, fatal: true });
      return;
    }

    bind(conn, roomCode, playerId);
    room.conns.set(playerId, conn);
    log.info('player joined', { roomCode, playerId, reconnected: !!result?.reconnected });
    // 加入者已在 JOINED 里拿到全量 room，只需把新状态广播给其他人；
    // 新席位同时下发只属于本人的重连凭证。
    send(conn, S2C.JOINED, {
      playerId,
      roomCode,
      ...(hasSeat ? {} : { playerToken: issueHumanSession(room, playerId) }),
      room: room.adapter.project(room.state, playerId)
    });
    broadcast(room, conn);
  }

  function touch(room) {
    room.revision += 1;
  }

  function roomFor(conn) {
    return conn.roomCode ? rooms.get(conn.roomCode) : null;
  }

  function agentView(room, playerId) {
    // 读取前推进权威计时，避免定时阶段在两次 tick 之间返回过期状态。
    const prevPhase = room.state.phase;
    let changed = false;
    try {
      changed = room.adapter.tick?.(room.state, now()) || room.state.phase !== prevPhase;
    } catch (err) {
      log.error('agent view tick threw', { gameId: room.gameId, error: err?.message });
    }
    if (changed) touch(room);
    return {
      apiVersion: '1',
      gameId: room.gameId,
      roomCode: room.state.code,
      playerId,
      playerType: 'agent',
      revision: room.revision,
      serverTime: now(),
      room: room.adapter.project(room.state, playerId),
      availableActions: room.adapter.agentActions?.(room.state, playerId) ?? [],
      session: {
        heartbeatIntervalMs: 20_000,
        offlineAfterMs: AGENT_SESSION_TTL_MS,
        expiresAt: room.agentSessions.get(playerId)?.expiresAt || null
      }
    };
  }

  function sendAgentView(room, conn, requestId = null) {
    send(conn, 'AGENT_STATE', { ...agentView(room, conn.playerId), ...(requestId ? { requestId } : {}) });
  }

  function hashToken(token) {
    return createHash('sha256').update(token).digest();
  }

  function validToken(token, expected) {
    if (typeof token !== 'string' || token.length > 200) return false;
    const actual = hashToken(token);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /** 为人类席位签发重连凭证：只保存哈希，明文仅出现在本人的 JOINED 里。 */
  function issueHumanSession(room, playerId) {
    const token = randomBytes(32).toString('base64url');
    room.humanSessions.set(playerId, { hash: hashToken(token) });
    return token;
  }

  function humanName(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 30;
  }

  function handleAgentInvite(conn) {
    const room = roomFor(conn);
    if (!room || room.state.hostId !== conn.playerId) {
      send(conn, S2C.ERROR, { message: '只有房主可以邀请 Agent' });
      return;
    }
    const invite = {
      gameId: room.gameId,
      roomCode: room.state.code,
      hostId: conn.playerId,
      expiresAt: now() + 30 * 60_000,
      uses: 0
    };
    const token = randomBytes(32).toString('base64url');
    room.agentInvites.set(hashToken(token).toString('base64url'), invite);
    if (room.agentInvites.size > AGENT_INVITES_MAX) {
      room.agentInvites.delete(room.agentInvites.keys().next().value);
    }
    send(conn, 'AGENT_INVITE', {
      inviteToken: token,
      roomCode: room.state.code,
      gameId: room.gameId,
      expiresAt: invite.expiresAt
    });
  }

  function handleAgentJoin(conn, msg) {
    const { roomCode, inviteToken, agentToken, playerName, agentName } = msg;
    const room = rooms.get(roomCode);
    if (!room) {
      send(conn, S2C.ERROR, { code: 'ROOM_NOT_FOUND', message: '房间不存在或已关闭', fatal: true });
      return;
    }
    let playerId;
    let name;
    if (agentToken) {
      const session = room.agentSessions.get(playerId = msg.playerId);
      if (!session || !validToken(agentToken, session.hash) || now() > session.expiresAt) {
        send(conn, S2C.ERROR, { code: 'AGENT_AUTH_FAILED', message: 'Agent 会话无效或已过期', fatal: true });
        return;
      }
    } else {
      const key = hashToken(inviteToken || '').toString('base64url');
      const invite = room.agentInvites.get(key);
      if (!invite || now() > invite.expiresAt || invite.uses >= 4) {
        send(conn, S2C.ERROR, { code: 'INVITE_INVALID', message: 'Agent 邀请无效、已过期或达到席位上限', fatal: true });
        return;
      }
      name = humanName(agentName || playerName) ? (agentName || playerName).trim() : 'Cloud Agent';
      playerId = `agent_${randomBytes(12).toString('base64url')}`;
      const result = room.adapter.addPlayer(room.state, { playerId, playerName: name });
      if (result?.error) {
        send(conn, S2C.ERROR, { code: 'JOIN_REJECTED', message: result.error, fatal: true });
        return;
      }
      const me = room.state.players.find(player => player.id === playerId);
      if (me) me.type = 'agent';
      const nextAgentToken = randomBytes(32).toString('base64url');
      room.agentSessions.set(playerId, {
        hash: hashToken(nextAgentToken),
        name,
        expiresAt: now() + AGENT_SESSION_MAX_IDLE_MS,
        lastSeen: now()
      });
      invite.uses += 1;
      conn.agentToken = nextAgentToken;
    }
    const previous = room.conns.get(playerId);
    if (previous && previous !== conn) {
      previous.roomCode = null;
      previous.playerId = null;
      previous.agentToken = null;
    }
    conn.isAgent = true;
    bind(conn, roomCode, playerId);
    room.conns.set(playerId, conn);
    touch(room);
    send(conn, 'AGENT_JOINED', { ...agentView(room, playerId), ...(conn.agentToken ? { agentToken: conn.agentToken } : {}) });
    conn.agentToken = null;
    broadcast(room, conn);
  }

  function executeIntent(room, playerId, action, payload) {
    if (room.adapter.hostOnlyActions?.includes(action) && playerId !== room.state.hostId) {
      return { error: '只有房主可以执行此操作' };
    }
    // 人类与 Agent 走同一套 payload schema：人类路径不再直接把任意 payload 透传给引擎
    const validated = validateAgentIntent(room.gameId, action, payload || {});
    if (validated.error) return validated;
    payload = validated.value;
    try {
      return room.adapter.applyIntent(room.state, { action, playerId, payload, now: now() });
    } catch (err) {
      log.error('applyIntent threw', { action, error: err?.message });
      return { error: '操作处理失败' };
    }
  }

  function handleAgentIntent(conn, msg) {
    const room = roomFor(conn);
    if (!room || !conn.isAgent) {
      send(conn, S2C.ERROR, { message: '请先用 Agent 邀请加入房间' });
      return;
    }
    const requestId = msg.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) {
      send(conn, S2C.ERROR, { code: 'REQUEST_ID_INVALID', message: 'requestId 需要 8–80 位字母、数字、下划线或连字符' });
      return;
    }
    const previous = room.agentRequests.get(requestId);
    if (previous) {
      if (previous.playerId !== conn.playerId) {
        send(conn, S2C.ERROR, { code: 'REQUEST_ID_CONFLICT', message: 'requestId 已被使用' });
        return;
      }
      sendAgentView(room, conn, requestId);
      return;
    }
    const result = executeIntent(room, conn.playerId, msg.action, msg.payload || {});
    if (result?.error || result?.correct === false) {
      room.agentRequests.set(requestId, { playerId: conn.playerId, accepted: false });
      if (room.agentRequests.size > 1000) room.agentRequests.delete(room.agentRequests.keys().next().value);
      touch(room);
      send(conn, 'AGENT_ACTION_RESULT', {
        ...agentView(room, conn.playerId),
        requestId,
        accepted: false,
        reason: result.error || '行动未命中，已按游戏规则记录失误'
      });
      broadcast(room, conn);
      return;
    }
    touch(room);
    room.agentRequests.set(requestId, { playerId: conn.playerId });
    if (room.agentRequests.size > 1000) room.agentRequests.delete(room.agentRequests.keys().next().value);
    sendAgentView(room, conn, requestId);
    broadcast(room, conn);
  }


  /** 让 Agent 玩家重新标记为在线（HTTP 轮询不持有持久连接，靠心跳维持）。 */
  function recallAgent(room, playerId) {
    const player = room.state.players.find(p => p.id === playerId);
    if (!player) return;
    let changed = false;
    if (player.isOnline === false) { player.isOnline = true; changed = true; }
    const queue = room.state.disconnectedPlayers;
    if (Array.isArray(queue)) {
      const index = queue.findIndex(p => p.id === playerId);
      if (index >= 0) { queue.splice(index, 1); changed = true; }
    }
    if (changed) { touch(room); broadcast(room); }
  }

  /** Agent 主动退出：删除会话并按现有规则移除玩家（大厅移除 / 对局中标记离线）。 */
  function releaseAgent(room, playerId, { explicit = true } = {}) {
    room.agentSessions.delete(playerId);
    const conn = room.conns.get(playerId);
    if (conn) {
      conn.roomCode = null;
      conn.playerId = null;
      conn.isAgent = false;
    }
    room.conns.delete(playerId);
    room.adapter.removePlayer(room.state, playerId);
    touch(room);
    log.info('agent released', { roomCode: room.state.code, playerId, explicit });
    if (room.conns.size === 0) {
      rooms.delete(room.state.code);
      log.info('room emptied and removed', { roomCode: room.state.code });
      return;
    }
    broadcast(room);
  }

  /** 回收过期或已用满的 Agent 邀请（由 tickAll 周期调用），避免邀请表只增不减。 */
  function sweepAgentInvites(room, t) {
    if (!room.agentInvites || room.agentInvites.size === 0) return;
    for (const [key, invite] of room.agentInvites) {
      if (t > invite.expiresAt || invite.uses >= 4) room.agentInvites.delete(key);
    }
  }

  /** 清理长时间无心跳的 Agent 会话（由 tickAll 周期调用）。 */
  function sweepAgentSessions(room, t) {
    if (!room.agentSessions || room.agentSessions.size === 0) return false;
    let changed = false;
    for (const [playerId, session] of room.agentSessions) {
      const idle = t - (session.lastSeen || 0);
      if (idle < AGENT_SESSION_TTL_MS) continue;
      room.agentSessions.delete(playerId);
      const conn = room.conns.get(playerId);
      if (conn) { conn.roomCode = null; conn.playerId = null; conn.isAgent = false; }
      room.conns.delete(playerId);
      room.adapter.removePlayer(room.state, playerId);
      log.info('agent session timed out', { roomCode: room.state.code, playerId, idleMs: idle });
      changed = true;
    }
    if (changed) touch(room);
    return changed;
  }

  function handleIntent(conn, msg) {
    const room = conn.roomCode ? rooms.get(conn.roomCode) : null;
    if (!room || !conn.playerId) {
      send(conn, S2C.ERROR, { message: '尚未加入房间' });
      return;
    }
    const { action, payload } = msg;
    if (room.adapter.hostOnlyActions?.includes(action) && conn.playerId !== room.state.hostId) {
      send(conn, S2C.ERROR, { message: '只有房主可以执行此操作' });
      return;
    }
    const result = executeIntent(room, conn.playerId, action, payload);
    if (result?.error) {
      send(conn, S2C.ERROR, { message: result.error });
      return;
    }
    touch(room);
    broadcast(room);
  }

  function handleLeave(conn) {
    detach(conn, { explicit: true });
  }

  function bind(conn, roomCode, playerId) {
    conn.roomCode = roomCode;
    conn.playerId = playerId;
  }

  /** 连接离开（主动 LEAVE 或断线）。explicit=true 时按"主动离开"处理。 */
  function detach(conn, { explicit = false } = {}) {
    const roomCode = conn.roomCode;
    const playerId = conn.playerId;
    if (!roomCode || !playerId) return;
    const room = rooms.get(roomCode);
    conn.roomCode = null;
    conn.playerId = null;
    if (!room) return;

    // 该连接已被同 playerId 的新连接取代（重连）→ 不动玩家状态
    if (room.conns.get(playerId) !== conn) return;

    room.conns.delete(playerId);
    // 主动离开即放弃席位：凭证随之作废，座位不可被回收
    if (explicit) room.humanSessions.delete(playerId);
    room.adapter.removePlayer(room.state, playerId);
    log.info('player left', { roomCode, playerId, explicit });

    if (room.conns.size === 0) {
      // 房内已无任何连接：直接回收（派对游戏房间是临时的）
      rooms.delete(roomCode);
      log.info('room emptied and removed', { roomCode });
      return;
    }
    broadcast(room);
  }

  function handleMessage(conn, msg) {
    if (!msg || typeof msg.type !== 'string') {
      send(conn, S2C.ERROR, { message: '非法消息' });
      return;
    }
    switch (msg.type) {
      case C2S.CREATE: return handleCreate(conn, msg);
      case C2S.JOIN: return handleJoin(conn, msg);
      case C2S.INTENT: return handleIntent(conn, msg);
      case C2S.LEAVE: return handleLeave(conn);
      case 'AGENT_INVITE': return handleAgentInvite(conn, msg);
      case 'AGENT_JOIN': return handleAgentJoin(conn, msg);
      case 'AGENT_STATE': {
        const room = roomFor(conn);
        if (!room || !conn.isAgent) return send(conn, S2C.ERROR, { message: 'Agent 尚未加入房间' });
        return sendAgentView(room, conn);
      }
      case 'AGENT_INTENT': return handleAgentIntent(conn, msg);
      case 'AGENT_LEAVE': {
        const room = roomFor(conn);
        if (!room || !conn.isAgent) return send(conn, S2C.ERROR, { message: 'Agent 尚未加入房间' });
        const playerId = conn.playerId;
        send(conn, 'AGENT_LEFT', { roomCode: room.state.code, playerId });
        releaseAgent(room, playerId, { explicit: true });
        return;
      }
      case 'AGENT_HTTP': {
        const room = rooms.get(msg.roomCode);
        if (!room) return send(conn, S2C.ERROR, { code: 'ROOM_NOT_FOUND', message: '房间不存在', fatal: true });
        const playerId = msg.playerId;
        const session = room.agentSessions.get(playerId);
        if (!session || !validToken(msg.agentToken, session.hash) || now() > session.expiresAt) {
          return send(conn, S2C.ERROR, { code: 'AGENT_AUTH_FAILED', message: 'Agent 会话无效或已过期，请联系真人重新生成邀请', fatal: true });
        }
        // 每次合法请求都算心跳：刷新活跃时间并让玩家回到在线
        session.lastSeen = now();
        recallAgent(room, playerId);
        if (msg.operation === 'leave') {
          send(conn, 'AGENT_LEFT', { roomCode: room.state.code, playerId });
          releaseAgent(room, playerId, { explicit: true });
          return;
        }
        if (msg.operation === 'intent') {
          conn.isAgent = true;
          bind(conn, room.state.code, playerId);
          handleAgentIntent(conn, msg);
          conn.roomCode = null;
          conn.playerId = null;
          return;
        }
        return send(conn, 'AGENT_STATE', agentView(room, playerId));
      }
      default:
        send(conn, S2C.ERROR, { message: `未知消息类型：${msg.type}` });
    }
  }

  function handleDisconnect(conn) {
    detach(conn, { explicit: false });
  }

  /**
   * 由定时器周期性调用：推进各房间的权威计时。
   * 在以下两种情况广播全量状态：
   *   1) phase 发生变化（如倒计时到点、胜负判定）；
   *   2) adapter.tick 返回 truthy（表示本 tick 改了需要下发的状态，如领土生产/移动）。
   * 这样不会 tick 的游戏（bomb-defuse 返回 undefined）只在 phase 变化时广播，
   * 而需要持续下发的游戏（territory-control）可主动要求每个 tick 广播。
   */
  function tickAll() {
    const t = now();
    for (const room of rooms.values()) {
      sweepAgentInvites(room, t);
      const swept = sweepAgentSessions(room, t);
      if (swept) broadcast(room);
      if (typeof room.adapter.tick !== 'function') continue;
      const prevPhase = room.state.phase;
      let changed;
      try {
        changed = room.adapter.tick(room.state, t);
      } catch (err) {
        log.error('tick threw', { gameId: room.gameId, error: err?.message });
        continue;
      }
      if (changed || room.state.phase !== prevPhase) {
        touch(room);
        broadcast(room);
      }
    }
  }

  /** 运行时规模快照，供 /healthz 与 /metrics 使用（只读内存态，不触发任何广播）。 */
  function stats() {
    let connections = 0;
    let players = 0;
    let agentSessions = 0;
    for (const room of rooms.values()) {
      connections += room.conns.size;
      players += room.state.players?.length || 0;
      agentSessions += room.agentSessions?.size || 0;
    }
    return { rooms: rooms.size, connections, players, agentSessions };
  }

  return { handleMessage, handleDisconnect, tickAll, stats, rooms };
}
