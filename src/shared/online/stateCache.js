/**
 * 通用状态缓存工厂 — 用于页面刷新后恢复游戏状态。
 *
 * 两个游戏共享相同机制（localStorage、debounce、版本检查、30 分钟过期），
 * 只是缓存键名和字段列表不同。
 *
 * Usage:
 *   import { createStateCache } from '@/shared/online/stateCache'
 *   const cache = createStateCache({
 *     cacheKey: 'catguess_state_cache',
 *     stateFields: ['playerId', 'playerName', ...],
 *     roomFields: ['players', 'phase', ...]
 *   })
 *   cache.saveStateToCache(state)
 */
export function createStateCache({ cacheKey, cacheVersion = '1', stateFields, roomFields, cacheMaxAgeMs = 30 * 60 * 1000 }) {
  // ─── Debounce engine ──────────────────────────────────────────
  let saveTimer = null;
  const SAVE_DEBOUNCE_MS = 2000;

  function debouncedSave(state) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        doSave(state);
      } catch (err) {
        console.error(`[StateCache(${cacheKey})] Save failed:`, err);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // ─── Serialization ───────────────────────────────────────────

  function toPlainObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(toPlainObject);

    const plain = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key.startsWith('__v_') || key === '_rawValue' || key === '_value') continue;
        plain[key] = toPlainObject(obj[key]);
      }
    }
    return plain;
  }

  function doSave(state) {
    const cache = {
      version: cacheVersion,
      timestamp: Date.now(),
      state: {},
      room: {}
    };

    if (stateFields) {
      stateFields.forEach(field => {
        if (state[field] !== undefined) {
          cache.state[field] = toPlainObject(state[field]);
        }
      });
    }

    if (state.room && roomFields) {
      roomFields.forEach(field => {
        if (state.room[field] !== undefined) {
          cache.room[field] = toPlainObject(state.room[field]);
        }
      });
    }

    localStorage.setItem(cacheKey, JSON.stringify(cache));
    console.log(`[StateCache(${cacheKey})] State saved`);
  }

  // ─── Public API ──────────────────────────────────────────────

  /** Debounced save — call from Vue watchers or periodic sync */
  function saveStateToCache(state) {
    debouncedSave(state);
  }

  /** Immediate flush — call before leaveRoom / page unload */
  function flushStateCache(state) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try { doSave(state); } catch (err) {
      console.error(`[StateCache(${cacheKey})] Flush failed:`, err);
    }
  }

  /** Cancel pending debounced save */
  function cancelPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function loadStateFromCache() {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);

      if (data.version !== cacheVersion) {
        console.log(`[StateCache(${cacheKey})] Version mismatch, clearing`);
        clearStateCache();
        return null;
      }

      if (Date.now() - data.timestamp > cacheMaxAgeMs) {
        console.log(`[StateCache(${cacheKey})] Cache expired, clearing`);
        clearStateCache();
        return null;
      }

      console.log(`[StateCache(${cacheKey})] State loaded`);
      return data;
    } catch (err) {
      console.error(`[StateCache(${cacheKey})] Load failed:`, err);
      return null;
    }
  }

  function clearStateCache() {
    try {
      localStorage.removeItem(cacheKey);
      console.log(`[StateCache(${cacheKey})] Cache cleared`);
    } catch (err) {
      console.error(`[StateCache(${cacheKey})] Clear failed:`, err);
    }
  }

  function hasCachedState() {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return false;
      const data = JSON.parse(cached);
      return data.version === cacheVersion
        && (Date.now() - data.timestamp) <= cacheMaxAgeMs;
    } catch {
      return false;
    }
  }

  return { saveStateToCache, flushStateCache, cancelPendingSave, loadStateFromCache, clearStateCache, hasCachedState };
}
