// ── 门面 + 意图层（gomoku，服务器权威 / WebSocket）─────────────────────────
// 保持组件的 import 路径与公共 API 稳定。
// 所有操作退化为向服务器发意图；建房/加入/重连都通过 WebSocket 传输层。
// 回合结算、超时判负、胜负判定由服务器权威处理。

import { GAME_PHASES, generatePlayerId } from '../services/gameEngine';
import { sanitizePlayerName, sanitizeRoomCode } from '../services/sanitize';
import { showToast } from '../../../../src/shared/components/ToastNotification.vue';

import {
  gameState,
  setConnectionStatus,
  resetLocalState,
  restoreFromCache,
  hasRestoreableState,
  clearCache,
  flushCache,
  RECONNECT_METADATA,
  cleanupNetwork,
  connectCreate,
  connectJoin,
  sendIntent
} from './state';

// ── High-Level API ────────────────────────────────────────────────────────────

export function createRoom(name) {
  const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
  if (nameError) {
    showToast(nameError, 'warning');
    return false;
  }
  gameState.error = null;
  setConnectionStatus('connecting', '正在创建房间...');
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
  setConnectionStatus('connecting', '正在连接房间...');
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
  // 同 playerId 重新 JOIN；服务器识别为重连并恢复在线
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

export function handlePlaceStone(row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  return sendIntent('PLACE_STONE', { row, col });
}

export function handleResign() {
  return sendIntent('RESIGN');
}

export function handleEndGame() {
  if (!gameState.isHost) return false;
  return sendIntent('END_GAME');
}

export function handleRestart() {
  if (!gameState.isHost) return false;
  return sendIntent('RESTART_GAME');
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup() {
  flushCache();
  cleanupNetwork();
  resetLocalState();
  clearCache();
}

// ── Re-exports（保持组件 import 路径与公共 API 稳定）──────────────────────────
export { gameState, restoreFromCache, hasRestoreableState, RECONNECT_METADATA };
export { GAME_PHASES };
