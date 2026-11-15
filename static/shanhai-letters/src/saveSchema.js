/* 存档结构与归一化（前后端共用）
   浏览器：普通 script 加载，挂到 window.SHSaveSchema
   Node：ESM/CJS 直接 import 后读取 globalThis.SHSaveSchema（本文件无 export，
   只做全局赋值，所以两种加载方式都能用，且只有这一份实现）
   SAVE_MAX_BYTES 同时被服务端体积校验与客户端提示复用。
------------------------------------------------------------------ */
(function () {
  const SAVE_MAX_BYTES = 1024 * 1024;

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

  function plainObject(src) {
    const out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach((k) => {
      if (UNSAFE_KEYS.indexOf(k) >= 0) return;
      out[k] = src[k];
    });
    return out;
  }

  function defaultBeastState() {
    return {
      insight: 0, insightExp: 0, travels: 0,
      memory: {},          // 回信/事件写入的记忆（key -> 累计值）
      memoryOrder: [],     // 记忆写入顺序，最近的在最后（用于归因回显）
      visited: {}, insightShown: 0,
      petCount: 0
    };
  }

  function createDefaultState(beastIds) {
    const beasts = {};
    (beastIds || []).forEach((id) => (beasts[id] = defaultBeastState()));
    return {
      v: 1,
      createdAt: Date.now(),
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

  /**
   * 把任意来源的存档补全成当前版本结构。
   * @param {*} raw 原始数据（localStorage / 导入文件 / 云端返回）
   * @param {{strict?: boolean, beastIds?: string[]}} opts
   *   strict：true 时错误直接抛出（导入、服务端校验）；false 时回落为空档
   *   beastIds：神兽 id 列表，浏览器传入以保留完整骨架；
   *             服务端不依赖游戏数据，缺省按 raw.beasts 的键归一化
   */
  function normalizeState(raw, opts) {
    const options = opts || {};
    const strict = !!options.strict;
    const fail = (msg) => {
      if (strict) throw new Error(msg);
      return createDefaultState(Array.isArray(options.beastIds) ? options.beastIds : []);
    };
    if (!isObj(raw)) return fail('存档格式不正确');
    if (!isObj(raw.beasts)) return fail('存档缺少神兽数据');

    const beastIds = Array.isArray(options.beastIds) && options.beastIds.length
      ? options.beastIds
      : Object.keys(raw.beasts).filter((k) => UNSAFE_KEYS.indexOf(k) < 0);

    const s = createDefaultState(beastIds);
    s.v = 1;
    s.createdAt = Number(raw.createdAt) || s.createdAt;

    s.beasts = {};
    beastIds.forEach((id) => {
      const cur = plainObject(raw.beasts[id]);
      const bs = Object.assign(defaultBeastState(), cur);
      bs.insight = clamp(Number(bs.insight) || 0, 0, 3);
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
      s.beasts[id] = bs;
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
    s.lastSupply = Number(raw.lastSupply) || 0;
    return s;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  const api = { SAVE_MAX_BYTES, createDefaultState, defaultBeastState, normalizeState, plainObject };
  globalThis.SHSaveSchema = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})();
