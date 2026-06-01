// ── LocalStorage State Cache ──────────────────────────────────────────────────
// 监听 reactive state 变化自动落盘；tab 关闭前 flush；
// 启动时从缓存恢复（玩家刷新页面可继续之前的房间）。

import { watch } from 'vue';
import {
  saveStateToCache, loadStateFromCache, clearStateCache,
  hasCachedState, flushStateCache, cancelPendingSave
} from '../services/stateCache';
import { gameState, getRoom, setRoom, updateLocalState } from './state';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStateCache(gameState);
  });
}

watch(() => ({
  screen: gameState.screen,
  playerId: gameState.playerId,
  playerName: gameState.playerName,
  roomCode: gameState.roomCode,
  isHost: gameState.isHost,
  connectionStatus: gameState.connectionStatus,
  room: gameState.room
}), (newState) => {
  if (newState.screen === 'menu') {
    cancelPendingSave();
    return;
  }
  if (newState.playerId) {
    saveStateToCache(newState);
  }
}, { deep: true });

export function restoreFromCache() {
  const cache = loadStateFromCache();
  if (!cache) return false;

  console.log('[GameStore] Restoring state from cache...');

  if (cache.state) {
    gameState.playerId = cache.state.playerId || null;
    gameState.playerName = cache.state.playerName || '';
    gameState.roomCode = cache.state.roomCode || null;
    gameState.isHost = cache.state.isHost || false;
    gameState.screen = cache.state.screen || 'menu';
    gameState.connectionStatus = cache.state.connectionStatus || 'disconnected';
  }

  if (cache.room) {
    Object.assign(gameState.room, cache.room);
  }

  if (gameState.roomCode && gameState.playerId) {
    setRoom({
      ...gameState.room,
      code: gameState.roomCode,
      hostId: gameState.isHost ? gameState.playerId : null
    });
  }

  if (getRoom()) {
    updateLocalState(getRoom());
  }

  console.log('[GameStore] State restored from cache');
  return true;
}

export function hasRestoreableState() {
  return hasCachedState();
}

export function clearCache() {
  clearStateCache();
}

export function flushCache() {
  flushStateCache(gameState);
}
