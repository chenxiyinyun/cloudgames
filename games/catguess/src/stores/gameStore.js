// ── 门面：保持组件的 import 路径与公共 API 稳定 ────────────────────────────────
// 实际实现已拆分为 state / cache / timers / network 四个模块。
// 本文件只保留：高层 API（createRoom/joinRoom/reconnectRoom/leaveRoom）+ cleanup + 游戏操作 handleXxx + re-export。

import {
  GAME_PHASES, generatePlayerId, createInitialRoom, startGame,
  submitStorySelection, submitCard, submitVote,
  nextRound, restartGame
} from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import { MSG } from '../services/online';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeStoryClue } from '../services/sanitize';
import { showToast } from '../components/ToastNotification.vue';

import {
  gameState, getRoom, setRoom,
  DEFAULT_WORD_POOL, updateLocalState
} from './state';
import { restoreFromCache, hasRestoreableState, clearCache, flushCache } from './cache';
import {
  setConnectionStatus, startJoinTimeout, startJoinRetryInterval,
  stopJoinRetry, resetAllTimers,
  scheduleHostTimerForCurrentPhase, schedulePickingTimeout,
  scheduleVotingTimeout,
  clearScoringTimer, clearPickingTimer, clearOthersPickingTimer,
  clearVotingTimer, clearOfflineTickTimer
} from './timers';
import {
  sendJoinRequest, hostMigrator, broadcastState,
  setupHostHandlers, setupGuestHandlers
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
    gameState.error = null;
    const playerId = generatePlayerId();
    const roomCode = p2p.generateRoomCode();
    const wordPool = [...DEFAULT_WORD_POOL];

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = roomCode;
    gameState.isHost = true;

    setRoom(createInitialRoom(playerId, sanitizedName, roomCode, wordPool));
    const hostPlayer = getRoom().players.find(p => p.id === playerId);
    if (hostPlayer) hostPlayer._peerId = `catguess-${roomCode}`;

    await p2p.createHost(roomCode, sanitizedName);

    setupHostHandlers();

    updateLocalState(getRoom());

    gameState.connected = true;
    gameState.connecting = false;
    setConnectionStatus('connected', '任务创建成功');
    gameState.screen = 'lobby';
    return true;
  } catch (error) {
    console.error('Create room error:', error);
    const msg = error.message || '创建房间失败';
    gameState.error = msg;
    gameState.connecting = false;
    showToast(`创建房间失败：${msg}`, 'error');
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
    gameState.error = null;

    // 复用缓存的 playerId，避免以新身份加入同一房间
    const { loadStateFromCache } = await import('../services/stateCache');
    const cache = loadStateFromCache();
    let playerId;
    if (cache?.state?.playerId && cache?.state?.roomCode === sanitizedCode) {
      playerId = cache.state.playerId;
      console.log('[GameStore] Reusing cached playerId for room', sanitizedCode, ':', playerId);
    } else {
      playerId = generatePlayerId();
    }

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = sanitizedCode;
    gameState.isHost = false;

    await p2p.joinRoom(sanitizedCode, sanitizedName);

    setupGuestHandlers();

    sendJoinRequest(playerId, sanitizedName);
    startJoinRetryInterval(() => {
      if (gameState.connected || gameState.screen !== 'menu') {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(playerId, sanitizedName);
    }, 2000);

    startJoinTimeout(() => {
      if (!gameState.connected || gameState.screen === 'menu') {
        const errMsg = '连接超时：房主未响应，请确认房间号正确或重试';
        console.warn('[GameStore] Join timeout: no response from host');
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
    const msg = error.message || '加入房间失败';
    gameState.error = msg;
    gameState.connecting = false;
    showToast(`加入房间失败：${msg}`, 'error');
    cleanup();
    return false;
  }
}

export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    setConnectionStatus('error', '无法重连：缺少房间信息');
    return false;
  }

  try {
    setConnectionStatus('reconnecting', '正在重新连接...');
    gameState.connecting = true;
    gameState.connected = false;

    p2p.softDisconnect();

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
    startJoinRetryInterval(() => {
      if (gameState.connected) {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(gameState.playerId, gameState.playerName, true);
    }, 2000);

    startJoinTimeout(() => {
      if (!gameState.connected) {
        const errMsg = '重连超时：房主可能已离线，请稍后重试或重新加入房间';
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
  cleanup({ forceStatusReset: true });
  gameState.screen = 'menu';
}

// ── Game Operations ───────────────────────────────────────────────────────────

export function handleStartGame() {
  if (!gameState.isHost) return;
  startGame(getRoom());
  schedulePickingTimeout();
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_STORY, { playerId: gameState.playerId });
}

export function handleSubmitStorySelection(cardIndex, clue) {
  clearPickingTimer();
  const { value: sanitizedClue, error: clueError } = sanitizeStoryClue(clue);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }
  const result = submitStorySelection(getRoom(), gameState.playerId, cardIndex, sanitizedClue);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_STORY, {
    playerId: gameState.playerId,
    cardIndex,
    clue: sanitizedClue
  });
  scheduleHostTimerForCurrentPhase();
  return true;
}

export function handleSubmitCard(cardIndex) {
  const result = submitCard(getRoom(), gameState.playerId, cardIndex);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_CARD, {
    playerId: gameState.playerId,
    cardIndex
  });
  if (getRoom().phase === GAME_PHASES.REVEALING) {
    clearOthersPickingTimer();
    scheduleVotingTimeout();
  }
  return true;
}

export function handleSubmitVote(votedCardId) {
  const result = submitVote(getRoom(), gameState.playerId, votedCardId);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_VOTE, {
    playerId: gameState.playerId,
    votedCardId
  });
  return true;
}

export function handleNextRound() {
  if (!gameState.isHost) return;
  clearScoringTimer();
  if (getRoom().status === GAME_PHASES.ENDED) {
    restartGame(getRoom());
  } else {
    const result = nextRound(getRoom());
    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }
  }
  broadcastState();
  if (getRoom().phase === GAME_PHASES.STORYTELLER_PICKING) {
    schedulePickingTimeout();
  }
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export function handleEndGame() {
  if (!gameState.isHost) return;
  clearScoringTimer();
  clearPickingTimer();
  clearOthersPickingTimer();
  clearVotingTimer();
  clearOfflineTickTimer();
  getRoom().gameState.winner = null;
  getRoom().status = GAME_PHASES.ENDED;
  getRoom().phase = GAME_PHASES.ENDED;
  getRoom().updatedAt = Date.now();
  broadcastState();
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup({ forceStatusReset = false } = {}) {
  flushCache();
  p2p.stopHeartbeat();
  p2p.disconnect();
  hostMigrator.resetMigrationMutex();
  resetAllTimers();
  setRoom(null);
  gameState.connected = false;
  gameState.connecting = false;
  // Keep gameState.error — it contains the last error message for display.
  gameState.playerId = null;
  gameState.playerName = '';
  gameState.roomCode = null;
  gameState.isHost = false;
  if (forceStatusReset || gameState.connectionStatus !== 'error') {
    setConnectionStatus('disconnected', '');
  }

  gameState.room = {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  };

  clearCache();
}

// ── Re-exports（保持组件 import 路径与公共 API 稳定） ──────────────────────────
export { gameState, restoreFromCache, hasRestoreableState };
export { GAME_PHASES };
export { RECONNECT_METADATA } from './network';
