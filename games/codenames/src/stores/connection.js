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
    // 发送当前房间状态给新连接的玩家
    const cachedRoom = getRoom();
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
    const cachedRoom = getRoom();
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
    const cachedRoom = getRoom();
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
  resetGameState();
  // 清除缓存
  clearCache();
}
