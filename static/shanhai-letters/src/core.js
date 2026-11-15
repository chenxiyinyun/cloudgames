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
    now: () => Date.now(),
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

  function defaultBeastState() {
    return {
      insight: 0, insightExp: 0, travels: 0,
      memory: {},          // 回信/事件写入的记忆（key -> 累计值）
      memoryOrder: [],     // 记忆写入顺序，最近的在最后（用于归因回显）
      visited: {}, insightShown: 0,
      petCount: 0
    };
  }

  function defaultState() {
    const beasts = {};
    SH.BEASTS.forEach((b) => (beasts[b.id] = defaultBeastState()));
    return {
      v: 1,
      createdAt: util.now(),
      beasts,
      inventory: {},          // itemId -> 数量
      souvenirs: {},          // souId  -> 数量
      placed: {},             // slot(0..11) -> souId
      seenEvents: {},         // eventId -> true
      letters: [],            // 收件箱
      trips: {},              // beastId -> 旅行对象
      worldFlags: {},         // 世界解锁标记
      visitors: {},           // visitorId -> true
      visitorBonus: {},       // 访客带来的事件权重加成 tag -> 倍率
      hourglass: { day: '', used: 0 },   // 静心沙漏每日限次
      settings: { fastMode: false, muted: false }
    };
  }

  SH.state = null;

  SH.newState = defaultState;

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  /** 只复制自有、安全的键，避免导入 JSON 里的 __proto__ 污染对象 */
  function plainObject(src) {
    const out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach((k) => {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      out[k] = src[k];
    });
    return out;
  }

  /** 把任意来源的存档补全成当前版本结构；strict 用于导入时给出明确错误 */
  function normalizeState(raw, strict) {
    const fail = (msg) => {
      if (strict) throw new Error(msg);
      return defaultState();
    };
    if (!isObj(raw)) return fail('存档格式不正确');
    if (!isObj(raw.beasts)) return fail('存档缺少神兽数据');

    const s = defaultState();
    s.v = 1;
    s.createdAt = Number(raw.createdAt) || s.createdAt;

    s.beasts = {};
    SH.BEASTS.forEach((b) => {
      const cur = plainObject(raw.beasts[b.id]);
      const bs = Object.assign(defaultBeastState(), cur);
      bs.insight = util.clamp(Number(bs.insight) || 0, 0, 3);
      bs.insightExp = Math.max(0, Number(bs.insightExp) || 0);
      bs.travels = Math.max(0, Number(bs.travels) || 0);
      const rawMem = isObj(bs.memory) ? bs.memory : {};
      bs.memory = {};
      Object.keys(rawMem).forEach((k) => {
        const n = Math.max(0, Number(rawMem[k]) || 0);
        if (n > 0) bs.memory[String(k)] = n;
      });
      bs.memoryOrder = (Array.isArray(bs.memoryOrder) ? bs.memoryOrder : Object.keys(bs.memory))
        .filter((k) => typeof k === 'string' && bs.memory[k] != null);
      bs.visited = isObj(bs.visited) ? bs.visited : {};
      bs.petCount = Math.max(0, Math.floor(Number(bs.petCount) || 0));
      s.beasts[b.id] = bs;
    });

    ['inventory', 'souvenirs', 'placed', 'seenEvents', 'worldFlags', 'visitors', 'visitorBonus', 'trips'].forEach((k) => {
      s[k] = plainObject(raw[k]);
    });
    Object.keys(s.souvenirs).forEach((id) => {
      const n = Math.floor(Number(s.souvenirs[id]) || 0);
      if (n > 0) s.souvenirs[id] = n;
      else delete s.souvenirs[id];
    });
    Object.keys(s.inventory).forEach((id) => {
      const n = Math.floor(Number(s.inventory[id]) || 0);
      if (n > 0) s.inventory[id] = n;
      else delete s.inventory[id];
    });
    Object.keys(s.placed).forEach((slot) => {
      const i = Number(slot);
      if (!Number.isInteger(i) || i < 0 || i >= 12 || typeof s.placed[slot] !== 'string') delete s.placed[slot];
    });
    Object.keys(s.trips).forEach((bid) => {
      const t = s.trips[bid];
      if (!isObj(t) || !Array.isArray(t.stops) || !Number.isFinite(Number(t.returnAt))) {
        delete s.trips[bid];
        return;
      }
      t.items = Array.isArray(t.items) ? t.items : [];
      t.returnAt = Number(t.returnAt);
      t.departAt = Number(t.departAt) || t.returnAt;
      t.stops = t.stops.filter((st) => isObj(st) && typeof st.city === 'string');
    });

    s.letters = Array.isArray(raw.letters)
      ? raw.letters
          .filter((l) => isObj(l) && l.id)
          .map((l) => {
            const replyOpts = Array.isArray(l.reply)
              ? l.reply.filter((r) => isObj(r)).map((r) => ({
                  text: String(r.text || ''),
                  memory: isObj(r.memory)
                    ? Object.fromEntries(Object.entries(r.memory)
                        .map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
                        .filter(([, v]) => v > 0))
                    : null
                }))
              : [];
            const reply = replyOpts.length ? replyOpts : null;
            let replied = Number.isInteger(l.replied) ? l.replied : null;
            if (!reply || replied == null || replied < 0 || replied >= reply.length) replied = null;
            return Object.assign(plainObject(l), {
              id: String(l.id),
              beastName: String(l.beastName || ''),
              cityName: String(l.cityName || '山海驿站'),
              title: String(l.title || '无题'),
              body: String(l.body || ''),
              at: Number(l.at) || Date.now(),
              causes: Array.isArray(l.causes) ? l.causes.filter((c) => typeof c === 'string') : [],
              reply,
              replied
            });
          })
      : [];

    s.settings = Object.assign({ fastMode: false, muted: false }, plainObject(raw.settings));
    s.settings.fastMode = !!s.settings.fastMode;
    s.settings.muted = !!s.settings.muted;
    s.hourglass = Object.assign({ day: '', used: 0 }, plainObject(raw.hourglass));
    s.hourglass.day = String(s.hourglass.day || '');
    s.hourglass.used = Math.max(0, Math.floor(Number(s.hourglass.used) || 0));
    Object.keys(s.visitorBonus).forEach((k) => {
      const n = Number(s.visitorBonus[k]);
      if (Number.isFinite(n) && n > 0) s.visitorBonus[k] = n;
      else delete s.visitorBonus[k];
    });
    s.lastSupply = Number(s.lastSupply) || 0;
    return s;
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
