// ── High-Level API & Game Operations (codenames) ──────────────────────────────
// 网络层已迁移到 network.js（使用共享 createNetworkLayer 工厂）。
// 本文件只保留：高层 API（createRoom/joinRoom/reconnectRoom/leaveRoom）+ cleanup + 游戏操作 + re-export。

import {
  GAME_PHASES,
  generatePlayerId, createInitialRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess,
  submitOpponentFinalVote, submitTeamFinalVote,
  checkNeedTeamVoting, nextRound, resetGame
} from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import { MSG, resetOps } from '../services/online';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeClues } from '../services/sanitize';
import { showToast } from '../components/ToastNotification.vue';

import {
  gameState, getRoom, setRoom,
  updateLocalState, setConnectionStatus, resetGameState,
  clearCache, flushCache
} from './roomState';
import { startJoinRetry, startJoinTimeout, stopJoinRetry } from './timers';
import {
  sendJoinRequest, hostMigrator, broadcastState,
  setupHostHandlers, setupGuestHandlers,
  cleanupNetwork, RECONNECT_METADATA
} from './network';

const log = createLogger('GameStore');

// ── High-Level API ────────────────────────────────────────────────────────────

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
    gameState.connected = false;

    // 清理旧连接
    p2p.disconnect();

    if (gameState.isHost) {
      await p2p.createHost(gameState.roomCode, gameState.playerName);
      setupHostHandlers();
      gameState.connected = true;
      gameState.connecting = false;
      setConnectionStatus('connected', '重连成功');
      return true;
    }

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

export async function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

// ── Game Operations ───────────────────────────────────────────────────────────

export function handleStartGame() {
  if (!gameState.isHost) return;
  startGame(getRoom());
  broadcastState();
  p2p.broadcast(MSG.START_GAME, { playerId: gameState.playerId });
}

export async function handleSubmitClues(clues) {
  const { value: sanitizedClues, error: clueError } = sanitizeClues(clues);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }

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

export async function handleSubmitTeamGuess(guess) {
  const result = submitTeamGuess(getRoom(), gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
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

export async function handleSubmitOpponentGuess(guess) {
  const result = submitOpponentGuess(getRoom(), gameState.playerId, guess);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
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

export async function handleSubmitOpponentVote(guess) {
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

export async function handleSubmitTeamVote(guess) {
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
  resetGame(getRoom());
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup() {
  flushCache();
  p2p.stopHeartbeat();
  p2p.disconnect();
  stopJoinRetry();
  hostMigrator.resetMigrationMutex();
  cleanupNetwork();
  resetOps();
  resetGameState();
  clearCache();
}

// Re-export RECONNECT_METADATA for gameStore.js
export { RECONNECT_METADATA };
