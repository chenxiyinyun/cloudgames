// 薄封装 — 核心实现在 src/shared/online/stateCache.js
import { createStateCache } from '../../../../src/shared/online/stateCache';

const cache = createStateCache({
  cacheKey: 'catguess_state_cache',
  stateFields: [
    'playerId',
    'playerName',
    'roomCode',
    'isHost',
    'screen',
    'connectionStatus'
  ],
  roomFields: [
    'players',
    'phase',
    'status',
    'gameState',
    'disconnectedPlayers',
    'savedPhase',
    'savedStorytellerId'
  ]
});

export const saveStateToCache = cache.saveStateToCache;
export const flushStateCache = cache.flushStateCache;
export const cancelPendingSave = cache.cancelPendingSave;
export const loadStateFromCache = cache.loadStateFromCache;
export const clearStateCache = cache.clearStateCache;
export const hasCachedState = cache.hasCachedState;
