/**
 * 房间管理器 —— 与具体游戏、与传输（ws）都解耦，便于单测。
 *
 * 连接（conn）只需提供 `send(obj)`；管理器在 CREATE/JOIN 后给 conn 绑定
 * roomCode / playerId。房间状态由对应游戏适配器的纯函数引擎权威维护，
 * 每次意图处理完后把全量状态广播给房内所有连接。
 */
import { C2S, S2C } from './protocol.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

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
      send(conn, S2C.STATE, { room: room.state });
    }
  }

  function uniqueRoomCode() {
    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));
    return code;
  }

  function handleCreate(conn, msg) {
    const { gameId, playerId, playerName } = msg;
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
    const room = { gameId, adapter, state, conns: new Map() };
    rooms.set(roomCode, room);

    bind(conn, roomCode, playerId);
    room.conns.set(playerId, conn);
    log.info('room created', { roomCode, gameId, playerId });
    send(conn, S2C.JOINED, { playerId, roomCode, room: state });
  }

  function handleJoin(conn, msg) {
    const { roomCode, playerId, playerName } = msg;
    const room = rooms.get(roomCode);
    if (!room) {
      send(conn, S2C.ERROR, { message: '房间不存在或已关闭', fatal: true });
      return;
    }
    if (!playerId || !playerName) {
      send(conn, S2C.ERROR, { message: '缺少 playerId 或 playerName', fatal: true });
      return;
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
    // 加入者已在 JOINED 里拿到全量 room，只需把新状态广播给其他人
    send(conn, S2C.JOINED, { playerId, roomCode, room: room.state });
    broadcast(room, conn);
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
    let result;
    try {
      result = room.adapter.applyIntent(room.state, { action, playerId: conn.playerId, payload });
    } catch (err) {
      log.error('applyIntent threw', { action, error: err?.message });
      send(conn, S2C.ERROR, { message: '操作处理失败' });
      return;
    }
    if (result?.error) {
      send(conn, S2C.ERROR, { message: result.error });
      return;
    }
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
      default:
        send(conn, S2C.ERROR, { message: `未知消息类型：${msg.type}` });
    }
  }

  function handleDisconnect(conn) {
    detach(conn, { explicit: false });
  }

  /** 由定时器周期性调用：推进各房间的权威计时，仅在 phase 变化时广播。 */
  function tickAll() {
    const t = now();
    for (const room of rooms.values()) {
      if (typeof room.adapter.tick !== 'function') continue;
      const prevPhase = room.state.phase;
      try {
        room.adapter.tick(room.state, t);
      } catch (err) {
        log.error('tick threw', { gameId: room.gameId, error: err?.message });
        continue;
      }
      if (room.state.phase !== prevPhase) {
        broadcast(room);
      }
    }
  }

  return { handleMessage, handleDisconnect, tickAll, rooms };
}
