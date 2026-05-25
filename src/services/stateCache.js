// 状态缓存服务 - 用于页面刷新后恢复游戏状态
const CACHE_KEY = 'codenames_state_cache';
const CACHE_VERSION = '1';

// 需要缓存的状态字段
const CACHE_FIELDS = [
  'playerId',
  'playerName',
  'roomCode',
  'isHost',
  'team',
  'screen',
  'connectionStatus'
];

// 需要缓存的房间字段
const CACHE_ROOM_FIELDS = [
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
];

export function saveStateToCache(state) {
  try {
    const cache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      state: {},
      room: {}
    };

    // 缓存核心状态
    CACHE_FIELDS.forEach(field => {
      if (state[field] !== undefined) {
        cache.state[field] = state[field];
      }
    });

    // 缓存房间状态
    if (state.room) {
      CACHE_ROOM_FIELDS.forEach(field => {
        if (state.room[field] !== undefined) {
          cache.room[field] = state.room[field];
        }
      });
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('[StateCache] State saved to cache');
  } catch (err) {
    console.error('[StateCache] Failed to save state:', err);
  }
}

export function loadStateFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cache = JSON.parse(cached);

    // 版本检查
    if (cache.version !== CACHE_VERSION) {
      console.log('[StateCache] Cache version mismatch, clearing');
      clearStateCache();
      return null;
    }

    // 检查缓存是否过期（30分钟）
    const CACHE_MAX_AGE = 30 * 60 * 1000;
    if (Date.now() - cache.timestamp > CACHE_MAX_AGE) {
      console.log('[StateCache] Cache expired, clearing');
      clearStateCache();
      return null;
    }

    console.log('[StateCache] State loaded from cache');
    return cache;
  } catch (err) {
    console.error('[StateCache] Failed to load state:', err);
    return null;
  }
}

export function clearStateCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[StateCache] Cache cleared');
  } catch (err) {
    console.error('[StateCache] Failed to clear cache:', err);
  }
}

export function hasCachedState() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const cache = JSON.parse(cached);
    const CACHE_MAX_AGE = 30 * 60 * 1000;

    return cache.version === CACHE_VERSION &&
           (Date.now() - cache.timestamp) <= CACHE_MAX_AGE;
  } catch {
    return false;
  }
}
