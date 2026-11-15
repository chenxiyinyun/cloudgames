/* 《山海来信》核心层：随机数、工具、状态与存档 */
(function () {
  const SH = (window.SH = window.SH || {});

  /* ---------- 随机数（可复现的种子随机） ---------- */
  SH.rng = {
    hash(str) {
      let h = 2166136261 >>> 0;
      const s = String(str);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    },
    make(seed) {
      let a = SH.rng.hash(seed);
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  };

  /* ---------- 工具 ---------- */
  const util = (SH.util = {
    // 统一时钟：cloud.js 拿到服务端时间后写入 SH.clockOffset，沙漏日界/灵草冷却/行程结算都走这里
    now: () => Date.now() + (SH.clockOffset || 0),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rand: (rand, arr) => arr[Math.floor(rand() * arr.length)],
    shuffle(rand, arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** 加权随机：list 中每项需有 weight（>0） */
    weighted(rand, list) {
      const total = list.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
      if (total <= 0) return null;
      let r = rand() * total;
      for (const x of list) {
        r -= Math.max(0, x.weight || 0);
        if (r <= 0) return x;
      }
      return list[list.length - 1];
    },
    /** 交集数量 */
    overlap(a = [], b = []) {
      return a.filter((x) => b.indexOf(x) >= 0).length;
    },
    fmtDuration(ms) {
      if (ms <= 0) return '已归来';
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) return `${h} 小时 ${m % 60} 分`;
      if (m > 0) return `${m} 分 ${s % 60} 秒`;
      return `${s} 秒`;
    },
    fmtDate(ts) {
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
    },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
    }
  });

  /* ---------- 状态 ---------- */
  const SAVE_KEY = 'shanhai-letters:save:v1';
  // 归一化实现与后端共用一份（src/saveSchema.js），core 只负责传入神兽骨架
  const SCHEMA = window.SHSaveSchema;
  if (!SCHEMA) throw new Error('[山海来信] 缺少存档 schema 模块，请检查 index.html 的脚本顺序');

  const beastIds = () => SH.BEASTS.map((b) => b.id);

  SH.state = null;

  SH.newState = () => SCHEMA.createDefaultState(beastIds());

  /** 把任意来源的存档补全成当前版本结构；strict 用于导入时给出明确错误 */
  function normalizeState(raw, strict) {
    return SCHEMA.normalizeState(raw, { strict, beastIds: beastIds() });
  }
  SH.normalizeState = normalizeState;

  SH.load = function () {
    let raw = null;
    try {
      const text = localStorage.getItem(SAVE_KEY);
      if (text) raw = JSON.parse(text);
    } catch (e) {
      console.warn('[山海来信] 存档读取失败', e);
    }
    SH.state = normalizeState(raw, false);
    return SH.state;
  };

  SH.save = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(SH.state));
    } catch (e) {
      console.warn('[山海来信] 存档写入失败', e);
    }
    // 本地优先：写档永不阻塞；云端同步由 cloud.js 防抖接管，失败静默
    if (SH.cloud && typeof SH.cloud.notifyLocalSave === 'function') {
      try { SH.cloud.notifyLocalSave(); } catch (e) { /* 同步异常不影响本地存档 */ }
    }
  };

  SH.resetSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    SH.state = defaultState();
    SH.save();
  };

  SH.exportSave = function () {
    return JSON.stringify(SH.state, null, 2);
  };

  SH.importSave = function (text) {
    let s;
    try {
      s = JSON.parse(text);
    } catch (e) {
      throw new Error('这不是有效的 JSON 文件');
    }
    SH.state = normalizeState(s, true);
    SH.save();
    return true;
  };

  /* ---------- 极简事件总线 ---------- */
  const listeners = {};
  SH.on = function (evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  };
  SH.emit = function (evt, payload) {
    (listeners[evt] || []).forEach((fn) => fn(payload));
    (listeners['*'] || []).forEach((fn) => fn(evt, payload));
  };
})();
