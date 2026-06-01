import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  GAME_PHASES,
  generatePlayerId, createInitialRoom,
  removePlayerFromRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess,
  submitOpponentFinalVote, submitTeamFinalVote,
  checkNeedTeamVoting, nextRound, resetGame
} from '../services/gameEngine';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeClues } from '../services/sanitize';
import {
  MSG,
  cleanupOps,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  resetOps
} from '../services/online';
import { createHostMigrationHandler } from '../../../../src/shared/online/useHostMigration';
import { showToast } from '../components/ToastNotification.vue';
import {
  gameState, getRoom, setRoom,
  updateLocalState, setConnectionStatus, resetGameState,
  clearCache, flushCache
} from './roomState';
import { startJoinRetry, startJoinTimeout, stopJoinRetry } from './timers';
// 注意：与 messageHandlers.js 形成 import 环，但仅在函数体内（调用时）引用，ES module 可容忍。
import { handleHostMessage, handleGuestMessage } from './messageHandlers';

const log = createLogger('GameStore');

const sendJoinRequest = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
});

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom: () => getRoom(),
  updateLocalState
});

// 共享房主迁移处理器（与 catguess 一致；codenames 不启用 enableWaitBranch）
export const hostMigrator = createHostMigrationHandler({
  gameId: 'codenames',
  p2p,
  log
});

// ── Auto-Reconnect Engine ────────────────────────────────────────────────────
// 与 catguess 语义一致：
//   - 监听 P2P ICE 状态变化（disconnected/failed → 触发重连）
//   - 3s 周期性轮询兜底（应对 onConnectionStateChange 漏报）
//   - 指数退避 1→32s 上限，8 次封顶，每次 ±25% jitter
//   - 房主：靠"peer 还在 → cancel"，访客：整 peer 重建并重连
//
// 与 catguess 唯一不同：codenames 走"已注册的 onPlayerDisconnected / onDeadPeer"
// 路径处理 host 死亡（迁移），auto-reconnect 只管"host 还在但 ICE 抖"的场景，
// 因此房主路径基本只是 cancelAutoReconnect（host 的 peer 永远在）。
const MAX_RECONNECT_ATTEMPTS = 8;
let _reconnectAttempts = 0;
let _autoReconnectTimer = null;
let _autoReconnectInterval = null;

function registerAutoReconnectHandlers() {
  p2p.onConnectionStateChange = ({ peerId, iceConnectionState: iceState }) => {
    const hostPeerId = `codenames-${gameState.roomCode}`;

    if (iceState === 'disconnected' || iceState === 'failed') {
      if ((peerId === hostPeerId || gameState.isHost) && !_autoReconnectTimer) {
        setConnectionStatus('reconnecting', '检测到连接断开，正在自动重连...');
        startAutoReconnect();
      }
    } else if (iceState === 'connected' || iceState === 'completed') {
      cancelAutoReconnect();
      if (gameState.connectionStatus === 'reconnecting') {
        setConnectionStatus('connected', '已连接');
      }
      _reconnectAttempts = 0;
    }
  };

  // 周期性兜底：3s 检查一次 ICE 状态
  if (_autoReconnectInterval) return;
  _autoReconnectInterval = setInterval(() => {
    if (!gameState.roomCode) return;
    const hostPeerId = `codenames-${gameState.roomCode}`;
    const state = p2p.getPeerConnectionState(hostPeerId);
    if (state?.iceConnectionState === 'failed' && !_autoReconnectTimer) {
      startAutoReconnect();
    }
  }, 3000);
}

async function startAutoReconnect() {
  if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setConnectionStatus('error', '连接失败，请检查网络后手动重连');
    cancelAutoReconnect();
    return;
  }

  _reconnectAttempts++;

  // 指数退避：1s, 2s, 4s, 8s, 16s, 32s (capped), ±25% jitter
  const baseDelay = Math.min(1000 * Math.pow(2, _reconnectAttempts - 1), 32000);
  const jitter = baseDelay * (0.75 + Math.random() * 0.5);

  _autoReconnectTimer = setTimeout(async () => {
    _autoReconnectTimer = null;
    try {
      if (gameState.isHost) {
        // 房主：peer 一直注册在信令服务器上，等连接自然恢复
        const connectedPeers = p2p.getConnectedPeers();
        if (connectedPeers.length > 0) {
          cancelAutoReconnect();
          setConnectionStatus('connected', '已连接');
          _reconnectAttempts = 0;
          return;
        }
        // peers 全断 → 等下一轮 ICE 触发或定时器再走一次
        startAutoReconnect();
      } else {
        // 访客：softDisconnect 重建 peer，重发 JOIN_REQUEST + REQUEST_STATE
        const ok = await reconnectRoomInternal();
        if (!ok) {
          log.warn('Auto-reconnect attempt timed out', { attempt: _reconnectAttempts });
          startAutoReconnect();
        }
      }
    } catch (err) {
      log.warn('Auto-reconnect attempt failed', { attempt: _reconnectAttempts, error: err?.message });
      startAutoReconnect();
    }
  }, jitter);
}

function cancelAutoReconnect() {
  if (_autoReconnectTimer) {
    clearTimeout(_autoReconnectTimer);
    _autoReconnectTimer = null;
  }
}

async function reconnectRoomInternal() {
  if (!gameState.roomCode || !gameState.playerName) return false;

  p2p.softDisconnect();
  gameState.connected = false;

  await p2p.joinRoom(gameState.roomCode, gameState.playerName);
  setupGuestHandlers();

  sendJoinRequest(gameState.playerId, gameState.playerName, true);

  // 等 ROOM_STATE / JOIN_RESPONSE 确认恢复
  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    let checkInterval = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(checkInterval);
      resolve(ok);
    };
    timeout = setTimeout(() => finish(false), 10000);
    checkInterval = setInterval(() => {
      if (gameState.connected) {
        finish(true);
      }
    }, 500);
  });
}

// ── Disconnected Player Cleanup ──────────────────────────────────────────────
// 与 catguess 一致：玩家离线后用统一路径标记 + 启动超时清理。
// 区别（与 catguess 相比）：
//   - 猫猜在游戏阶段也会自动出卡/出题/投票；codenames 是 4 人对猜，4 缺 1 没法公平继续
//   - 因此 codenames 游戏阶段只保留"标记 offline + 推入 disconnectedPlayers + 暂停游戏"，
//     不做超时强制清理（避免 3 人继续导致 gameEngine 状态卡死）
//   - 仅大厅阶段 30s 后从 players 移除（仿 catguess 大厅策略）
const LOBBY_DISCONNECT_TIMEOUT_MS = 30 * 1000;
const LOBBY_CLEANUP_INTERVAL_MS = 10 * 1000;
let _offlinePlayerCleanupTimer = null;

function markPlayerOffline(peerId) {
  const cachedRoom = getRoom();
  const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
  if (!playerToMark || !cachedRoom) return;

  // 已经在 disconnectedPlayers 列表里就别重复塞
  const alreadyTracked = (cachedRoom.disconnectedPlayers || []).find(p => p.id === playerToMark.id);
  playerToMark.isOnline = false;
  if (!cachedRoom.disconnectedPlayers) {
    cachedRoom.disconnectedPlayers = [];
  }
  if (!alreadyTracked) {
    cachedRoom.disconnectedPlayers.push({
      id: playerToMark.id,
      name: playerToMark.name,
      team: playerToMark.team,
      disconnectedAt: Date.now()
    });
  }

  // 游戏阶段：依赖 gameEngine 内置的 PAUSED 等待机制，不在这里再搞自动恢复
  // 大厅阶段：启动超时清理（30s 后真正移除，让新玩家能补位）
  const isInLobby = cachedRoom.status === GAME_PHASES.WAITING;
  if (isInLobby) {
    scheduleOfflinePlayerCleanup();
  }
}

function cleanupDisconnectedPlayers() {
  const cachedRoom = getRoom();
  if (!cachedRoom || !cachedRoom.disconnectedPlayers || cachedRoom.disconnectedPlayers.length === 0) {
    return;
  }

  // 仅大厅阶段执行：游戏阶段由 PAUSED 等待，不破坏 4 人对猜的逻辑
  const isInLobby = cachedRoom.status === GAME_PHASES.WAITING;
  if (!isInLobby) {
    clearOfflinePlayerCleanupTimer();
    return;
  }

  const now = Date.now();
  const stale = cachedRoom.disconnectedPlayers.filter(
    p => now - p.disconnectedAt > LOBBY_DISCONNECT_TIMEOUT_MS
  );

  if (stale.length === 0) return;

  log.info('Removing stale disconnected players from lobby', { count: stale.length });

  stale.forEach(sp => {
    removePlayerFromRoom(cachedRoom, sp.id);
  });

  if (cachedRoom.disconnectedPlayers.length === 0) {
    clearOfflinePlayerCleanupTimer();
  }

  broadcastState();
}

function scheduleOfflinePlayerCleanup() {
  if (_offlinePlayerCleanupTimer) return;
  _offlinePlayerCleanupTimer = setTimeout(() => {
    _offlinePlayerCleanupTimer = null;
    cleanupDisconnectedPlayers();
    // 列表非空就继续轮询（已无意义时由 cleanupDisconnectedPlayers 自己停）
    if (getRoom()?.disconnectedPlayers?.length > 0) {
      scheduleOfflinePlayerCleanup();
    }
  }, LOBBY_CLEANUP_INTERVAL_MS);
}

function clearOfflinePlayerCleanupTimer() {
  if (_offlinePlayerCleanupTimer) {
    clearTimeout(_offlinePlayerCleanupTimer);
    _offlinePlayerCleanupTimer = null;
  }
}

export function broadcastState() {
  if (!getRoom()) return;
  cleanupOps();
  roomBroadcaster.broadcastState();
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

    const room = createInitialRoom(playerId, sanitizedName, roomCode);
    setRoom(room);
    // 设置房主peerId
    const hostPlayer = room.players.find(p => p.id === playerId);
    if (hostPlayer) hostPlayer._peerId = `codenames-${roomCode}`;

    await p2p.createHost(roomCode, sanitizedName);

    setupHostHandlers();

    updateLocalState(room);

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
    startJoinRetry(() => {
      if (gameState.connected || gameState.screen !== 'menu') {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(playerId, sanitizedName);
    }, 2000);

    // 兜底：15s 内没收到房主的 ROOM_STATE / JOIN_RESPONSE 就报错
    startJoinTimeout(() => {
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
    startJoinRetry(() => {
      if (gameState.connected) {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(gameState.playerId, gameState.playerName, true);
    }, 2000);

    // 总超时兜底：避免房主已离线时无限重试、永远停在"重连中"
    startJoinTimeout(() => {
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
    // DO NOT send ROOM_STATE here — the JOIN_REQUEST handler broadcasts it after processing.
    // Sending ROOM_STATE before JOIN_REQUEST is processed includes stale state (without the new player),
    // and the subsequent broadcastState() ROOM_STATE gets wrongly rejected by idempotency (same round/phase key).
    if (getRoom()) {
      setTimeout(() => {
        // 只发 PEER_LIST 让访客互相连接；ROOM_STATE 留给 JOIN_REQUEST 处理完后由 broadcastState 推
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer);
        if (otherPeers.length > 0) {
          p2p.sendTo(conn.peer, MSG.PEER_LIST, { peers: otherPeers });
        }
      }, 500);
    }
  };

  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Player disconnected:', peerId);
    // 走统一路径：标记 offline + 推入 disconnectedPlayers + 启动超时清理
    // 大厅阶段 30s 后真正移除；游戏阶段交给 gameEngine 的 PAUSED 等待机制
    markPlayerOffline(peerId);
    broadcastState();
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
    markPlayerOffline(peerId);
    broadcastState();
  };

  registerAutoReconnectHandlers();
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Guest disconnected from peer:', peerId);

    // 检查断开的是否是房主
    const hostPeerId = `codenames-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      console.log('Host disconnected! Attempting migration...');
      _doHostMigrate();
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
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      _doHostMigrate();
    }
    // For non-host dead peers, just log; host will handle cleanup
  };

  registerAutoReconnectHandlers();
}

// 房主迁移 — 委托给共享迁移处理器（codenames 不启用高 order 等待分支）
async function _doHostMigrate() {
  await hostMigrator.handleHostDisconnect(getRoom(), gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus,
    enableWaitBranch: false
  });
}

export function handleStartGame() {
  if (!gameState.isHost) return;
  // 先执行本地逻辑，成功后再广播
  startGame(getRoom());
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
  const result = submitClues(getRoom(), gameState.playerId, sanitizedClues);
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
  const result = submitTeamGuess(getRoom(), gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  // 检查是否需要进入投票阶段
  if (checkNeedTeamVoting(getRoom())) {
    getRoom().phase = GAME_PHASES.TEAM_VOTING;
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
  const result = submitOpponentGuess(getRoom(), gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  // 检查是否需要进入投票阶段
  if (checkNeedTeamVoting(getRoom())) {
    getRoom().phase = GAME_PHASES.TEAM_VOTING;
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
  const result = submitOpponentFinalVote(getRoom(), gameState.playerId, guess);
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
  const result = submitTeamFinalVote(getRoom(), gameState.playerId, guess);
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
  if (getRoom().status === GAME_PHASES.ENDED) {
    resetGame(getRoom());
  } else {
    nextRound(getRoom());
  }
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export function handlePlayAgain() {
  if (!gameState.isHost) return;
  // 先执行本地逻辑，成功后再广播
  resetGame(getRoom());
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export async function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

export function cleanup() {
  // Flush any pending debounced save immediately before tearing down state
  flushCache();
  p2p.stopHeartbeat();
  p2p.disconnect();
  stopJoinRetry();
  hostMigrator.resetMigrationMutex();
  roomBroadcaster.resetBroadcastState();
  resetOps();
  cancelAutoReconnect();
  clearOfflinePlayerCleanupTimer();
  if (_autoReconnectInterval) {
    clearInterval(_autoReconnectInterval);
    _autoReconnectInterval = null;
  }
  _reconnectAttempts = 0;
  resetGameState();
  // 清除缓存
  clearCache();
}

// 暴露给 UI / 测试读取当前重连状态
export const RECONNECT_METADATA = {
  get attempt() { return _reconnectAttempts; },
  MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
};
