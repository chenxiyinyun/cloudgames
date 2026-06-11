// ── High-Level API & Game Operations (codenames，服务器权威 / WebSocket)────────
// 所有操作退化为向服务器发意图；建房/加入/重连都通过 WebSocket 传输层。
// 断线暂停/恢复、两段投票、回合结算由服务器权威处理。

import { generatePlayerId } from '../services/gameEngine';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeClues } from '../services/sanitize';
import { showToast } from '../components/ToastNotification.vue';

import {
  gameState, setConnectionStatus, resetGameState, clearCache, flushCache
} from './roomState';
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
  // 同 playerId 重新 JOIN；服务器识别为重连，全员在线后自动从 PAUSED 恢复
  connectJoin(gameState.roomCode, gameState.playerId, gameState.playerName);
  return true;
}

export function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

// ── Game Operations（全部为发意图）────────────────────────────────────────────

export function handleStartGame() {
  if (!gameState.isHost) return false;
  return sendIntent('START_GAME');
}

export function handleSubmitClues(clues) {
  const { value: sanitizedClues, error: clueError } = sanitizeClues(clues);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }
  return sendIntent('SUBMIT_CLUES', { clues: sanitizedClues });
}

export function handleSubmitTeamGuess(guess) {
  return sendIntent('SUBMIT_TEAM_GUESS', { guess });
}

export function handleSubmitOpponentGuess(guess) {
  return sendIntent('SUBMIT_OPPONENT_GUESS', { guess });
}

export function handleSubmitOpponentVote(guess) {
  return sendIntent('SUBMIT_OPPONENT_VOTE', { guess });
}

export function handleSubmitTeamVote(guess) {
  return sendIntent('SUBMIT_TEAM_VOTE', { guess });
}

export function handleNextRound() {
  if (!gameState.isHost) return false;
  return sendIntent('NEXT_ROUND');
}

export function handlePlayAgain() {
  if (!gameState.isHost) return false;
  // 结束后再来一局：服务器在 ENDED 时把 NEXT_ROUND 当作 resetGame
  return sendIntent('NEXT_ROUND');
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup() {
  flushCache();
  cleanupNetwork();
  resetGameState();
  clearCache();
}

export { RECONNECT_METADATA };
