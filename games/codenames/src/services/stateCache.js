// 薄封装 — 核心实现在 src/shared/online/stateCache.js
import { createStateCache } from '../../../../src/shared/online/stateCache';

const cache = createStateCache({
  cacheKey: 'codenames_state_cache',
  stateFields: [
    'playerId',
    'playerName',
    'roomCode',
    'isHost',
    'team',
    'screen',
    'connectionStatus'
  ],
  roomFields: [
    'players',
    'teams',
    'whiteKeywords',
    'blackKeywords',
    'currentCode',
    'currentRound',
    'phase',
    'encryptor',
    'encryptorTeam',
    'clues',
    'teamVotes',
    'opponentGuess',
    'notes',
    'roundResult',
    'winner',
    'status',
    'rotationIndex',
    'disconnectedPlayers',
    'savedPhase'
  ]
});

export const saveStateToCache = cache.saveStateToCache;
export const flushStateCache = cache.flushStateCache;
export const cancelPendingSave = cache.cancelPendingSave;
export const loadStateFromCache = cache.loadStateFromCache;
export const clearStateCache = cache.clearStateCache;
export const hasCachedState = cache.hasCachedState;
