import { reactive, watch } from 'vue';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  GAME_PHASES, GUESS_TYPE,
  generatePlayerId, createInitialRoom,
  addPlayerToRoom, removePlayerFromRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess, submitOpponentFinalVote, submitTeamFinalVote,
  checkNeedTeamVoting,
  nextRound, resetGame,
  resumeGame, canResumeGame
} from '../services/gameEngine';
import { saveStateToCache, loadStateFromCache, clearStateCache, hasCachedState, flushStateCache, cancelPendingSave } from '../services/stateCache';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeClues } from '../services/sanitize';
import { showToast } from '../components/ToastNotification.vue';

const log = createLogger('GameStore');

const MSG = {
  ROOM_STATE: 'ROOM_STATE',
  JOIN_REQUEST: 'JOIN_REQUEST',
  JOIN_RESPONSE: 'JOIN_RESPONSE',
  START_GAME: 'START_GAME',
  SUBMIT_CLUES: 'SUBMIT_CLUES',
  SUBMIT_TEAM_GUESS: 'SUBMIT_TEAM_GUESS',
  SUBMIT_OPPONENT_GUESS: 'SUBMIT_OPPONENT_GUESS',
  SUBMIT_OPPONENT_VOTE: 'SUBMIT_OPPONENT_VOTE',
  SUBMIT_TEAM_VOTE: 'SUBMIT_TEAM_VOTE',
  NEXT_ROUND: 'NEXT_ROUND',
  PLAYER_LEFT: 'PLAYER_LEFT',
  PLAYER_RECONNECTED: 'PLAYER_RECONNECTED',
  RESUME_GAME: 'RESUME_GAME',
  HOST_MIGRATION: 'HOST_MIGRATION',
  PEER_LIST: 'PEER_LIST',
  CONNECT_TO_PEER: 'CONNECT_TO_PEER'
};

// ── Idempotency Layer ──
// Prevent duplicate processing of game actions caused by P2P broadcast:
// host processes locally + relays via ROOM_STATE → guest may see same action twice.
const _processedOps = new Map();

function generateOpKey(type, payload) {
  const roomCode = payload.roomCode || cachedRoom?.code;
  const playerId = payload.playerId || '';

  switch (type) {
    case MSG.SUBMIT_CLUES:
      return `${type}_${roomCode}_${playerId}_${(payload.clues || []).join(',')}`;
    case MSG.SUBMIT_TEAM_GUESS:
    case MSG.SUBMIT_OPPONENT_GUESS:
    case MSG.SUBMIT_TEAM_VOTE:
      return `${type}_${roomCode}_${playerId}_${(payload.guess || []).join(',')}`;
    case MSG.START_GAME:
      return `${type}_${roomCode}_${playerId}`;
    case MSG.NEXT_ROUND:
      return `${type}_${roomCode}_${playerId}`;
    case MSG.JOIN_REQUEST:
      return `${type}_${roomCode}_${playerId}_${payload.isReconnect ? 'reconnect' : 'new'}`;
    case MSG.ROOM_STATE:
      return `${type}_${roomCode}_${payload.detail || ''}`;
    default:
      return `${type}_${roomCode}_${playerId}`;
  }
}

function isDuplicateOp(key, ttlMs = 10000) {
  const now = Date.now();
  const prev = _processedOps.get(key);
  if (prev && (now - prev) < ttlMs) {
    return true;
  }
  _processedOps.set(key, now);
  return false;
}

function cleanupOps() {
  const now = Date.now();
  for (const [key, ts] of _processedOps) {
    if (now - ts > 30000) {
      _processedOps.delete(key);
    }
  }
}

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  team: null,
  isHost: false,
  isEncryptor: false,
  isTeammate: false,
  isOpponent: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected', // disconnected, connecting, connected, error, reconnecting
  connectionMessage: '',

  room: {
    players: [],
    teams: {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
    whiteKeywords: [],
    blackKeywords: [],
    currentCode: [],
    currentRound: 0,
    phase: GAME_PHASES.WAITING,
    encryptor: null,
    encryptorTeam: null,
    clues: [],
    teamVotes: {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentVotes: {
      player1Guess: null,
      player2Guess: null,
      finalGuess: null
    },
    notes: { white: [], black: [] },
    roundResult: null,
    winner: null,
    status: GAME_PHASES.WAITING,
    rotationIndex: 0,
    disconnectedPlayers: [],
    savedPhase: null
  }
});

let cachedRoom = null;
let _migrationInProgress = false;
let _lastBroadcastState = null;
let _joinRetryInterval = null;
let _joinTimeout = null;

function stopJoinRetry() {
  if (_joinRetryInterval) {
    clearInterval(_joinRetryInterval);
    _joinRetryInterval = null;
  }
  if (_joinTimeout) {
    clearTimeout(_joinTimeout);
    _joinTimeout = null;
  }
}

// 向房主发送加入/重连请求。数据通道刚就绪时首条消息可能丢失，
// 因此外层会配合定时器重发，直到收到 ROOM_STATE / JOIN_RESPONSE。
function sendJoinRequest(playerId, playerName, isReconnect = false) {
  const hostPeerId = `codenames-${gameState.roomCode}`;
  const connectedPeers = p2p.getConnectedPeers();
  const targetPeerId = connectedPeers.includes(hostPeerId) ? hostPeerId : connectedPeers[0];

  if (!targetPeerId) {
    log.warn('JOIN_REQUEST skipped: no connected host peer yet', { hostPeerId });
    return false;
  }

  return p2p.sendTo(targetPeerId, MSG.JOIN_REQUEST, {
    playerId,
    playerName,
    originalPeerId: p2p.peer?.id,
    isReconnect
  });
}

// 安全的深拷贝函数，避免 structuredClone 的兼容性问题
function deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // 跳过 Vue 响应式内部属性
      if (key.startsWith('__v_') || key === '_rawValue' || key === '_value') continue;
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// 监听状态变化，自动保存到缓存
watch(() => ({
  screen: gameState.screen,
  playerId: gameState.playerId,
  playerName: gameState.playerName,
  roomCode: gameState.roomCode,
  isHost: gameState.isHost,
  team: gameState.team,
  connectionStatus: gameState.connectionStatus,
  room: gameState.room
}), (newState) => {
  // 回到菜单：取消任何待保存的定时器，不缓存菜单状态
  if (newState.screen === 'menu') {
    cancelPendingSave();
    return;
  }
  // 只在非菜单页面且已连接时保存
  if (newState.playerId) {
    saveStateToCache(newState);
  }
}, { deep: true });

// Flush cached state on tab close
window.addEventListener('beforeunload', () => {
  flushStateCache(gameState);
});

function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
}

// 从缓存恢复状态
export function restoreFromCache() {
  const cache = loadStateFromCache();
  if (!cache) return false;

  console.log('[GameStore] Restoring state from cache...');

  // 恢复核心状态
  if (cache.state) {
    gameState.playerId = cache.state.playerId || null;
    gameState.playerName = cache.state.playerName || '';
    gameState.roomCode = cache.state.roomCode || null;
    gameState.isHost = cache.state.isHost || false;
    gameState.team = cache.state.team || null;
    gameState.screen = cache.state.screen || 'menu';
    gameState.connectionStatus = cache.state.connectionStatus || 'disconnected';
  }

  // 恢复房间状态
  if (cache.room) {
    Object.assign(gameState.room, cache.room);
  }

  // 重建 cachedRoom
  if (gameState.roomCode && gameState.playerId) {
    cachedRoom = {
      ...gameState.room,
      code: gameState.roomCode,
      hostId: gameState.isHost ? gameState.playerId : null
    };
  }

  // 更新本地派生状态
  if (cachedRoom) {
    updateLocalState(cachedRoom);
  }

  console.log('[GameStore] State restored from cache');
  return true;
}

// 检查是否有缓存的状态可以恢复
export function hasRestoreableState() {
  return hasCachedState();
}

export async function createRoom(name) {
  try {
    const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
    if (nameError) {
      showToast(nameError, 'warning');
      return false;
    }

    setConnectionStatus('connecting', '正在创建任务...');
    gameState.connecting = true;
    const playerId = generatePlayerId();
    const roomCode = p2p.generateRoomCode();

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = roomCode;
    gameState.isHost = true;

    cachedRoom = createInitialRoom(playerId, sanitizedName, roomCode);
    // 设置房主peerId
    const hostPlayer = cachedRoom.players.find(p => p.id === playerId);
    if (hostPlayer) hostPlayer._peerId = `codenames-${roomCode}`;

    await p2p.createHost(roomCode, sanitizedName);

    setupHostHandlers();

    updateLocalState(cachedRoom);

    gameState.connected = true;
    gameState.connecting = false;
    setConnectionStatus('connected', '任务创建成功');
    gameState.screen = 'lobby';
    return true;
  } catch (error) {
    console.error('Create room error:', error);
    gameState.error = error.message || '创建房间失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '创建房间失败');
    cleanup();
    return false;
  }
}

export async function joinRoom(name, code) {
  try {
    const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
    if (nameError) {
      showToast(nameError, 'warning');
      return false;
    }
    const { value: sanitizedCode, error: codeError } = sanitizeRoomCode(code);
    if (codeError) {
      showToast(codeError, 'warning');
      return false;
    }

    setConnectionStatus('connecting', '正在连接任务...');
    gameState.connecting = true;
    const playerId = generatePlayerId();

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = sanitizedCode;
    gameState.isHost = false;

    await p2p.joinRoom(sanitizedCode, sanitizedName);

    setupGuestHandlers();

    sendJoinRequest(playerId, sanitizedName);
    _joinRetryInterval = setInterval(() => {
      if (gameState.connected || gameState.screen !== 'menu') {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(playerId, sanitizedName);
    }, 2000);

    // 兜底：15s 内没收到房主的 ROOM_STATE / JOIN_RESPONSE 就报错
    _joinTimeout = setTimeout(() => {
      if (!gameState.connected || gameState.screen === 'menu') {
        const errMsg = '连接超时：房主未响应，请确认房间号正确或重试';
        log.warn('Join timeout: no response from host');
        gameState.error = errMsg;
        setConnectionStatus('error', errMsg);
        showToast(errMsg, 'error');
        stopJoinRetry();
        cleanup();
        gameState.screen = 'menu';
      }
    }, 15000);

    gameState.connecting = false;
    setConnectionStatus('connected', '已加入任务');
    return true;
  } catch (error) {
    console.error('Join room error:', error);
    gameState.error = error.message || '加入房间失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '加入房间失败');
    cleanup();
    return false;
  }
}

// 重连功能
export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    setConnectionStatus('error', '无法重连：缺少房间信息');
    return false;
  }

  try {
    setConnectionStatus('reconnecting', '正在重新连接...');
    gameState.connecting = true;
    // 连接已被拆除，重置为未连接，确保重发循环/超时在会话内重连时也生效
    gameState.connected = false;

    // 清理旧连接
    p2p.disconnect();

    if (gameState.isHost) {
      // 房主用同一 peerId 重新注册，createHost 成功即重连完成
      await p2p.createHost(gameState.roomCode, gameState.playerName);
      setupHostHandlers();
      gameState.connected = true;
      gameState.connecting = false;
      setConnectionStatus('connected', '重连成功');
      return true;
    }

    // 访客：建连后反复发送重连请求，由 ROOM_STATE / JOIN_RESPONSE 确认成功
    await p2p.joinRoom(gameState.roomCode, gameState.playerName);
    setupGuestHandlers();

    sendJoinRequest(gameState.playerId, gameState.playerName, true);
    _joinRetryInterval = setInterval(() => {
      if (gameState.connected) {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(gameState.playerId, gameState.playerName, true);
    }, 2000);

    // 总超时兜底：避免房主已离线时无限重试、永远停在"重连中"
    _joinTimeout = setTimeout(() => {
      if (!gameState.connected) {
        const errMsg = '重连超时：房主可能已离线，请稍后重试或重新加入任务';
        log.warn('Reconnect timeout: no response from host');
        stopJoinRetry();
        gameState.error = errMsg;
        gameState.connecting = false;
        setConnectionStatus('error', errMsg);
        showToast(errMsg, 'error');
      }
    }, 25000);

    // 连接尚未确认，保持"重连中"状态，成功由消息处理回调切换
    gameState.connecting = false;
    return true;
  } catch (error) {
    console.error('Reconnect error:', error);
    stopJoinRetry();
    gameState.error = error.message || '重连失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '重连失败');
    return false;
  }
}

function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    console.log('Player connected:', conn.peer);
    // 发送当前房间状态给新连接的玩家
    if (cachedRoom) {
      setTimeout(() => {
        p2p.sendTo(conn.peer, MSG.ROOM_STATE, { room: cachedRoom });
        // 发送当前已连接的 peer 列表，让访客互相连接
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer);
        if (otherPeers.length > 0) {
          p2p.sendTo(conn.peer, MSG.PEER_LIST, { peers: otherPeers });
        }
      }, 500);
    }
  };

  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Player disconnected:', peerId);
    const playerToRemove = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToRemove && cachedRoom) {
      removePlayerFromRoom(cachedRoom, playerToRemove.id);
      broadcastState();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleHostMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Host error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  // Heartbeat: detect and clean up dead P2P connections
  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Host detected dead peer', { peerId });
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push(playerToMark);
      }
      broadcastState();
    }
  };
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Guest disconnected from peer:', peerId);

    // 检查断开的是否是房主
    const hostPeerId = `codenames-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (_migrationInProgress) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      console.log('Host disconnected! Attempting migration...');
      handleHostDisconnect();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Guest error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  // Heartbeat: detect dead connections; trigger migration if host is dead
  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Guest detected dead peer', { peerId });
    const hostPeerId = `codenames-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (_migrationInProgress) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      handleHostDisconnect();
    }
    // For non-host dead peers, just log; host will handle cleanup
  };
}

// 处理房主断开 - 访客托管机制
async function handleHostDisconnect() {
  if (!cachedRoom) return;

  // Mutex: prevent duplicate migration when multiple guests detect host disconnect simultaneously
  if (_migrationInProgress) {
    log.info('Host migration already in progress, skipping');
    return;
  }
  _migrationInProgress = true;

  // Safety valve: reset mutex after 5 seconds in case migration hangs
  const safetyTimer = setTimeout(() => {
    if (_migrationInProgress) {
      log.warn('Host migration safety timeout triggered, resetting mutex');
      _migrationInProgress = false;
    }
  }, 5000);

  const otherPlayers = cachedRoom.players.filter(p =>
    p.id !== gameState.playerId && p.isOnline !== false
  );

  if (otherPlayers.length === 0) {
    // 没有其他玩家了，游戏结束
    clearTimeout(safetyTimer);
    _migrationInProgress = false;
    setConnectionStatus('error', '房主已断开，房间关闭');
    gameState.error = '房主已断开，房间关闭';
    gameState.connected = false;
    return;
  }

  // 选举新房主：按加入顺序（order）最小的在线玩家
  const candidates = cachedRoom.players
    .filter(p => p.isOnline !== false)
    .sort((a, b) => a.order - b.order);

  const newHost = candidates[0];

  if (newHost.id === gameState.playerId) {
    // 我成为新房主
    console.log('I am the new host!');
    await becomeNewHost();
    clearTimeout(safetyTimer);
  } else {
    // 等待新房主连接我
    console.log('Waiting for new host:', newHost.name);
    setConnectionStatus('reconnecting', '房主已断开，正在重新组织连接...');

    // 尝试连接到新房主
    const newHostPeerId = newHost._peerId || `codenames-guest-${newHost.id}`;
    try {
      await p2p.connectToPeer(newHostPeerId);
      setConnectionStatus('connected', '已连接到新房主');
      clearTimeout(safetyTimer);
      _migrationInProgress = false;
    } catch (err) {
      console.error('Failed to connect to new host:', err);
      clearTimeout(safetyTimer);
      _migrationInProgress = false;
      // 如果连接失败，尝试自己成为房主
      becomeNewHost();
    }
  }
}

// 成为新房主
async function becomeNewHost() {
  if (!cachedRoom) return;

  // 更新房间状态
  cachedRoom.hostId = gameState.playerId;
  gameState.isHost = true;

  // 更新玩家状态
  const me = cachedRoom.players.find(p => p.id === gameState.playerId);
  if (me) {
    me.isHost = true;
    me._peerId = p2p.getMyPeerId();
  }

  // 移除旧房主的连接
  const oldHostPeerId = `codenames-${gameState.roomCode}`;
  p2p.connections = p2p.connections.filter(c => c.peer !== oldHostPeerId);

  setConnectionStatus('connected', '你已成为新房主');
  gameState.connected = true;

  // 广播房主变更
  try {
    p2p.broadcast(MSG.HOST_MIGRATION, {
      newHostId: gameState.playerId,
      newHostPeerId: p2p.getMyPeerId(),
      room: cachedRoom
    });
  } catch (err) {
    log.error('Failed to broadcast HOST_MIGRATION', { error: err });
  }

  // Migration resolved — clear the mutex
  _migrationInProgress = false;

  // Restart heartbeat with host-side handler
  p2p.stopHeartbeat();
  setupHostHandlers();
  // Note: setupHostHandlers already calls startHeartbeat(10000) with host-side onDeadPeer

  broadcastState();
}

function handleHostMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        // Idempotency: skip duplicate join requests
        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect });
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        // 检查是否是断线重连
        const existingPlayer = cachedRoom?.players.find(p => p.id === playerId);
        if (existingPlayer && !existingPlayer.isOnline) {
          // 断线重连
          existingPlayer.isOnline = true;
          existingPlayer._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }

          // 检查是否可以恢复游戏
          if (canResumeGame(cachedRoom)) {
            resumeGame(cachedRoom);
          }

          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true });
          return;
        }

        const result = addPlayerToRoom(cachedRoom, playerName, playerId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error });
          return;
        }
        const player = cachedRoom.players.find(p => p.id === playerId);
        if (player) {
          player._peerId = originalPeerId || peerId;
        }
        broadcastState();

        // 通知其他访客连接到新玩家
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
        otherPeers.forEach(otherPeerId => {
          p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId || peerId });
        });

        break;
      } catch (err) {
        log.error('handleHostMessage:JOIN_REQUEST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.START_GAME: {
      try {
        if (data.payload.playerId !== cachedRoom.hostId) return;
        // Idempotency: skip duplicate start game
        const startKey = generateOpKey(MSG.START_GAME, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
        if (isDuplicateOp(startKey)) {
          log.debug('Duplicate START_GAME ignored', { key: startKey });
          broadcastState();
          return;
        }
        startGame(cachedRoom);
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:START_GAME error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_CLUES: {
      try {
        // Idempotency: skip duplicate clue submission
        const cluesKey = generateOpKey(MSG.SUBMIT_CLUES, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, clues: data.payload.clues });
        if (isDuplicateOp(cluesKey)) {
          log.debug('Duplicate SUBMIT_CLUES ignored', { key: cluesKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交线索' });
          return;
        }
        const result = submitClues(cachedRoom, data.payload.playerId, data.payload.clues);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_CLUES error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_TEAM_GUESS: {
      try {
        // Idempotency: skip duplicate team guess
        const teamGuessKey = generateOpKey(MSG.SUBMIT_TEAM_GUESS, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
        if (isDuplicateOp(teamGuessKey)) {
          log.debug('Duplicate SUBMIT_TEAM_GUESS ignored', { key: teamGuessKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交猜测' });
          return;
        }
        const result = submitTeamGuess(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        // 检查是否需要进入投票阶段
        if (checkNeedTeamVoting(cachedRoom)) {
          cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_TEAM_GUESS error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_OPPONENT_GUESS: {
      try {
        // Idempotency: skip duplicate opponent guess
        const oppGuessKey = generateOpKey(MSG.SUBMIT_OPPONENT_GUESS, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
        if (isDuplicateOp(oppGuessKey)) {
          log.debug('Duplicate SUBMIT_OPPONENT_GUESS ignored', { key: oppGuessKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交拦截' });
          return;
        }
        const result = submitOpponentGuess(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        if (checkNeedTeamVoting(cachedRoom)) {
          cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_OPPONENT_GUESS error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_OPPONENT_VOTE: {
      try {
        const oppVoteKey = generateOpKey(MSG.SUBMIT_OPPONENT_VOTE, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
        if (isDuplicateOp(oppVoteKey)) {
          log.debug('Duplicate SUBMIT_OPPONENT_VOTE ignored', { key: oppVoteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交投票' });
          return;
        }
        const result = submitOpponentFinalVote(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_OPPONENT_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_TEAM_VOTE: {
      try {
        // Idempotency: skip duplicate team vote
        const voteKey = generateOpKey(MSG.SUBMIT_TEAM_VOTE, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
        if (isDuplicateOp(voteKey)) {
          log.debug('Duplicate SUBMIT_TEAM_VOTE ignored', { key: voteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交投票' });
          return;
        }
        const result = submitTeamFinalVote(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_TEAM_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.NEXT_ROUND: {
      try {
        if (data.payload.playerId !== cachedRoom.hostId) return;
        // Idempotency: skip duplicate next round
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
        if (isDuplicateOp(nextRoundKey)) {
          log.debug('Duplicate NEXT_ROUND ignored', { key: nextRoundKey });
          broadcastState();
          return;
        }
        if (cachedRoom.status === GAME_PHASES.ENDED) {
          resetGame(cachedRoom);
        } else {
          nextRound(cachedRoom);
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:NEXT_ROUND error', { type: data?.type, peerId, error: err });
        break;
      }
    }
  }
  } catch (err) {
    log.error('handleHostMessage error', { type: data?.type, peerId, error: err });
  }
}

function handleGuestMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.ROOM_STATE: {
      try {
        if (data.payload.room) {
          // Idempotency: skip duplicate room state updates
          const room = data.payload.room;
          const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: `${room.currentRound}_${room.phase}` });
          if (isDuplicateOp(roomStateKey)) {
            log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
            break;
          }
          cachedRoom = data.payload.room;
          updateLocalState(cachedRoom);
          // 房主已响应，停止加入重发循环与超时兜底
          stopJoinRetry();
          if (data.payload.error) {
            showToast(data.payload.error, 'warning');
          }
          if (!gameState.connected) {
            gameState.connected = true;
            setConnectionStatus('connected', '已连接');
            gameState.screen = 'lobby';
          }
        } else if (data.payload.delta) {
          // Merge delta into local cachedRoom
          const delta = data.payload.delta;
          if (!cachedRoom) {
            log.warn('Delta received but no cachedRoom', { peerId });
            break;
          }
          Object.keys(delta).forEach(key => {
            cachedRoom[key] = delta[key];
          });
          updateLocalState(cachedRoom);
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:ROOM_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.JOIN_RESPONSE: {
      try {
        if (data.payload.success === false) {
          stopJoinRetry();
          gameState.error = data.payload.error || '加入房间失败';
          setConnectionStatus('error', data.payload.error || '加入房间失败');
          cleanup();
          gameState.screen = 'menu';
        } else if (data.payload.reconnected) {
          stopJoinRetry();
          gameState.connected = true;
          setConnectionStatus('connected', '重连成功');
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:JOIN_RESPONSE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.PEER_LIST: {
      try {
        // 收到 peer 列表，尝试连接到其他访客
        const { peers } = data.payload;
        console.log('Received peer list:', peers);
        if (peers && peers.length > 0) {
          peers.forEach(async (peerId) => {
            try {
              await p2p.connectToPeer(peerId);
              console.log('Connected to peer:', peerId);
            } catch (err) {
              console.error('Failed to connect to peer:', peerId, err);
            }
          });
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.HOST_MIGRATION: {
      try {
        // 房主迁移通知
        const { newHostId, newHostPeerId, room } = data.payload;
        console.log('Host migration to:', newHostId);

        if (newHostId === gameState.playerId) {
          // 我已经是新房主了，不需要处理
          break;
        }

        // Migration resolved by peer — clear the mutex
        _migrationInProgress = false;
        log.info('Host migration resolved by peer', { newHostId });

        // 更新房间状态
        cachedRoom = room;
        updateLocalState(cachedRoom);

        // 连接到新房主（异步处理，不阻塞消息处理）
        p2p.connectToPeer(newHostPeerId).then(() => {
          setConnectionStatus('connected', '已连接到新房主');
          gameState.connected = true;
        }).catch((err) => {
          console.error('Failed to connect to new host:', err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.CONNECT_TO_PEER: {
      try {
        // 被要求连接到指定 peer
        const { peerId: targetPeerId } = data.payload;
        p2p.connectToPeer(targetPeerId).catch((err) => {
          console.error('Failed to connect to peer:', targetPeerId, err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:CONNECT_TO_PEER error', { type: data?.type, peerId, error: err });
        break;
      }
    }
  }
  } catch (err) {
    log.error('handleGuestMessage error', { type: data?.type, peerId, error: err });
  }
}

function computeRoomDiff(oldRoom, newRoom) {
  const diff = {};
  let changedCount = 0;
  const keys = Object.keys(newRoom);

  for (const key of keys) {
    if (key.startsWith('__v_') || key === '_rawValue' || key === '_value') continue;

    const oldVal = oldRoom ? oldRoom[key] : undefined;
    const newVal = newRoom[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = newVal;
      changedCount++;
    }
  }

  return { diff, changedCount, totalFields: keys.length };
}

function broadcastState() {
  if (!cachedRoom) return;
  cleanupOps();

  const { diff, changedCount, totalFields } = computeRoomDiff(_lastBroadcastState, cachedRoom);

  // Full broadcast if: first time, >50% changed, or too few fields (<3)
  const shouldSendFull = !_lastBroadcastState ||
                         changedCount > totalFields * 0.5 ||
                         totalFields < 3;

  if (shouldSendFull) {
    p2p.broadcast(MSG.ROOM_STATE, { room: cachedRoom });
  } else {
    p2p.broadcast(MSG.ROOM_STATE, {
      delta: diff,
      round: cachedRoom.currentRound,
      phase: cachedRoom.phase
    });
  }

  _lastBroadcastState = deepClone(cachedRoom);
  updateLocalState(cachedRoom);
}

function updateLocalState(room) {
  if (!room) return;

  gameState.roomCode = room.code;
  gameState.isHost = room.hostId === gameState.playerId;

  const player = room.players.find(p => p.id === gameState.playerId);
  gameState.team = player?.team || null;
  gameState.isEncryptor = player?.isEncryptor || false;
  gameState.isTeammate = player?.team === room.encryptorTeam && !gameState.isEncryptor;
  gameState.isOpponent = player?.team !== room.encryptorTeam;

  gameState.room = {
    players: room.players?.map(p => ({ ...p })) || [],
    teams: deepClone(room.teams) || {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
    whiteKeywords: player?.team === 'white' ? (room.whiteKeywords ? [...room.whiteKeywords] : []) : [],
    blackKeywords: player?.team === 'black' ? (room.blackKeywords ? [...room.blackKeywords] : []) : [],
    currentCode: room.currentCode ? [...room.currentCode] : [],
    currentRound: room.currentRound || 0,
    phase: room.phase || GAME_PHASES.WAITING,
    encryptor: room.encryptor,
    encryptorTeam: room.encryptorTeam,
    clues: room.clues ? [...room.clues] : [],
    teamVotes: room.teamVotes ? deepClone(room.teamVotes) : {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentVotes: room.opponentVotes ? deepClone(room.opponentVotes) : {
      player1Guess: null,
      player2Guess: null,
      finalGuess: null
    },
    notes: deepClone(room.notes) || { white: [], black: [] },
    roundResult: room.roundResult ? { ...room.roundResult } : null,
    winner: room.winner,
    status: room.status || GAME_PHASES.WAITING,
    rotationIndex: room.rotationIndex || 0,
    disconnectedPlayers: room.disconnectedPlayers || [],
    savedPhase: room.savedPhase || null
  };

  syncScreenToPhase(room);
}

function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}

export function handleStartGame() {
  if (!gameState.isHost) return;
  // 先执行本地逻辑，成功后再广播
  startGame(cachedRoom);
  broadcastState();
  // 广播命令让访客也执行 startGame
  p2p.broadcast(MSG.START_GAME, { playerId: gameState.playerId });
}

export async function handleSubmitClues(clues) {
  const { value: sanitizedClues, error: clueError } = sanitizeClues(clues);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }

  // 先执行本地逻辑，成功后再广播
  const result = submitClues(cachedRoom, gameState.playerId, sanitizedClues);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_CLUES, {
    playerId: gameState.playerId,
    clues: sanitizedClues
  });
  return true;
}

// 提交队友猜测
export async function handleSubmitTeamGuess(guess) {
  // 先执行本地逻辑，成功后再广播
  const result = submitTeamGuess(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  // 检查是否需要进入投票阶段
  if (checkNeedTeamVoting(cachedRoom)) {
    cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_TEAM_GUESS, {
    playerId: gameState.playerId,
    guess: guess
  });
  return true;
}

// 提交对方拦截
export async function handleSubmitOpponentGuess(guess) {
  // 先执行本地逻辑，成功后再广播
  const result = submitOpponentGuess(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  // 检查是否需要进入投票阶段
  if (checkNeedTeamVoting(cachedRoom)) {
    cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_OPPONENT_GUESS, {
    playerId: gameState.playerId,
    guess: guess
  });
  return true;
}

// 提交对方拦截最终投票
export async function handleSubmitOpponentVote(guess) {
  // 先执行本地逻辑，成功后再广播
  const result = submitOpponentFinalVote(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_OPPONENT_VOTE, {
    playerId: gameState.playerId,
    guess: guess
  });
  return true;
}

// 提交队内最终投票
export async function handleSubmitTeamVote(guess) {
  // 先执行本地逻辑，成功后再广播
  const result = submitTeamFinalVote(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_TEAM_VOTE, {
    playerId: gameState.playerId,
    guess: guess
  });
  return true;
}

export function handleNextRound() {
  if (!gameState.isHost) return;
  // 先执行本地逻辑，成功后再广播
  if (cachedRoom.status === GAME_PHASES.ENDED) {
    resetGame(cachedRoom);
  } else {
    nextRound(cachedRoom);
  }
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export function handlePlayAgain() {
  if (!gameState.isHost) return;
  // 先执行本地逻辑，成功后再广播
  resetGame(cachedRoom);
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export async function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

function cleanup() {
  // Flush any pending debounced save immediately before tearing down state
  flushStateCache(gameState);
  p2p.stopHeartbeat();
  p2p.disconnect();
  stopJoinRetry();
  _migrationInProgress = false;
  cachedRoom = null;
  _lastBroadcastState = null;
  gameState.connected = false;
  gameState.connecting = false;
  gameState.error = null;
  gameState.playerId = null;
  gameState.playerName = '';
  gameState.roomCode = null;
  gameState.isHost = false;
  gameState.team = null;
  gameState.isEncryptor = false;
  gameState.isTeammate = false;
  gameState.isOpponent = false;
  setConnectionStatus('disconnected', '');

  gameState.room = {
    players: [],
    teams: {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
    whiteKeywords: [],
    blackKeywords: [],
    currentCode: [],
    currentRound: 0,
    phase: GAME_PHASES.WAITING,
    encryptor: null,
    encryptorTeam: null,
    clues: [],
    teamVotes: {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentVotes: {
      player1Guess: null,
      player2Guess: null,
      finalGuess: null
    },
    notes: { white: [], black: [] },
    roundResult: null,
    winner: null,
    status: GAME_PHASES.WAITING,
    rotationIndex: 0,
    disconnectedPlayers: [],
    savedPhase: null
  };

  // 清除缓存
  clearStateCache();
}

export { GAME_PHASES, GUESS_TYPE };
