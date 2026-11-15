/* 云存档纯逻辑：元数据解析、同步裁决、埋点队列、退避
   不碰 DOM/网络，便于在 Node 里直接测（globalThis.SHANHAI_CLOUD_CORE）。
------------------------------------------------------------------ */
(function () {
  const META_KEY = 'shanhai-letters:cloud:v1';
  const QUEUE_LIMIT = 100;
  const EVENT_NAME_MAX = 32;
  const MAX_BACKOFF = 60 * 1000;
  const MIN_BACKOFF = 2 * 1000;

  function parseMeta(raw) {
    const base = { token: '', code: '', profileId: '', rev: 0, dirty: false, lastSyncAt: 0 };
    let src = raw;
    if (typeof raw === 'string') {
      try { src = JSON.parse(raw); } catch { src = null; }
    }
    if (!src || typeof src !== 'object' || Array.isArray(src)) return base;
    const token = typeof src.token === 'string' ? src.token : '';
    const rev = Number(src.rev);
    return {
      token: token.length >= 20 && token.length <= 100 ? token : '',
      code: typeof src.code === 'string' ? src.code.slice(0, 8) : '',
      profileId: typeof src.profileId === 'string' ? src.profileId : '',
      rev: Number.isInteger(rev) && rev >= 0 ? rev : 0,
      dirty: !!src.dirty,
      lastSyncAt: Number(src.lastSyncAt) || 0
    };
  }

  /**
   * 启动时本地/云端如何收敛。
   * @returns {'none'|'push'|'pull'|'conflict'}
   */
  function decideSync({ remoteRev = 0, localRev = 0, localDirty = false, remoteHasState = false, localFresh = false } = {}) {
    if (!remoteHasState) return localFresh ? 'none' : 'push';
    if (remoteRev > localRev) return localFresh ? 'pull' : 'conflict';
    if (remoteRev === localRev) return localDirty ? 'push' : 'none';
    return 'conflict';
  }

  function nextBackoff(current) {
    const base = Number.isFinite(Number(current)) && Number(current) >= MIN_BACKOFF ? Number(current) : MIN_BACKOFF;
    return Math.min(base * 2, MAX_BACKOFF);
  }

  /**
   * 埋点队列：满了丢最旧；发送失败保留（离线补传），不抛错。
   */
  function createEventQueue({ send, limit = QUEUE_LIMIT, now = () => Date.now(), maxBatch = 100 } = {}) {
    const items = [];
    let flushing = null;

    function push(name, props) {
      const label = String(name || '').slice(0, EVENT_NAME_MAX);
      if (!label) return items.length;
      items.push({ name: label, props: props && typeof props === 'object' ? props : undefined, ts: now() });
      while (items.length > limit) items.shift();
      return items.length;
    }

    async function flush() {
      if (flushing) return flushing;
      if (!items.length) return { ok: true, sent: 0 };
      flushing = (async () => {
        let sent = 0;
        try {
          while (items.length) {
            const batch = items.slice(0, maxBatch);
            await send(batch);
            items.splice(0, batch.length);
            sent += batch.length;
          }
          return { ok: true, sent };
        } catch (err) {
          return { ok: false, sent, error: err };
        } finally {
          flushing = null;
        }
      })();
      return flushing;
    }

    return {
      push,
      flush,
      size: () => items.length,
      peek: () => items.slice()
    };
  }

  const api = { META_KEY, QUEUE_LIMIT, parseMeta, decideSync, nextBackoff, createEventQueue };
  globalThis.SHANHAI_CLOUD_CORE = api;
})();
