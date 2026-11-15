/* 云存档客户端（路径 A：本地优先 + 防抖异步同步）
   - 只在 http(s) 下启用；file:// 或探测失败时整体关闭，行为与纯本地完全一致
   - 写档永不阻塞：SH.save 只打个脏标记，2s 防抖后异步 PUT
   - 失败静默退避，脏标记落盘，下次启动补传（离线补传）
   - ui.js/main.js 带有其他会话的未提交改动，这里不改它们，同步状态与冲突提示自绘
------------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const CORE = window.SHANHAI_CLOUD_CORE;
  const SCHEMA = window.SHSaveSchema;
  if (!SH || !CORE || !SCHEMA) return;

  const API_BASE = (window.SHANHAI_API_BASE || '/api/shanhai').replace(/\/+$/, '');
  const SYNC_DEBOUNCE = 2000;
  const PULL_DELAY = 800;
  const TIME_REFRESH_MS = 10 * 60 * 1000;
  const EVENTS_FLUSH_MS = 30 * 1000;

  const state = {
    enabled: false,
    disabledReason: '',
    meta: CORE.parseMeta(readMeta()),
    offset: 0,
    syncTimer: 0,
    timeTimer: 0,
    inFlight: false,
    pending: false,
    backoff: 2000,
    lastError: '',
    conflict: null,
    pausePush: false,
    suppressHook: false,
    panelMessage: '',
    dom: null
  };

  /* ---------- 本地元数据 ---------- */
  function readMeta() {
    try { return localStorage.getItem(CORE.META_KEY); } catch { return null; }
  }
  function saveMeta() {
    try { localStorage.setItem(CORE.META_KEY, JSON.stringify(state.meta)); } catch { /* ignore */ }
  }
  function clearMeta() {
    state.meta = CORE.parseMeta(null);
    try { localStorage.removeItem(CORE.META_KEY); } catch { /* ignore */ }
  }

  /* ---------- 网络 ---------- */
  async function request(path, opts = {}) {
    const headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
      credentials: 'omit',
      keepalive: !!opts.keepalive
    });
    let data = null;
    if (res.status !== 204) {
      try { data = await res.json(); } catch { data = null; }
    }
    return { status: res.status, data };
  }

  function applyServerTime(serverNow) {
    const offset = Number(serverNow) - Date.now();
    if (!Number.isFinite(offset)) return;
    state.offset = offset;
    SH.clockOffset = offset;
  }

  async function refreshTime() {
    try {
      const res = await request('/time');
      if (res.status === 200 && res.data) applyServerTime(res.data.now);
    } catch { /* 授时失败保持本地时钟 */ }
  }

  /* ---------- 埋点 ---------- */
  const queue = CORE.createEventQueue({
    send: async (batch) => {
      if (!state.meta.token) throw new Error('no token');
      const res = await request('/events', {
        method: 'POST',
        token: state.meta.token,
        body: { events: batch },
        keepalive: true
      });
      if (res.status === 204 || res.status === 200) return;
      if (res.status === 401) {
        state.meta.token = '';
        saveMeta();
      }
      throw new Error('events failed: ' + res.status);
    }
  });

  function track(name, props) {
    queue.push(name, props);
    if (state.enabled && state.meta.token) queue.flush();
  }

  /* ---------- 身份 ---------- */
  function applyIdentity(data) {
    state.meta.token = data.token;
    state.meta.code = data.transferCode || state.meta.code;
    state.meta.profileId = data.profileId || state.meta.profileId;
    state.meta.rev = Number(data.rev) || 0;
    saveMeta();
  }

  async function ensureToken() {
    if (state.meta.token) return state.meta.token;
    const res = await request('/guest', { method: 'POST', body: {} });
    if (res.status !== 201 || !res.data || !res.data.token) throw new Error('guest failed: ' + res.status);
    applyIdentity(res.data);
    return state.meta.token;
  }

  /** 令牌失效：静默换新游客身份，用本地档覆盖新档案，避免玩家丢进度 */
  async function recoverToken() {
    track('token_invalid');
    clearMeta();
    state.meta.dirty = true;
    saveMeta();
    try {
      await ensureToken();
      renderPanel();
    } catch {
      retryLater('身份恢复失败');
    }
  }

  /* ---------- 同步 ---------- */
  function isFreshState() {
    const s = SH.state;
    if (!s) return true;
    return !s.letters.length && !Object.keys(s.trips).length && SH.BEASTS.every((b) => !s.beasts[b.id] || !s.beasts[b.id].travels);
  }

  function schedule(delay) {
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(() => { push(); }, delay);
  }

  function retryLater(reason) {
    state.lastError = reason || '同步失败';
    state.backoff = CORE.nextBackoff(state.backoff);
    schedule(state.backoff);
    renderPanel();
  }

  function disable(reason) {
    state.enabled = false;
    state.disabledReason = reason || '';
    clearTimeout(state.syncTimer);
    renderPanel();
  }

  /** SH.save 的钩子：只做标记与防抖，绝不影响写档本身 */
  function notifyLocalSave() {
    if (state.suppressHook || !state.enabled) return;
    state.meta.dirty = true;
    saveMeta();
    if (!state.pausePush) schedule(SYNC_DEBOUNCE);
  }

  async function push() {
    if (!state.enabled) return;
    if (state.pausePush) return;
    if (state.inFlight) { state.pending = true; return; }
    state.inFlight = true;
    try {
      await ensureToken();
      const json = JSON.stringify(SH.state);
      if (new TextEncoder().encode(json).length > SCHEMA.SAVE_MAX_BYTES) {
        disable('存档超过 1MB，已停止云同步');
        return;
      }
      const res = await request('/save', {
        method: 'PUT',
        token: state.meta.token,
        body: { rev: state.meta.rev, state: SH.state }
      });
      if (res.status === 200 && res.data) {
        state.meta.rev = Number(res.data.rev) || state.meta.rev;
        state.meta.dirty = false;
        state.meta.lastSyncAt = Date.now();
        state.backoff = 2000;
        state.lastError = '';
        saveMeta();
        track('save_sync_ok', { rev: state.meta.rev });
      } else if (res.status === 409 && res.data) {
        const localRev = state.meta.rev;
        state.meta.rev = Number(res.data.rev) || state.meta.rev;
        saveMeta();
        state.conflict = { remoteRev: state.meta.rev, localRev, updatedAt: res.data.updatedAt || 0 };
        track('save_conflict');
        openConflict();
      } else if (res.status === 401) {
        await recoverToken();
      } else if (res.status === 413) {
        disable('存档超过 1MB，已停止云同步');
      } else {
        track('save_sync_fail', { status: res.status });
        retryLater('服务端返回 ' + res.status);
      }
    } catch (err) {
      track('save_sync_fail', { offline: true });
      retryLater('网络不可用');
    } finally {
      state.inFlight = false;
      renderPanel();
      if (state.pending) {
        state.pending = false;
        schedule(state.backoff);
      }
    }
  }

  function applyRemote(data) {
    state.suppressHook = true;
    try {
      SH.state = SCHEMA.normalizeState(data.state, { beastIds: SH.BEASTS.map((b) => b.id) });
      state.meta.rev = Number(data.rev) || 0;
      state.meta.dirty = false;
      state.meta.lastSyncAt = Date.now();
      saveMeta();
      SH.save();
      if (SH.sys && typeof SH.sys.refreshVisitors === 'function') SH.sys.refreshVisitors(SH.state);
      if (SH.ui && typeof SH.ui.render === 'function') SH.ui.render();
    } finally {
      state.suppressHook = false;
    }
    renderPanel();
  }

  async function fetchRemote() {
    const res = await request('/save', { token: state.meta.token });
    if (res.status === 401) { await recoverToken(); return null; }
    if (res.status !== 200 || !res.data) throw new Error('save fetch failed: ' + res.status);
    return res.data;
  }

  async function pullOnStart() {
    try {
      if (!state.meta.token) {
        if (!isFreshState()) await push();
        return;
      }
      const remote = await fetchRemote();
      if (!remote) return;
      const decision = CORE.decideSync({
        remoteRev: Number(remote.rev) || 0,
        localRev: state.meta.rev,
        localDirty: state.meta.dirty,
        remoteHasState: !!remote.state,
        localFresh: isFreshState()
      });
      if (decision === 'pull') applyRemote(remote);
      else if (decision === 'push') await push();
      else if (decision === 'conflict') {
        const localRev = state.meta.rev;
        state.meta.rev = Number(remote.rev) || 0;
        saveMeta();
        state.conflict = { remoteRev: Number(remote.rev) || 0, localRev, updatedAt: remote.updatedAt || 0 };
        openConflict();
      }
    } catch {
      retryLater('云端存档拉取失败');
    }
  }

  /* ---------- 面板 / 冲突提示 ---------- */
  function fmtTime(ts) {
    if (!ts) return '未知';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function statusText() {
    if (!state.enabled) return state.disabledReason || '仅本地存档';
    if (state.conflict) return '云端有更新，待你选择';
    if (state.inFlight) return '正在同步…';
    if (state.meta.dirty) return '本地有改动，待同步' + (state.lastError ? `（${state.lastError}）` : '');
    if (state.meta.lastSyncAt) return '已同步 · ' + fmtTime(state.meta.lastSyncAt);
    return '已连接，尚无云端存档';
  }

  function injectStyle() {
    if (document.getElementById('shc-style')) return;
    const style = document.createElement('style');
    style.id = 'shc-style';
    style.textContent = `
      #shc-chip{position:fixed;right:10px;bottom:calc(env(safe-area-inset-bottom, 0px) + 84px);z-index:70;
        display:flex;align-items:center;gap:6px;padding:6px 10px;border:0;border-radius:999px;
        background:var(--paper,#f6ecdb);color:var(--ink,#453729);font-size:12px;line-height:1;
        box-shadow:0 2px 8px rgba(69,55,41,.18);cursor:pointer;opacity:.92}
      #shc-chip .dot{width:7px;height:7px;border-radius:50%;background:#7d9b7e}
      #shc-chip.is-warn .dot{background:#c0563f}
      #shc-panel{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom, 0px) + 76px);transform:translateX(-50%);
        z-index:75;width:min(360px,calc(100vw - 20px));padding:14px 14px 12px;border-radius:18px;
        background:var(--paper,#f6ecdb);color:var(--ink,#453729);font-size:13px;line-height:1.6;
        box-shadow:0 10px 30px rgba(69,55,41,.28);display:none}
      #shc-panel.is-open{display:block}
      #shc-panel h3{margin:0 0 6px;font-size:15px;font-weight:600}
      #shc-panel .row{display:flex;align-items:center;gap:8px;margin:6px 0;flex-wrap:wrap}
      #shc-panel .row>span{color:var(--muted,#77624f);min-width:52px}
      #shc-panel code{font-family:inherit;letter-spacing:.12em;font-size:14px;background:var(--paper-2,#efe2cb);
        padding:2px 8px;border-radius:8px}
      #shc-panel input{flex:1;min-width:90px;padding:6px 8px;border-radius:10px;border:1px solid #d9c9ad;
        background:#fdf7ea;color:inherit;font-size:13px;letter-spacing:.1em}
      #shc-panel button{border:0;border-radius:10px;padding:6px 12px;font-size:12.5px;cursor:pointer;
        background:var(--paper-2,#efe2cb);color:var(--cinnabar-ink,#a8442f)}
      #shc-panel button.primary{background:var(--cinnabar,#c0563f);color:#fff}
      #shc-panel .status{padding:6px 10px;border-radius:10px;background:rgba(125,155,126,.14);margin-bottom:8px}
      #shc-panel .hint{color:var(--muted,#77624f);font-size:11.5px;margin-top:8px}
      #shc-panel .close{position:absolute;top:8px;right:10px;background:transparent;font-size:16px;line-height:1;color:var(--muted,#77624f)}
      #shc-mask{position:fixed;inset:0;z-index:80;background:rgba(69,55,41,.32);display:none;
        align-items:center;justify-content:center;padding:20px}
      #shc-mask.is-open{display:flex}
      #shc-card{width:min(380px,100%);padding:18px;border-radius:20px;background:var(--paper,#f6ecdb);
        color:var(--ink,#453729);font-size:13.5px;line-height:1.7;box-shadow:0 16px 40px rgba(69,55,41,.35)}
      #shc-card h3{margin:0 0 8px;font-size:16px}
      #shc-card p{margin:0 0 10px}
      #shc-card button{display:block;width:100%;margin-top:8px;padding:9px 12px;border:0;border-radius:12px;
        font-size:13.5px;cursor:pointer;background:var(--paper-2,#efe2cb);color:var(--cinnabar-ink,#a8442f)}
      #shc-card button.primary{background:var(--cinnabar,#c0563f);color:#fff}
      #shc-card button.ghost{background:transparent;color:var(--muted,#77624f)}
    `;
    document.head.appendChild(style);
  }

  function buildDom() {
    if (state.dom) return state.dom;
    injectStyle();

    const chip = document.createElement('button');
    chip.id = 'shc-chip';
    chip.type = 'button';
    chip.innerHTML = '<span class="dot"></span><span>云存档</span>';
    chip.addEventListener('click', () => togglePanel());

    const panel = document.createElement('div');
    panel.id = 'shc-panel';
    panel.innerHTML = `
      <button class="close" data-shc="close" aria-label="关闭">×</button>
      <h3>云存档</h3>
      <div class="status" id="shc-status"></div>
      <div class="row"><span>转移码</span><code id="shc-code">—</code><button data-shc="copy">复制</button></div>
      <div class="row"><span>换设备</span><input id="shc-code-input" maxlength="6" placeholder="输入 6 位转移码"/><button data-shc="bind">绑定</button></div>
      <div class="row"><button class="primary" data-shc="sync">立即同步</button></div>
      <div class="hint" id="shc-hint">本地优先：断网时照常游玩，联网后自动补传。</div>
    `;

    const mask = document.createElement('div');
    mask.id = 'shc-mask';
    mask.innerHTML = `
      <div id="shc-card">
        <h3>云端与本地不一致</h3>
        <p id="shc-conflict-text"></p>
        <button class="primary" data-shc="use-cloud">用云端存档（覆盖本地）</button>
        <button data-shc="use-local">保留本地（覆盖云端）</button>
        <button class="ghost" data-shc="later">稍后再说</button>
      </div>
    `;

    document.body.appendChild(chip);
    document.body.appendChild(panel);
    document.body.appendChild(mask);

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-shc]');
      if (!el) return;
      handlePanelAction(el.dataset.shc);
    });
    mask.addEventListener('click', (e) => {
      if (e.target === mask) closeConflict();
    });

    state.dom = { chip, panel, mask };
    return state.dom;
  }

  function togglePanel() {
    if (!state.dom) return;
    state.dom.panel.classList.toggle('is-open');
    renderPanel();
  }

  function renderPanel() {
    if (!state.dom) return;
    const { chip, panel } = state.dom;
    const warn = !state.enabled || !!state.conflict || !!state.meta.dirty;
    chip.classList.toggle('is-warn', warn);
    chip.style.display = state.enabled ? 'flex' : 'none';
    const statusEl = panel.querySelector('#shc-status');
    if (statusEl) statusEl.textContent = statusText();
    const codeEl = panel.querySelector('#shc-code');
    if (codeEl) codeEl.textContent = state.meta.code || '—';
    const hintEl = panel.querySelector('#shc-hint');
    if (hintEl) hintEl.textContent = state.panelMessage || '本地优先：断网时照常游玩，联网后自动补传。';
  }

  function openConflict() {
    if (!state.dom || !state.conflict) return;
    const text = state.dom.mask.querySelector('#shc-conflict-text');
    if (text) {
      text.textContent = `云端存档已更新到第 ${state.conflict.remoteRev} 版（${fmtTime(state.conflict.updatedAt)}），本地也有未上传的改动。请选择保留哪一份，未选中的那一步进度会丢失。`;
    }
    state.dom.mask.classList.add('is-open');
    renderPanel();
  }

  function closeConflict() {
    if (state.dom) state.dom.mask.classList.remove('is-open');
  }

  async function handlePanelAction(action) {
    if (action === 'close') {
      state.dom.panel.classList.remove('is-open');
      return;
    }
    if (action === 'copy') {
      const code = state.meta.code;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        state.panelMessage = '转移码已复制：' + code;
      } catch {
        state.panelMessage = '转移码：' + code + '（请手动记录）';
      }
      renderPanel();
      return;
    }
    if (action === 'bind') {
      const input = state.dom.panel.querySelector('#shc-code-input');
      const code = (input && input.value || '').trim().toUpperCase();
      if (code.length !== 6) {
        state.panelMessage = '请输入 6 位转移码';
        renderPanel();
        return;
      }
      await bindCode(code);
      return;
    }
    if (action === 'sync') {
      state.pausePush = false;
      state.panelMessage = '';
      await refreshTime();
      await pullOnStart();
      await push();
      return;
    }
    if (action === 'use-cloud') {
      try {
        const remote = await fetchRemote();
        if (remote && remote.state) {
          applyRemote(remote);
          state.conflict = null;
          closeConflict();
          state.panelMessage = '已采用云端存档';
        }
      } catch {
        state.panelMessage = '拉取云端存档失败，请稍后再试';
      }
      renderPanel();
      return;
    }
    if (action === 'use-local') {
      const baseRev = state.conflict ? state.conflict.remoteRev : state.meta.rev;
      state.conflict = null;
      closeConflict();
      state.meta.rev = baseRev;
      state.meta.dirty = true;
      state.pausePush = false;
      saveMeta();
      await push();
      state.panelMessage = '已用本地存档覆盖云端';
      renderPanel();
      return;
    }
    if (action === 'later') {
      state.pausePush = true;
      closeConflict();
      state.panelMessage = '已暂缓，本地改动不会上传；点「立即同步」可重试。';
      renderPanel();
    }
  }

  async function bindCode(code) {
    try {
      const res = await request('/guest', { method: 'POST', body: { transferCode: code } });
      if (res.status !== 200 || !res.data || !res.data.token) {
        state.panelMessage = '转移码无效或服务暂不可用';
        renderPanel();
        return;
      }
      applyIdentity(res.data);
      state.meta.dirty = false;
      state.meta.lastSyncAt = 0;
      saveMeta();
      const remote = await fetchRemote();
      if (remote && remote.state) {
        applyRemote(remote);
        state.panelMessage = '已绑定并拉取云端存档';
      } else {
        state.panelMessage = '已绑定，云端暂无存档';
      }
    } catch {
      state.panelMessage = '绑定失败，请检查网络';
    }
    renderPanel();
  }

  /* ---------- 启动 ---------- */
  async function init() {
    buildDom();
    if (location.protocol === 'file:') {
      disable('本地文件打开，云存档不可用');
      return;
    }
    try {
      const res = await request('/time');
      if (res.status !== 200 || !res.data || !Number.isFinite(Number(res.data.now))) {
        disable('云存档服务不可用');
        return;
      }
      applyServerTime(res.data.now);
    } catch {
      disable('云存档服务不可用');
      return;
    }
    state.enabled = true;
    state.disabledReason = '';
    renderPanel();
    track('session_start', { fastMode: !!(SH.state && SH.state.settings && SH.state.settings.fastMode) });
    setTimeout(() => { pullOnStart(); }, PULL_DELAY);
    clearInterval(state.timeTimer);
    state.timeTimer = setInterval(refreshTime, TIME_REFRESH_MS);
    setInterval(() => { if (state.meta.token) queue.flush(); }, EVENTS_FLUSH_MS);
    window.addEventListener('online', () => {
      if (!state.enabled) return;
      refreshTime();
      pullOnStart();
    });
    window.addEventListener('pagehide', () => { queue.flush(); });
    renderPanel();
  }

  SH.cloud = {
    notifyLocalSave,
    track,
    status: () => ({ enabled: state.enabled, meta: { ...state.meta }, conflict: state.conflict ? { ...state.conflict } : null }),
    syncNow: () => { state.pausePush = false; return pullOnStart().then(() => push()); },
    openPanel: () => { if (state.dom) { state.dom.panel.classList.add('is-open'); renderPanel(); } }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
