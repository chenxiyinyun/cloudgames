/* 存档结构与归一化（前后端共用）
   浏览器：普通 script 加载，挂到 window.SHSaveSchema
   Node / ESM：side-effect import 后读取 globalThis.SHSaveSchema
   SAVE_MAX_BYTES 同时被服务端体积校验与客户端提示复用。
------------------------------------------------------------------ */
(function () {
  const SAVE_MAX_BYTES = 1024 * 1024;
  const TRAIT_KEYS = ['scholar', 'empathy', 'calm', 'food', 'brave'];
  const DEFAULT_STAMPS = ['jianzi', 'pingan', 'shanhai'];
  const VALID_TIMES = ['auto', 'dawn', 'noon', 'dusk', 'night'];

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

  function defaultTraits() {
    return { scholar: 0, empathy: 0, calm: 0, food: 0, brave: 0 };
  }

  function defaultBeastState(unlocked = true) {
    return {
      unlocked: !!unlocked,
      insight: 0,
      insightExp: 0,
      travels: 0,
      memory: {},          // 回信/事件写入的记忆（key -> 累计值）
      memoryOrder: [],     // 记忆写入顺序，最近的在最后（用于归因回显）
      visited: {},
      insightShown: 0,
      petCount: 0,
      traits: defaultTraits(),
      equippedQuirk: null,
      unlockedQuirks: [],
      bonds: {}
    };
  }

  function createDefaultState(beastIds) {
    const beasts = {};
    (beastIds || []).forEach((id) => {
      beasts[id] = defaultBeastState(id !== 'jingwei');
    });
    return {
      v: 2,
      createdAt: Date.now(),
      beasts,
      inventory: {},          // itemId -> 数量
      materials: {},          // materialId -> 数量（庭院采摘灵材）
      souvenirs: {},          // souId  -> 数量
      placed: {},             // slot(0..11) -> souId
      seenEvents: {},         // eventId -> true
      letters: [],            // 收件箱
      trips: {},              // beastId -> 旅行对象
      worldFlags: {},         // 世界解锁标记
      visitors: {},           // visitorId -> true（历史已相识访客）
      visitorBonus: {},       // 访客带来的事件权重加成 tag -> 倍率
      activeVisitors: [],     // 今日庭院茶会驻留访客
      visitorDay: '',         // 访客轮换日期
      commissions: {},        // 跨城故人心愿委托进度
      stamps: DEFAULT_STAMPS.slice(), // 已收集山海朱砂闲章
      seasonIdx: 0,           // 八节气索引 0..7
      timeOfDay: 'auto',      // auto | dawn | noon | dusk | night
      postcards: [],          // 旅途留影拍立得
      hourglass: { day: '', used: 0 },   // 静心沙漏每日限次
      lastSupply: 0,
      settings: { fastMode: false, muted: false, ambientMuted: false, haptics: true }
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function normalizeCountMap(obj) {
    const out = {};
    if (!isObj(obj)) return out;
    Object.keys(obj).forEach((id) => {
      if (UNSAFE_KEYS.indexOf(id) >= 0) return;
      const n = Math.floor(Number(obj[id]) || 0);
      if (n > 0) out[String(id)] = n;
    });
    return out;
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
    s.v = 2;
    s.createdAt = Number(raw.createdAt) || s.createdAt;

    s.beasts = {};
    beastIds.forEach((id) => {
      const cur = plainObject(raw.beasts[id]);
      const baseUnlocked = id !== 'jingwei';
      const bs = Object.assign(defaultBeastState(baseUnlocked), cur);
      if (cur.unlocked !== undefined) {
        bs.unlocked = !!cur.unlocked;
      } else if (id === 'jingwei' && (Number(cur.travels) > 0 || Number(cur.insightExp) > 0)) {
        bs.unlocked = true;
      }
      bs.insight = clamp(Number(bs.insight) || 0, 0, 5);
      bs.insightExp = Math.max(0, Number(bs.insightExp) || 0);
      bs.travels = Math.max(0, Number(bs.travels) || 0);
      bs.insightShown = Math.max(0, Math.floor(Number(bs.insightShown) || 0));

      const rawMem = isObj(bs.memory) ? bs.memory : {};
      bs.memory = {};
      Object.keys(rawMem).forEach((k) => {
        if (UNSAFE_KEYS.indexOf(k) >= 0) return;
        const n = Math.max(0, Number(rawMem[k]) || 0);
        if (n > 0) bs.memory[String(k)] = n;
      });
      bs.memoryOrder = (Array.isArray(bs.memoryOrder) ? bs.memoryOrder : Object.keys(bs.memory))
        .filter((k) => typeof k === 'string' && bs.memory[k] != null);
      bs.visited = normalizeCountMap(bs.visited);
      bs.petCount = Math.max(0, Math.floor(Number(bs.petCount) || 0));

      const rawTraits = isObj(cur.traits) ? cur.traits : {};
      bs.traits = defaultTraits();
      TRAIT_KEYS.forEach((tk) => {
        bs.traits[tk] = Math.max(0, Math.floor(Number(rawTraits[tk]) || 0));
      });

      bs.unlockedQuirks = Array.isArray(cur.unlockedQuirks)
        ? [...new Set(cur.unlockedQuirks.filter((q) => typeof q === 'string' && q.length > 0))]
        : [];
      bs.equippedQuirk = typeof cur.equippedQuirk === 'string' && bs.unlockedQuirks.indexOf(cur.equippedQuirk) >= 0
        ? cur.equippedQuirk
        : null;
      bs.bonds = normalizeCountMap(cur.bonds);

      s.beasts[id] = bs;
    });

    ['inventory', 'materials', 'souvenirs', 'placed', 'seenEvents', 'worldFlags', 'visitors', 'visitorBonus', 'trips'].forEach((k) => {
      s[k] = plainObject(raw[k]);
    });
    s.souvenirs = normalizeCountMap(s.souvenirs);
    s.inventory = normalizeCountMap(s.inventory);
    s.materials = normalizeCountMap(s.materials);

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
      t.items = Array.isArray(t.items) ? t.items.filter((x) => typeof x === 'string') : [];
      t.returnAt = Number(t.returnAt);
      t.departAt = Number(t.departAt) || t.returnAt;
      t.stops = t.stops.filter((st) => isObj(st) && typeof st.city === 'string');
      t.giftSouvenir = typeof t.giftSouvenir === 'string' ? t.giftSouvenir : null;
      t.partnerId = typeof t.partnerId === 'string' ? t.partnerId : null;
    });

    s.letters = Array.isArray(raw.letters)
      ? raw.letters
          .filter((l) => isObj(l) && l.id)
          .map((l) => {
            const replyOpts = Array.isArray(l.reply)
              ? l.reply.filter((r) => isObj(r)).map((r) => ({
                  text: String(r.text || ''),
                  trait: typeof r.trait === 'string' ? r.trait : null,
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
              replied,
              opened: l.opened !== undefined ? !!l.opened : (replied != null || !!l.stage || !!l.visitor),
              stamp: typeof l.stamp === 'string' ? l.stamp : null,
              coAuthorId: typeof l.coAuthorId === 'string' ? l.coAuthorId : null,
              coAuthorName: typeof l.coAuthorName === 'string' ? l.coAuthorName : null,
              commissionId: typeof l.commissionId === 'string' ? l.commissionId : null
            });
          })
      : [];

    const rawComms = isObj(raw.commissions) ? raw.commissions : {};
    s.commissions = {};
    Object.keys(rawComms).forEach((cid) => {
      if (UNSAFE_KEYS.indexOf(cid) >= 0) return;
      const c = rawComms[cid];
      if (isObj(c)) {
        s.commissions[String(cid)] = {
          step: Math.max(0, Math.floor(Number(c.step) || 0)),
          completed: !!c.completed
        };
      }
    });

    s.activeVisitors = Array.isArray(raw.activeVisitors)
      ? [...new Set(raw.activeVisitors.filter((v) => typeof v === 'string'))]
      : [];
    s.visitorDay = typeof raw.visitorDay === 'string' ? raw.visitorDay : '';

    const stampSet = new Set(DEFAULT_STAMPS);
    if (Array.isArray(raw.stamps)) {
      raw.stamps.forEach((st) => {
        if (typeof st === 'string' && st) stampSet.add(st);
      });
    }
    s.stamps = [...stampSet];

    s.seasonIdx = clamp(Math.floor(Number(raw.seasonIdx) || 0), 0, 7);
    s.timeOfDay = VALID_TIMES.indexOf(raw.timeOfDay) >= 0 ? raw.timeOfDay : 'auto';

    s.postcards = Array.isArray(raw.postcards)
      ? raw.postcards
          .filter((p) => isObj(p) && p.id && p.cityId)
          .slice(0, 80)
          .map((p) => ({
            id: String(p.id),
            beastId: String(p.beastId || 'baize'),
            coAuthorId: typeof p.coAuthorId === 'string' ? p.coAuthorId : null,
            cityId: String(p.cityId),
            weather: typeof p.weather === 'string' ? p.weather : 'sunny',
            title: String(p.title || ''),
            caption: String(p.caption || ''),
            stamp: typeof p.stamp === 'string' ? p.stamp : null,
            at: Number(p.at) || Date.now()
          }))
      : [];

    s.settings = Object.assign({ fastMode: false, muted: false, ambientMuted: false, haptics: true }, plainObject(raw.settings));
    s.settings.fastMode = !!s.settings.fastMode;
    s.settings.muted = !!s.settings.muted;
    s.settings.ambientMuted = !!s.settings.ambientMuted;
    s.settings.haptics = s.settings.haptics !== false;

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

  const api = { SAVE_MAX_BYTES, createDefaultState, defaultBeastState, normalizeState, plainObject };
  globalThis.SHSaveSchema = api;
})();
