// ── 门面：保持组件的 import 路径与公共 API 稳定（服务器权威 / WebSocket）──────
// 所有游戏操作退化为向服务器发意图；阶段超时/计分/离线处理全部在服务器 tick 权威推进。

import { GAME_PHASES, generatePlayerId } from '../services/gameEngine';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeStoryClue } from '../services/sanitize';
import { showToast } from '../components/ToastNotification.vue';

import { gameState, resetLocalStateToDefaults, setConnectionStatus } from './state';
import { restoreFromCache, hasRestoreableState, clearCache, flushCache } from './cache';
import {
  RECONNECT_METADATA,
  cleanupNetwork,
  connectCreate,
  connectJoin,
  sendIntent
} from './network';

// ── High-Level API ────────────────────────────────────────────────────────────

export function createRoom(name) {
  const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
  if (nameError) {
    showToast(nameError, 'warning');
    return false;
  }
  gameState.error = null;
  setConnectionStatus('connecting', '正在创建任务...');
  const playerId = generatePlayerId();
  gameState.playerId = playerId;
  gameState.playerName = sanitizedName;
  gameState.isHost = true; // 乐观；以 JOINED 返回的 room.hostId 为准
  connectCreate(playerId, sanitizedName);
  return true;
}

export function joinRoom(name, code) {
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
  gameState.error = null;
  setConnectionStatus('connecting', '正在连接任务...');
  const playerId = generatePlayerId();
  gameState.playerId = playerId;
  gameState.playerName = sanitizedName;
  gameState.roomCode = sanitizedCode;
  gameState.isHost = false;
  connectJoin(sanitizedCode, playerId, sanitizedName);
  return true;
}

export function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerId || !gameState.playerName) {
    setConnectionStatus('error', '无法重连：缺少房间信息');
    return false;
  }
  connectJoin(gameState.roomCode, gameState.playerId, gameState.playerName);
  return true;
}

export function leaveRoom() {
  cleanup({ forceStatusReset: true });
  gameState.screen = 'menu';
}

// ── Game Operations（全部为发意图）────────────────────────────────────────────

export function handleStartGame() {
  if (!gameState.isHost) return false;
  return sendIntent('START_GAME');
}

export function handleSubmitStorySelection(cardIndex, clue) {
  const { value: sanitizedClue, error: clueError } = sanitizeStoryClue(clue);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }
  return sendIntent('SUBMIT_STORY', { cardIndex, clue: sanitizedClue });
}

export function handleSubmitCard(cardIndex) {
  return sendIntent('SUBMIT_CARD', { cardIndex });
}

export function handleSubmitVote(votedCardId) {
  return sendIntent('SUBMIT_VOTE', { votedCardId });
}

export function handleNextRound() {
  if (!gameState.isHost) return false;
  return sendIntent('NEXT_ROUND');
}

export function handleEndGame() {
  if (!gameState.isHost) return false;
  return sendIntent('END_GAME');
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup({ forceStatusReset = false } = {}) {
  flushCache();
  cleanupNetwork();
  resetLocalStateToDefaults();
  clearCache();
  if (forceStatusReset) {
    setConnectionStatus('disconnected', '');
  }
}

// ── Re-exports（保持组件 import 路径与公共 API 稳定）──────────────────────────
export { gameState, restoreFromCache, hasRestoreableState };
export { GAME_PHASES };
export { RECONNECT_METADATA };
