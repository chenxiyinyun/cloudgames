/* 规则引擎：旅行、事件选择、结算、回信、家园、图鉴 */
(function () {
  const SH = window.SH;
  const U = SH.util;

  const sys = (SH.sys = {});

  /* ---------- 常量 ---------- */
  const MIN = 60 * 1000;
  sys.DURATION = { base: 8 * MIN, perStop: 9 * MIN };
  sys.INSIGHT_THRESHOLD = [0, 3, 8, 15];   // 升到阶段 1/2/3 所需经验
  sys.SLOTS = 12;
  sys.HOURGLASS_LIMIT = 3;                 // 静心沙漏每日限次

  sys.CODEX_GROUPS = [
    { id: 'folk', name: '人间烟火', tags: ['food', 'social', 'night', 'city', 'playful'], goal: 12 },
    { id: 'land', name: '山河万里', tags: ['nature', 'water', 'desert', 'snow', 'star'], goal: 10 },
    /* 现有事件库里带 relic 标签的事件共 8 条，目标必须与内容量一致，否则永远到不了 100% */
    { id: 'relic', name: '古今遗珍', tags: ['history', 'ancient', 'craft', 'scholar'], goal: 8 },
    { id: 'letter', name: '人间书信', tags: ['letter', 'quiet', 'empathy', 'record'], goal: 10 }
  ];

  /* ---------- 查询辅助 ---------- */
  const beastById = (id) => SH.BEASTS.find((b) => b.id === id);
  const cityById = (id) => SH.CITIES.find((c) => c.id === id);
  const itemById = (id) => SH.ITEMS.find((i) => i.id === id);
  const souById = (id) => SH.SOUVENIRS.find((s) => s.id === id);
  const eventById = (id) => SH.EVENTS.find((e) => e.id === id);
  Object.assign(sys, { beastById, cityById, itemById, souById, eventById });

  /** 写入记忆并记录顺序（用于归因回显"它记住了什么"） */
  function writeMemory(beast, mem) {
    if (!mem) return;
    Object.keys(mem).forEach((k) => {
      if (beast.memory[k] == null) beast.memory[k] = 0;
      beast.memory[k] += mem[k];
      if (!beast.memoryOrder) beast.memoryOrder = [];
      const i = beast.memoryOrder.indexOf(k);
      if (i >= 0) beast.memoryOrder.splice(i, 1);   // 重新写入则移到最新
      beast.memoryOrder.push(k);
    });
  }
  sys.writeMemory = writeMemory;

  /* ---------- 条件检查 ---------- */
  function reqOk(state, beast, ev, items) {
    const r = ev.requires;
    if (!r) return true;
    if (r.item && items.indexOf(r.item) < 0) return false;
    if (r.souvenir && !(state.souvenirs[r.souvenir] > 0)) return false;
    if (r.worldFlag && !state.worldFlags[r.worldFlag]) return false;
    if (r.insightMin != null && beast.insight < r.insightMin) return false;
    if (r.notSeen && state.seenEvents[ev.id]) return false;
    if (r.memory) {
      for (const k in r.memory) {
        // 同一种回信可能被重复选择、记忆会累加；条件表示"至少说过 N 次"
        if ((beast.memory[k] || 0) < r.memory[k]) return false;
      }
    }
    if (r.notMemory) {
      for (const k in r.notMemory) {
        const cur = beast.memory[k];
        if (cur != null && cur >= r.notMemory[k]) return false;
      }
    }
    return true;
  }

  /* ---------- 城市选择 ---------- */
  function pickCity(state, beastDef, beastState, pref, items, rand, exclude) {
    const pool = SH.CITIES.filter((c) => exclude.indexOf(c.id) < 0);
    const list = pool.map((c) => {
      let w = 1;
      w += (beastDef.cityPref && beastDef.cityPref[c.id]) || 0;
      items.forEach((iid) => {
        const it = itemById(iid);
        if (it && it.bias && it.bias[c.id]) w += it.bias[c.id];
      });
      if (pref) w += U.overlap(c.tags, pref.tags) * 0.8;
      if (beastState && beastState.visited[c.id]) w -= 0.35;
      return { city: c, weight: Math.max(0.15, w) };
    });
    const hit = U.weighted(rand, list);
    return hit ? hit.city : pool[0];
  }

  function pickWeather(city, rand, forced) {
    if (forced && city.weather.indexOf(forced) >= 0) return forced;
    return U.rand(rand, city.weather);
  }

  /** 城市池：若事件要求特定天气，只从支持该天气的城市里挑 */
  function cityPoolWithWeather(requireWeather, beastDef, beastState, pref, items, rand, exclude) {
    if (!requireWeather) return null;
    const ok = SH.CITIES.filter(
      (c) => c.weather.indexOf(requireWeather) >= 0 && exclude.indexOf(c.id) < 0
    );
    if (!ok.length) return null;
    const list = ok.map((c) => ({
      city: c,
      weight: Math.max(0.15, 1 + ((beastDef.cityPref && beastDef.cityPref[c.id]) || 0))
    }));
    const hit = U.weighted(rand, list);
    return hit ? hit.city : ok[0];
  }

  /* ---------- 事件选择（先定事件，再由事件定城市） ---------- */
  function pickEvent(state, beastId, pref, items, rand, usedEventIds, excludeCities) {
    const beastDef = beastById(beastId);          // 神兽定义：tags / cityPref
    const beastState = state.beasts[beastId];      // 运行时状态：memory / visited / insight
    if (!beastDef || !beastState) return null;

    const list = [];
    SH.EVENTS.forEach((ev) => {
      if (usedEventIds.indexOf(ev.id) >= 0) return;
      // beast: '*'（不限）| 神兽 id | 神兽 id 数组
      if (ev.beast && ev.beast !== '*') {
        const okBeast = Array.isArray(ev.beast)
          ? ev.beast.indexOf(beastId) >= 0
          : ev.beast === beastId;
        if (!okBeast) return;
      }
      if (!reqOk(state, beastState, ev, items)) return;

      // 事件链：必须刚好走到上一步
      if (ev.chain) {
        const cur = beastState.memory[ev.chain.id] || 0;
        if (cur >= ev.chain.step) return;
        if (ev.chain.step > 1 && cur !== ev.chain.step - 1) return;
      }

      let w = ev.weight || 5;
      w *= 1 + U.overlap(ev.tags, beastDef.tags) * 0.6;
      if (pref) w *= 1 + U.overlap(ev.tags, pref.tags) * 0.5;
      items.forEach((iid) => {
        const it = itemById(iid);
        if (!it || !it.boost) return;
        ev.tags.forEach((t) => {
          if (it.boost[t]) w *= 1 + (it.boost[t] - 1) * 0.7 + 0.35;
        });
      });
      if (state.seenEvents[ev.id]) w *= 0.2;
      // 事件链是主线叙事：开始后应明显优先，但不完全排除随机
      if (ev.chain) w *= ev.chain.step > 1 ? 6 : 4;
      // 访客带来的常驻加成（如老奶奶在场时，书信类事件更容易出现）
      const vb = state.visitorBonus || {};
      ev.tags.forEach((t) => {
        if (vb[t]) w *= vb[t];
      });
      // 回信"回声"事件：玩家曾给出建议，这次旅行兑现了它
      if (ev.echo) w *= 5;

      let city = null;
      if (ev.city === '*' || !ev.city) {
        city =
          cityPoolWithWeather(ev.weather, beastDef, beastState, pref, items, rand, excludeCities) ||
          pickCity(state, beastDef, beastState, pref, items, rand, excludeCities);
      } else if (Array.isArray(ev.city)) {
        const avail = ev.city.filter((c) => excludeCities.indexOf(c) < 0);
        if (!avail.length) return;               // 候选城市都被占用则跳过
        city = cityById(U.rand(rand, avail));
      } else {
        if (excludeCities.indexOf(ev.city) >= 0) return; // 同一趟不重复去同一座城
        city = cityById(ev.city);
      }
      if (!city) return;
      // 天气必须与城市匹配（避免"西安下暴雪"这类错配）
      if (ev.weather && city.weather.indexOf(ev.weather) < 0) return;
      list.push({ ev, city, weight: w });
    });

    const hit = U.weighted(rand, list);
    if (!hit) return null;
    return {
      ev: hit.ev,
      city: hit.city,
      weather: pickWeather(hit.city, rand, hit.ev.weather)
    };
  }

  /* ---------- 出发 ---------- */
  sys.startTrip = function (state, beastId, preferenceId, itemIds) {
    const beast = state.beasts[beastId];
    if (!beast) return { ok: false, msg: '没有这只神兽' };
    if (state.trips[beastId]) return { ok: false, msg: '它还在路上' };
    const beastDef = beastById(beastId);
    const pref = SH.PREFERENCES.find((p) => p.id === preferenceId) || SH.PREFERENCES[0];

    // 扣除道具
    const items = (itemIds || []).filter((id) => (state.inventory[id] || 0) > 0);
    items.forEach((id) => {
      state.inventory[id] -= 1;
      if (state.inventory[id] <= 0) delete state.inventory[id];
    });

    const seed = `${beastId}|${Date.now()}|${Math.floor(Math.random() * 1e6)}`;
    const rand = SH.rng.make(seed + ':plan');

    const stops = [];
    const usedEvents = [];
    const excludeCities = [];
    const far = items.indexOf('map') >= 0 || items.indexOf('bamboo') >= 0;
    const stopCount = rand() < (far ? 0.75 : 0.35) ? 2 : 1;

    for (let i = 0; i < stopCount; i++) {
      const hit = pickEvent(state, beastId, pref, items, rand, usedEvents, excludeCities);
      if (!hit) break;
      usedEvents.push(hit.ev.id);
      excludeCities.push(hit.city.id);
      stops.push({ city: hit.city.id, weather: hit.weather, eventId: hit.ev.id });
    }
    if (!stops.length) {
      // 兜底：任意城市 + 兜底信件
      const c = pickCity(state, beastDef, beast, pref, items, rand, []);
      stops.push({ city: c.id, weather: pickWeather(c, rand), eventId: null });
    }

    const now = U.now();
    let dur = sys.DURATION.base + sys.DURATION.perStop * stops.length;
    dur += Math.floor(rand() * 6 * MIN);
    if (state.settings && state.settings.fastMode) dur = Math.max(40 * 1000, Math.round(dur * 0.1));

    const trip = {
      beastId,
      beastName: beastDef.name,
      preference: pref.id,
      items,
      seed,
      departAt: now,
      returnAt: now + dur,
      stops,
      resolved: false
    };
    state.trips[beastId] = trip;
    SH.save();
    return { ok: true, trip };
  };

  /* ---------- 结算：归因回显（P0① 全量化） ---------- */
  function causesFor(state, beast, trip, ev) {
    const out = [];
    // 1) 随身道具的真实效果（带上了 X → 它因此做了什么）
    (Array.isArray(trip.items) ? trip.items : []).forEach((iid) => {
      const it = itemById(iid);
      if (!it) return;
      const hit =
        (ev && U.overlap(ev.tags, it.tags)) ||
        (it.bias && trip.stops[0] && it.bias[trip.stops[0].city]);
      if (hit) out.push(`带上了「${it.name}」`);
    });
    // 2) 回信记忆：按写入顺序取最近 3 条，全部有文案
    const lines = SH.MEMORY_LINES || {};
    const order = beast.memoryOrder || [];
    const recent = order.slice(-3).reverse();
    recent.forEach((k) => {
      if (lines[k]) out.push(lines[k]);
    });
    // 顺序表为空时兜底：扫描 memory 里的已知 key
    if (!recent.length) {
      Object.keys(beast.memory || {}).forEach((k) => {
        if (lines[k] && out.length < 4) out.push(lines[k]);
      });
    }
    return out.slice(0, 4);
  }

  /* ---------- 道具真实效果（P2：effect 不再是纯文案） ---------- */
  function applyItemEffects(state, beast, trip, stop, ev, rand, acc) {
    const items = trip.items || [];
    const weather = stop.weather;

    items.forEach((iid) => {
      const it = itemById(iid);
      if (!it || !it.effect) return;
      switch (it.effect) {
        case 'postcard':          // 旧式相机：把没看懂的拍下来
          if (rand() < 0.4) {
            acc.bonusSou = acc.bonusSou || 'sou-postcard';
            acc.causes.push('它把没看懂的都拍了下来');
          }
          break;
        case 'lore':              // 古书残页：古今对照，多涨见闻
          if (ev && U.overlap(ev.tags, ['history', 'ancient', 'scholar'])) {
            acc.insightBonus += 1;
            acc.causes.push('它翻着古书残页做对照');
          }
          break;
        case 'rain':              // 油纸伞：雨天真正被撑开
          if (weather === 'rain') {
            acc.bonusSou = acc.bonusSou || 'sou-postcard';
            acc.causes.push('雨里它撑开油纸伞，慢慢走');
          }
          break;
        case 'share':             // 桂花糕：分给别人
          if (rand() < 0.5) {
            acc.bonusSou = acc.bonusSou || 'sou-postcard';
            acc.causes.push('它把桂花糕分给了路上的人');
          }
          break;
        case 'cheer':             // 山楂糕：心情好，多涨见闻
          acc.insightBonus += 1;
          acc.causes.push('酸得直皱眉，心情却好了');
          break;
        case 'note':              // 空白手账：留下成篇记录
          acc.dropBoost += 0.25;
          break;
        case 'meet':              // 铜铃：更容易被人注意到
          acc.dropBoost += 0.2;
          if (ev && U.overlap(ev.tags, ['social', 'letter'])) {
            acc.causes.push('铃一响，就有人回头');
          }
          break;
        case 'night':             // 小灯笼：夜里走得安稳
          if (weather === 'night') {
            acc.bonusSou = acc.bonusSou || 'sou-lantern';
            acc.causes.push('小灯笼让它在夜里走得安稳');
          }
          break;
        case 'far':               // 旅行地图 / 竹筒饭：已在 stopCount 生效
        case 'long':
        default:
          break;
      }
    });
  }

  sys.resolveTrip = function (state, beastId) {
    const trip = state.trips[beastId];
    if (!trip || trip.resolved) return null;
    const beast = state.beasts[beastId];
    const beastDef = beastById(beastId);
    if (!beast || !beastDef) {
      delete state.trips[beastId];
      return null;
    }
    const rand = SH.rng.make(trip.seed + ':resolve');
    const tripItems = Array.isArray(trip.items) ? trip.items : [];

    const letters = [];
    const gained = [];
    const tripCauses = [];

    trip.stops.forEach((stop, idx) => {
      const city = cityById(stop.city);
      if (!city) return;
      const ev = stop.eventId ? eventById(stop.eventId) : null;
      // 每封信只带自己这一站的归因，避免第二站继承第一站的理由
      const causes = [];
      let title, body, souId, insightGain = 1, reply = null;

      if (ev) {
        state.seenEvents[ev.id] = true;
        title = ev.title;
        body = ev.body;
        insightGain = ev.insight || 1;
        reply = ev.reply || null;
        if (ev.memory && ev.memory.set) writeMemory(beast, ev.memory.set);
        if (ev.worldFlag) state.worldFlags[ev.worldFlag] = true;
        if (ev.souvenir) {
          souId = Array.isArray(ev.souvenir) ? U.rand(rand, ev.souvenir) : ev.souvenir;
        }
        if (ev.cause) causes.push(ev.cause);
      } else {
        const f = U.rand(rand, SH.FILLER_LETTERS);
        title = f.title;
        body = f.body;
        if (rand() < 0.5) souId = U.rand(rand, SH.SOUVENIRS).id;
      }

      // 归因回显：第一封信补齐"回信记忆 + 随身道具"的因果
      if (idx === 0) causesFor(state, beast, trip, ev).forEach((c) => {
        if (causes.indexOf(c) < 0) causes.push(c);
      });

      const acc = { bonusSou: null, insightBonus: 0, dropBoost: 0, causes: [] };
      applyItemEffects(state, beast, trip, stop, ev, rand, acc);
      acc.causes.forEach((c) => causes.push(c));
      insightGain += acc.insightBonus;

      // 掉落：事件纪念品 + 相机/手账等附加掉落 + 效果加成
      if (tripItems.indexOf('camera') >= 0 && rand() < 0.35) souId = souId || 'sou-postcard';
      if (tripItems.indexOf('notebook') >= 0 && rand() < 0.25) souId = souId || 'sou-postcard';
      if (!souId && acc.dropBoost > 0 && rand() < acc.dropBoost) {
        souId = U.rand(rand, SH.SOUVENIRS).id;
      }
      if (!souId && acc.bonusSou) souId = acc.bonusSou;

      if (souId) {
        state.souvenirs[souId] = (state.souvenirs[souId] || 0) + 1;
        gained.push(souId);
      }

      beast.insightExp += insightGain;
      beast.visited[city.id] = (beast.visited[city.id] || 0) + 1;
      causes.forEach((c) => { if (tripCauses.indexOf(c) < 0) tripCauses.push(c); });

      letters.push({
        id: `L${Date.now()}_${idx}_${Math.floor(rand() * 1e6)}`,
        beastId,
        beastName: beastDef.name,
        city: city.id,
        cityName: city.name,
        weather: stop.weather,
        title,
        body,
        eventId: ev ? ev.id : null,
        reply,
        replied: null,
        causes: causes.slice(0, 5),
        souvenir: souId || null,
        at: U.now()
      });
    });

    // 一次出行只计一次，避免两站被算成两次出行
    if (letters.length) beast.travels += 1;

    // 认知弧线升级：新阶段信排在最前面（最新的在上）
    const stages = [];
    const stageLetters = [];
    while (
      beast.insight < 3 &&
      beast.insightExp >= sys.INSIGHT_THRESHOLD[beast.insight + 1]
    ) {
      beast.insight += 1;
      const st = SH.INSIGHT_STAGES[beast.insight];
      stages.push(st);
      stageLetters.unshift({
        id: `S${Date.now()}_${beast.insight}`,
        beastId,
        beastName: beastDef.name,
        city: null,
        cityName: '山海驿站',
        weather: null,
        title: `【${st.name}】${st.desc}`,
        body: st.letter,
        eventId: null,
        reply: null,
        replied: null,
        causes: [],
        souvenir: null,
        at: U.now(),
        stage: true
      });
    }

    state.letters = stageLetters.concat(letters, state.letters);
    delete state.trips[beastId];
    SH.save();

    return { beastId, letters: stageLetters.concat(letters), gained, causes: tripCauses, stages };
  };

  /* ---------- 时间推进 ---------- */
  sys.tick = function (state) {
    const now = U.now();
    const done = [];
    Object.keys(state.trips).forEach((bid) => {
      const t = state.trips[bid];
      if (t && !t.resolved && now >= t.returnAt) {
        const r = sys.resolveTrip(state, bid);
        if (r) done.push(r);
      }
    });
    return done;
  };

  sys.forceReturn = function (state, beastId) {
    const t = state.trips[beastId];
    if (!t) return null;
    // 静心沙漏每日限次（P2：保留真实等待感）
    const today = U.fmtDate(U.now());
    const hg = state.hourglass || (state.hourglass = { day: today, used: 0 });
    if (hg.day !== today) { hg.day = today; hg.used = 0; }
    if (hg.used >= sys.HOURGLASS_LIMIT) {
      return { limited: true, remain: sys.HOURGLASS_LIMIT - hg.used };
    }
    hg.used += 1;
    t.returnAt = U.now();
    return sys.resolveTrip(state, beastId);
  };

  sys.hourglassLeft = function (state) {
    const today = U.fmtDate(U.now());
    const hg = state.hourglass || { day: today, used: 0 };
    if (hg.day !== today) return sys.HOURGLASS_LIMIT;
    return Math.max(0, sys.HOURGLASS_LIMIT - hg.used);
  };

  /* ---------- 回信 ---------- */
  sys.replyLetter = function (state, letterId, optionIndex) {
    const letter = state.letters.find((l) => l.id === letterId);
    if (!letter || letter.replied != null || !letter.reply) return null;
    const opt = letter.reply[optionIndex];
    if (!opt) return null;
    // 访客的信回答的是"驿站"：这句话会同时被所有神兽记住
    const targets = letter.visitor
      ? SH.BEASTS.map((b) => state.beasts[b.id]).filter(Boolean)
      : [state.beasts[letter.beastId]].filter(Boolean);
    targets.forEach((beast) => {
      if (opt.memory) writeMemory(beast, opt.memory);
      if (!letter.visitor) beast.insightExp += 1;
    });
    letter.replied = optionIndex;
    letter.replyText = opt.text;
    SH.save();
    return { opt, letter };
  };

  /* ---------- 家园 ---------- */
  sys.placeSouvenir = function (state, slot, souId) {
    if (slot < 0 || slot >= sys.SLOTS) return { ok: false, msg: '这个位置不能摆' };
    if (souId && !(state.souvenirs[souId] > 0)) return { ok: false, msg: '还没有这件纪念品' };
    let movedFrom = null;
    if (souId) {
      // 同一件只摆一处：从旧位置挪过来，而不是报错
      for (const k in state.placed) {
        if (state.placed[k] === souId && Number(k) !== slot) {
          movedFrom = Number(k);
          delete state.placed[movedFrom];
        }
      }
      state.placed[slot] = souId;
    } else {
      delete state.placed[slot];
    }
    const unlocked = sys.refreshVisitors(state);
    SH.save();
    return { ok: true, unlocked, movedFrom };
  };

  /* ---------- 访客（P1：访客带来来信 / 礼物 / 常驻加成） ---------- */
  sys.refreshVisitors = function (state) {
    const counts = {};
    Object.keys(state.placed).forEach((k) => {
      const s = souById(state.placed[k]);
      if (!s) return;
      (s.attract || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
    });
    const unlocked = [];
    SH.VISITORS.forEach((v) => {
      const total = v.need.reduce((n, t) => n + (counts[t] || 0), 0);
      if (total >= v.count && !state.visitors[v.id]) {
        state.visitors[v.id] = true;
        unlocked.push(v);
        // 1) 常驻加成
        if (v.bonus) {
          state.visitorBonus = state.visitorBonus || {};
          Object.keys(v.bonus).forEach((t) => {
            state.visitorBonus[t] = Math.max(state.visitorBonus[t] || 1, v.bonus[t]);
          });
        }
        // 2) 礼物
        if (v.gift && state.souvenirs[v.gift] == null) {
          state.souvenirs[v.gift] = 1;
        } else if (v.gift) {
          state.souvenirs[v.gift] += 1;
        }
        // 3) 一封来信
        if (v.letter) {
          state.letters.unshift({
            id: `V${Date.now()}_${v.id}_${Math.floor(Math.random() * 1e5)}`,
            beastId: null,
            beastName: v.name,
            city: null,
            cityName: '山海驿站',
            weather: null,
            title: v.letter.title,
            body: v.letter.body,
            eventId: null,
            reply: v.letter.reply || null,
            replied: null,
            causes: [`你在驿站摆出了足够的${v.need.map((t) => TAG_NAME[t] || t).join('、')}类纪念品`],
            souvenir: v.gift || null,
            at: U.now(),
            visitor: true
          });
        }
      }
    });
    return unlocked;
  };

  const TAG_NAME = {
    letter: '书信', rain: '雨天', tea: '茶', quiet: '清静', food: '吃食',
    night: '夜色', desert: '沙漠', star: '星辰', history: '古史', scholar: '学问',
    craft: '手艺', travel: '远行', nature: '山水', water: '水', snow: '雪',
    social: '交游', playful: '玩心', record: '记录', city: '城市',
    ancient: '古迹', curious: '好奇', empathy: '共情', calm: '沉静'
  };
  sys.TAG_NAME = TAG_NAME;
  sys.tagName = (t) => TAG_NAME[t] || t;

  /* ---------- 收藏计数（只算真正拥有的，排除数量为 0 的脏数据） ---------- */
  sys.ownedSouvenirCount = function (state) {
    return SH.SOUVENIRS.filter((s) => (state.souvenirs[s.id] || 0) > 0).length;
  };

  /* ---------- 图鉴进度 ---------- */
  sys.codexProgress = function (state) {
    return sys.CODEX_GROUPS.map((g) => {
      let n = 0;
      Object.keys(state.seenEvents).forEach((eid) => {
        const ev = eventById(eid);
        if (!ev) return;
        if (U.overlap(ev.tags, g.tags) > 0) n += 1;
      });
      return { ...g, count: n, pct: Math.min(100, Math.round((n / g.goal) * 100)) };
    });
  };

  /* ---------- 初始赠送 ---------- */
  sys.grantStarterItems = function (state) {
    ['camera', 'oldbook', 'umbrella', 'osmanthus', 'notebook', 'bell'].forEach((id) => {
      state.inventory[id] = (state.inventory[id] || 0) + 2;
    });
    ['map', 'bamboo', 'hawthorn', 'lantern'].forEach((id) => {
      state.inventory[id] = (state.inventory[id] || 0) + 1;
    });
  };

  /* ---------- 庭院灵草采撷（每 6 小时一次；快速模式下 2 分钟） ---------- */
  sys.supplyCooldownMs = function (state) {
    return state && state.settings && state.settings.fastMode ? 2 * MIN : 6 * 60 * MIN;
  };

  sys.supplyRemain = function (state) {
    const now = U.now();
    const last = state.lastSupply || 0;
    const cd = sys.supplyCooldownMs(state);
    return Math.max(0, cd - (now - last));
  };

  sys.claimSupply = function (state) {
    const now = U.now();
    const remain = sys.supplyRemain(state);
    if (remain > 0) {
      return { ok: false, remain };
    }
    state.lastSupply = now;
    const rand = SH.rng.make('supply' + now);
    const pool = SH.ITEMS.slice();
    const got = [];
    for (let i = 0; i < 2; i++) {
      const it = U.rand(rand, pool);
      state.inventory[it.id] = (state.inventory[it.id] || 0) + 1;
      got.push(it);
    }
    SH.save();
    return { ok: true, got };
  };

  /* ---------- 抚摸与屋里神兽日常语录 ---------- */
  const BEAST_QUOTES = {
    baize: [
      '窗外那座楼，比古图里画的还高呢。',
      '我正在把昨天带回来的车票夹进书里。',
      '茶凉了再添一点热水，不急。',
      '人间没有法术，却也把日子理得井井有条。'
    ],
    jiuweihu: [
      '今天空气里有桂花味，还有……烤红薯味！',
      '帮我装点好吃的在包袱里好不好？',
      '上次认识的人问我尾巴怎么梳得这么蓬松。',
      '晒太阳的地板暖烘烘的，再躺一会儿就出门。'
    ],
    qingniao: [
      '风从窗棂吹进来，像在催我再去远一点。',
      '每一封信折起来的时候，声音都不一样。',
      '如果下雨的话，我想在屋檐下多听一会儿。',
      '谢谢你帮我留着这盏灯，我总能找到回来的路。'
    ]
  };

  sys.petBeast = function (state, beastId) {
    const bs = state.beasts[beastId];
    if (!bs) return null;
    bs.petCount = (bs.petCount || 0) + 1;
    SH.save();
    return bs.petCount;
  };

  sys.beastIdleQuote = function (state, beastId, seedIdx) {
    const bs = state.beasts[beastId];
    const def = beastById(beastId);
    if (!bs || !def) return '';
    const stage = SH.INSIGHT_STAGES[bs.insight] || SH.INSIGHT_STAGES[0];
    const pool = (BEAST_QUOTES[beastId] || []).slice();
    if (bs.insight === 0) pool.unshift('人间……好大。到处都在发光。');
    else pool.unshift(stage.desc);
    const order = bs.memoryOrder || [];
    if (order.length && SH.MEMORY_LINES) {
      const lastKey = order[order.length - 1];
      if (SH.MEMORY_LINES[lastKey]) {
        pool.push('我还记得，' + SH.MEMORY_LINES[lastKey] + '。');
      }
    }
    const idx = Math.abs(seedIdx || 0) % pool.length;
    return pool[idx];
  };
})();
