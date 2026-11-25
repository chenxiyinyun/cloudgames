/**
 * 《山海来信 v2.0》核心规则引擎（纯函数与无平台依赖状态机）
 * Web（Vue 3）与微信小程序完全复用本文件。
 */
import '../../../../static/shanhai-letters/src/saveSchema.js';
import {
  BEASTS,
  CITIES,
  SEASONS,
  TRAITS,
  PERSONA_QUIRKS,
  MATERIALS,
  ITEMS,
  SOUVENIRS,
  COMMISSIONS,
  ROOM_AURAS,
  VISITORS,
  STAMPS,
  PREFERENCES,
  INSIGHT_THRESHOLD,
  INSIGHT_STAGES,
  CODEX_GROUPS,
  TAG_NAME,
  MEMORY_LINES,
  EVENTS,
  DYNAMIC_FRAGMENTS,
  COAUTHOR_LETTERS
} from '../data/gameData.js';

const SCHEMA = globalThis.SHSaveSchema;
const MIN = 60 * 1000;

export const CONSTANTS = {
  DURATION: { base: 8 * MIN, perStop: 9 * MIN },
  FIRST_TRIP_MS: 45 * 1000,
  SUPPLY_COOLDOWN_MS: 90 * MIN,
  FAST_SUPPLY_COOLDOWN_MS: 45 * 1000,
  SLOTS: 12,
  HOURGLASS_LIMIT: 4
};

/* ---------- 种子随机数与工具 ---------- */
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = hashStr(seed);
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randItem(rand, arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rand() * arr.length)];
}

export function weightedPick(rand, list) {
  const total = list.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const x of list) {
    r -= Math.max(0, x.weight || 0);
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

export function overlap(a = [], b = []) {
  return a.filter((x) => b.indexOf(x) >= 0).length;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export function fmtDuration(ms) {
  if (ms <= 0) return '已归来';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} 小时 ${m % 60} 分`;
  if (m > 0) return `${m} 分 ${s % 60} 秒`;
  return `${s} 秒`;
}

/* ---------- 查询助手 ---------- */
export const beastById = (id) => BEASTS.find((b) => b.id === id) || null;
export const cityById = (id) => CITIES.find((c) => c.id === id) || null;
export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const materialById = (id) => MATERIALS.find((m) => m.id === id) || null;
export const souById = (id) => SOUVENIRS.find((s) => s.id === id) || null;
export const eventById = (id) => EVENTS.find((e) => e.id === id) || null;
export const quirkById = (id) => PERSONA_QUIRKS.find((q) => q.id === id) || null;
export const stampById = (id) => STAMPS.find((s) => s.id === id) || null;
export const commissionById = (id) => COMMISSIONS.find((c) => c.id === id) || null;
export const visitorById = (id) => VISITORS.find((v) => v.id === id) || null;
export const tagName = (t) => TAG_NAME[t] || t;

export function allBeastIds() {
  return BEASTS.map((b) => b.id);
}

/* ---------- 存档创建与迁移 ---------- */
export function createFreshState() {
  return SCHEMA.createDefaultState(allBeastIds());
}

export function normalizeState(raw, strict = false) {
  return SCHEMA.normalizeState(raw, { strict, beastIds: allBeastIds() });
}

export function grantStarterItems(state) {
  ['camera', 'oldbook', 'umbrella', 'osmanthus', 'notebook', 'bell'].forEach((id) => {
    state.inventory[id] = (state.inventory[id] || 0) + 2;
  });
  ['map', 'bamboo', 'hawthorn', 'lantern'].forEach((id) => {
    state.inventory[id] = (state.inventory[id] || 0) + 1;
  });
  Object.assign(state.materials, {
    dew: (state.materials.dew || 0) + 3,
    osmanthus_seed: (state.materials.osmanthus_seed || 0) + 2,
    bamboo_shoot: (state.materials.bamboo_shoot || 0) + 2,
    raw_paper: (state.materials.raw_paper || 0) + 3,
    cinnabar: (state.materials.cinnabar || 0) + 2
  });
}

export function totalStationTravels(state) {
  return BEASTS.reduce((s, b) => s + ((state && state.beasts && state.beasts[b.id] && state.beasts[b.id].travels) || 0), 0);
}

export function markSouvenirDiscovered(state, souId) {
  if (!state || !souId) return;
  state.worldFlags = state.worldFlags || {};
  state.worldFlags[`sou_seen:${souId}`] = true;
}

export function isSouvenirDiscovered(state, souId) {
  if (!state || !souId) return false;
  return !!((state.souvenirs && state.souvenirs[souId] > 0) || (state.worldFlags && state.worldFlags[`sou_seen:${souId}`]));
}

export function syncDiscoveredSouvenirs(state) {
  if (!state) return;
  Object.keys(state.souvenirs || {}).forEach((id) => {
    if (state.souvenirs[id] > 0) markSouvenirDiscovered(state, id);
  });
  Object.values(state.placed || {}).forEach((id) => {
    if (id) markSouvenirDiscovered(state, id);
  });
  (state.letters || []).forEach((l) => {
    if (l && l.souvenir) markSouvenirDiscovered(state, l.souvenir);
  });
}

export function getBeastStampBlessing(state, beastId) {
  if (!state || !beastId || !state.worldFlags) return null;
  const sid = state.worldFlags[`stamp_blessing:${beastId}`];
  return sid ? stampById(sid) : null;
}

export function isFreshState(state) {
  const letters = state.letters || [];
  const onlyUntouchedWelcome = letters.every((l) => l && l.welcome && !l.opened && l.replied == null);
  return (
    onlyUntouchedWelcome &&
    !Object.keys(state.trips).length &&
    BEASTS.every((b) => !state.beasts[b.id] || !state.beasts[b.id].travels)
  );
}

export function grantWelcomeLetter(state, now = Date.now()) {
  if (!state || !isFreshState(state)) return null;
  state.worldFlags = state.worldFlags || {};
  if (state.worldFlags.welcome_sent) return null;
  state.worldFlags.welcome_sent = true;
  state.souvenirs['sou-postcard'] = (state.souvenirs['sou-postcard'] || 0) + 1;
  markSouvenirDiscovered(state, 'sou-postcard');
  const letter = {
    id: 'WELCOME_1',
    beastId: 'baize',
    beastName: '白泽',
    city: null,
    cityName: '山海驿站正厅',
    weather: 'sunny',
    title: '山海驿站今朝开张',
    body: '掌柜安好：\n我们从山海旧卷里寻到这间带院子的老木屋，刚把博古架擦净、炉上水烧开。\n门口那只蓝印花布包袱已经替你摊在茶桌上了，随信附上第一张「空白明信片」。选一枚喜欢的闲章回我们一句，再挑一件随身物送我们出门转转吧！',
    eventId: null,
    reply: [
      { text: '茶已温好，去看看外头的山河', trait: 'scholar', memory: { look_out: 1 } },
      { text: '早去早回，驿站替你们留灯', trait: 'empathy', memory: { keep_light: 1 } },
      { text: '不必赶路，喜欢哪阵风便多听一会儿', trait: 'calm', memory: { slow_down: 1 } }
    ],
    replied: null,
    opened: false,
    stamp: null,
    causes: ['初入山海驿站的开张礼信'],
    souvenir: 'sou-postcard',
    welcome: true,
    at: now
  };
  state.letters.unshift(letter);
  return letter;
}

/* ---------- 记忆与后天印记 ---------- */
export function writeMemory(beast, mem) {
  if (!mem || !beast) return;
  Object.keys(mem).forEach((k) => {
    if (beast.memory[k] == null) beast.memory[k] = 0;
    beast.memory[k] += mem[k];
    if (!beast.memoryOrder) beast.memoryOrder = [];
    const idx = beast.memoryOrder.indexOf(k);
    if (idx >= 0) beast.memoryOrder.splice(idx, 1);
    beast.memoryOrder.push(k);
  });
}

export function unlockEligibleQuirks(beast) {
  if (!beast || !beast.traits) return [];
  const newlyUnlocked = [];
  PERSONA_QUIRKS.forEach((q) => {
    if (beast.unlockedQuirks.indexOf(q.id) >= 0) return;
    const ok = Object.keys(q.requireTrait).every((tk) => (beast.traits[tk] || 0) >= q.requireTrait[tk]);
    if (ok) {
      beast.unlockedQuirks.push(q.id);
      if (!beast.equippedQuirk) beast.equippedQuirk = q.id;
      newlyUnlocked.push(q);
    }
  });
  return newlyUnlocked;
}

export function equipQuirk(state, beastId, quirkId) {
  const beast = state.beasts[beastId];
  if (!beast) return { ok: false, msg: '未找到神兽' };
  if (quirkId == null) {
    beast.equippedQuirk = null;
    return { ok: true, quirk: null };
  }
  if (beast.unlockedQuirks.indexOf(quirkId) < 0) {
    return { ok: false, msg: '尚未觉醒此性格印记' };
  }
  beast.equippedQuirk = quirkId;
  return { ok: true, quirk: quirkById(quirkId) };
}

/* ---------- 博古架堂前气场与动态访客茶会 ---------- */
function getPlacedSouvenirs(state) {
  return Object.keys(state.placed || {})
    .map((k) => souById(state.placed[k]))
    .filter(Boolean);
}

function countMatchingPlaced(placedList, needTags) {
  let count = 0;
  let affinity = 0;
  placedList.forEach((s) => {
    const allTags = [...new Set([...(s.attract || []), ...(s.tags || [])])];
    const hits = overlap(allTags, needTags);
    if (hits > 0) {
      count += 1;
      affinity += hits;
    }
  });
  return { count, affinity };
}

export function computeRoomAura(state) {
  const placedList = getPlacedSouvenirs(state);
  const active = [];
  const bonus = {};

  ROOM_AURAS.forEach((aura) => {
    const { count, affinity } = countMatchingPlaced(placedList, aura.need);
    if (count >= aura.min) {
      active.push({ ...aura, score: count, affinity });
      Object.keys(aura.bonus).forEach((tag) => {
        bonus[tag] = Math.max(bonus[tag] || 1, aura.bonus[tag]);
      });
    }
  });

  active.sort((a, b) => (b.score - a.score) || (b.affinity - a.affinity));
  return {
    primary: active[0] || null,
    all: active,
    bonus
  };
}

export function refreshVisitors(state, now = Date.now()) {
  const placedList = getPlacedSouvenirs(state);
  const newlyUnlocked = [];
  const matching = [];

  VISITORS.forEach((v) => {
    const { count, affinity } = countMatchingPlaced(placedList, v.need);
    if (count >= v.count) {
      matching.push({ v, score: count, affinity });
      if (!state.visitors[v.id]) {
        state.visitors[v.id] = true;
        newlyUnlocked.push(v);
        if (v.bonus) {
          state.visitorBonus = state.visitorBonus || {};
          Object.keys(v.bonus).forEach((t) => {
            state.visitorBonus[t] = Math.max(state.visitorBonus[t] || 1, v.bonus[t]);
          });
        }
        if (v.gift) {
          state.souvenirs[v.gift] = (state.souvenirs[v.gift] || 0) + 1;
          markSouvenirDiscovered(state, v.gift);
        }
        if (v.letter) {
          state.letters.unshift({
            id: `V${now}_${v.id}_${Math.floor(Math.random() * 1e5)}`,
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
            opened: false,
            causes: [`博古架摆出了足够的${v.need.map((t) => tagName(t)).join('、')}风物`],
            souvenir: v.gift || null,
            at: now,
            visitor: true
          });
        }
      }
    }
  });

  // 根据当前摆设气场与今日轮换，选出 1~2 位在庭院喝茶的常客
  matching.sort((a, b) => b.score - a.score);
  const today = fmtDate(now);
  const knownIds = VISITORS.filter((v) => state.visitors[v.id]).map((v) => v.id);

  if (matching.length) {
    state.activeVisitors = matching.slice(0, 2).map((m) => m.v.id);
    state.visitorDay = today;
  } else if (knownIds.length && (state.visitorDay !== today || !state.activeVisitors.length)) {
    const rand = makeRng(`tea:${today}:${knownIds.join(',')}`);
    const picked = randItem(rand, knownIds);
    state.activeVisitors = picked ? [picked] : [];
    state.visitorDay = today;
  }

  return newlyUnlocked;
}

export function placeSouvenir(state, slot, souId, now = Date.now()) {
  if (slot < 0 || slot >= CONSTANTS.SLOTS) return { ok: false, msg: '这个位置不能摆' };
  if (souId && !(state.souvenirs[souId] > 0)) return { ok: false, msg: '还没有这件纪念品' };
  let movedFrom = null;
  if (souId) {
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
  const unlocked = refreshVisitors(state, now);
  const aura = computeRoomAura(state);
  return { ok: true, unlocked, movedFrom, aura };
}

/* ---------- 访客茶会以物易物 ---------- */
export function tradeWithVisitor(state, visitorId, tradeId) {
  const v = visitorById(visitorId);
  if (!v) return { ok: false, msg: '未找到访客' };
  const trade = (v.trades || []).find((t) => t.id === tradeId);
  if (!trade) return { ok: false, msg: '暂无此交换' };

  if (trade.costType === 'souvenir') {
    const cur = state.souvenirs[trade.costId] || 0;
    if (cur < trade.costCount) return { ok: false, msg: '手头的纪念品数量不够' };
    state.souvenirs[trade.costId] = cur - trade.costCount;
    if (state.souvenirs[trade.costId] <= 0) {
      delete state.souvenirs[trade.costId];
      // 若从博古架上消耗光了唯一摆件，清空对应槽位
      Object.keys(state.placed).forEach((slot) => {
        if (state.placed[slot] === trade.costId) delete state.placed[slot];
      });
    }
  } else if (trade.costType === 'material') {
    const cur = state.materials[trade.costId] || 0;
    if (cur < trade.costCount) return { ok: false, msg: '灵材还不够' };
    state.materials[trade.costId] = cur - trade.costCount;
    if (state.materials[trade.costId] <= 0) delete state.materials[trade.costId];
  }

  let gainName = '';
  if (trade.gainType === 'item') {
    state.inventory[trade.gainId] = (state.inventory[trade.gainId] || 0) + trade.gainCount;
    gainName = `${(itemById(trade.gainId) || {}).name || trade.gainId} ×${trade.gainCount}`;
  } else if (trade.gainType === 'material') {
    state.materials[trade.gainId] = (state.materials[trade.gainId] || 0) + trade.gainCount;
    gainName = `${(materialById(trade.gainId) || {}).name || trade.gainId} ×${trade.gainCount}`;
  } else if (trade.gainType === 'stamp') {
    if (state.stamps.indexOf(trade.gainId) < 0) state.stamps.push(trade.gainId);
    gainName = `朱砂闲章「${(stampById(trade.gainId) || {}).name || trade.gainId}」`;
  }

  return { ok: true, trade, gainName };
}

/* ---------- 庭院节气灵草采撷 & 茶案手作 ---------- */
export function supplyCooldownMs(state) {
  return state && state.settings && state.settings.fastMode
    ? CONSTANTS.FAST_SUPPLY_COOLDOWN_MS
    : CONSTANTS.SUPPLY_COOLDOWN_MS;
}

export function supplyRemain(state, now = Date.now()) {
  const last = state.lastSupply || 0;
  return Math.max(0, supplyCooldownMs(state) - (now - last));
}

export function harvestGarden(state, now = Date.now()) {
  const remain = supplyRemain(state, now);
  if (remain > 0) return { ok: false, remain };
  state.lastSupply = now;
  const rand = makeRng(`garden:${now}:${state.seasonIdx}`);
  const season = SEASONS[state.seasonIdx % SEASONS.length] || SEASONS[0];

  const pool = MATERIALS.map((m) => ({
    mat: m,
    weight: (season.materialBoost || []).indexOf(m.id) >= 0 ? 2.6 : 1
  }));
  const gotMaterials = [];
  const count = 4 + (rand() < 0.45 ? 1 : 0);
  for (let i = 0; i < count; i += 1) {
    const pick = weightedPick(rand, pool);
    if (pick) {
      state.materials[pick.mat.id] = (state.materials[pick.mat.id] || 0) + 1;
      gotMaterials.push(pick.mat);
    }
  }

  let bonusItem = null;
  if (rand() < 0.35) {
    bonusItem = randItem(rand, ITEMS.slice(0, 10));
    if (bonusItem) state.inventory[bonusItem.id] = (state.inventory[bonusItem.id] || 0) + 1;
  }

  return { ok: true, gotMaterials, bonusItem, season };
}

export function craftItem(state, itemId) {
  const it = itemById(itemId);
  if (!it || !it.recipe) return { ok: false, msg: '没有这份手作图谱' };
  for (const matId of Object.keys(it.recipe)) {
    const need = it.recipe[matId];
    if ((state.materials[matId] || 0) < need) {
      const mat = materialById(matId);
      return { ok: false, msg: `还缺「${mat ? mat.name : matId}」` };
    }
  }
  for (const matId of Object.keys(it.recipe)) {
    state.materials[matId] -= it.recipe[matId];
    if (state.materials[matId] <= 0) delete state.materials[matId];
  }
  state.inventory[it.id] = (state.inventory[it.id] || 0) + 1;
  return { ok: true, item: it };
}

/* ---------- 精卫解锁检测 ---------- */
export function checkJingweiUnlock(state, now = Date.now()) {
  const jw = state.beasts.jingwei;
  if (!jw || jw.unlocked) return null;
  const totalTravels = BEASTS.reduce((s, b) => s + ((state.beasts[b.id] && state.beasts[b.id].travels) || 0), 0);
  const anyCuriosity = BEASTS.some((b) => b.id !== 'jingwei' && state.beasts[b.id] && state.beasts[b.id].insight >= 1);
  const anyCommissionDone = Object.values(state.commissions || {}).some((c) => c && c.completed);

  if (anyCuriosity || anyCommissionDone || totalTravels >= 4) {
    jw.unlocked = true;
    const def = beastById('jingwei');
    state.letters.unshift({
      id: `JW_${now}`,
      beastId: 'jingwei',
      beastName: def.name,
      city: null,
      cityName: '山海驿站屋檐下',
      weather: 'rain',
      title: '檐下多了一只衔石的鸟',
      body: '夜里落雨，我听见屋里炉火响，顺着茶香飞到廊下歇脚。\n原本只打算躲一场雨，可白泽递了热茶，青鸟让出了半格书架。\n我也想看看，那些不用法术也能把海越过去的人间城市，究竟长什么样。\n明天收拾行囊时，也替我留个包袱好吗？',
      eventId: null,
      reply: [
        { text: '欢迎住进山海驿站', trait: 'empathy', memory: { belong: 1 } },
        { text: '明天就送你去海港看看', trait: 'brave', memory: { encourage: 1 } },
        { text: '先喝杯热茶再休息', trait: 'calm', memory: { care_back: 1 } }
      ],
      replied: null,
      opened: false,
      causes: ['驿站的烟火气引来了新的山海同伴'],
      souvenir: null,
      at: now
    });
    return def;
  }
  return null;
}

/* ---------- 条件与事件挑选 ---------- */
function reqOk(state, beast, ev, items) {
  const r = ev.requires;
  if (!r) return true;
  if (r.item && items.indexOf(r.item) < 0) return false;
  if (r.souvenir && !(state.souvenirs[r.souvenir] > 0)) return false;
  if (r.worldFlag && !state.worldFlags[r.worldFlag]) return false;
  if (r.insightMin != null && beast.insight < r.insightMin) return false;
  if (r.notSeen && state.seenEvents[ev.id]) return false;
  if (r.quirk && beast.equippedQuirk !== r.quirk) return false;
  if (r.memory) {
    for (const k in r.memory) {
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

function pickCity(state, beastDef, beastState, pref, items, rand, exclude, stampBlessing = null) {
  const pool = CITIES.filter((c) => exclude.indexOf(c.id) < 0);
  const quirk = beastState && beastState.equippedQuirk ? quirkById(beastState.equippedQuirk) : null;
  const stampBias = stampBlessing && stampBlessing.blessing && stampBlessing.blessing.cityBias;
  const list = pool.map((c) => {
    let w = 1 + ((beastDef.cityPref && beastDef.cityPref[c.id]) || 0);
    if (quirk && quirk.cityBias && quirk.cityBias[c.id]) w += quirk.cityBias[c.id];
    if (stampBias && stampBias[c.id]) w += stampBias[c.id];
    items.forEach((iid) => {
      const it = itemById(iid);
      if (it && it.bias && it.bias[c.id]) w += it.bias[c.id];
    });
    if (pref) w += overlap(c.tags, pref.tags) * 0.8;
    if (beastState && beastState.visited[c.id]) w -= 0.35;
    return { city: c, weight: Math.max(0.15, w) };
  });
  const hit = weightedPick(rand, list);
  return hit ? hit.city : pool[0];
}

function pickWeather(city, season, rand, forced) {
  if (forced && city.weather.indexOf(forced) >= 0) return forced;
  const list = city.weather.map((w) => ({
    w,
    weight: season && season.weatherBias === w ? 2.2 : 1
  }));
  const hit = weightedPick(rand, list);
  return hit ? hit.w : randItem(rand, city.weather);
}

function pickEvent(state, beastId, pref, items, rand, usedEventIds, excludeCities, forcedCityId = null, stampBlessing = null) {
  const beastDef = beastById(beastId);
  const beastState = state.beasts[beastId];
  if (!beastDef || !beastState) return null;

  const season = SEASONS[state.seasonIdx % SEASONS.length] || SEASONS[0];
  const aura = computeRoomAura(state);
  const quirk = beastState.equippedQuirk ? quirkById(beastState.equippedQuirk) : null;
  const stampTags = stampBlessing && stampBlessing.blessing && stampBlessing.blessing.tagBoost;
  const hasExpress = items.indexOf('waxseal') >= 0;

  const list = [];
  EVENTS.forEach((ev) => {
    if (usedEventIds.indexOf(ev.id) >= 0) return;
    if (ev.beast && ev.beast !== '*') {
      const okBeast = Array.isArray(ev.beast) ? ev.beast.indexOf(beastId) >= 0 : ev.beast === beastId;
      if (!okBeast) return;
    }
    if (!reqOk(state, beastState, ev, items)) return;
    if (ev.chain) {
      const cur = beastState.memory[ev.chain.id] || 0;
      if (cur >= ev.chain.step) return;
      if (ev.chain.step > 1 && cur !== ev.chain.step - 1) return;
    }

    let city;
    if (forcedCityId) {
      if (ev.city !== '*' && ev.city !== forcedCityId && !(Array.isArray(ev.city) && ev.city.indexOf(forcedCityId) >= 0)) {
        return;
      }
      city = cityById(forcedCityId);
    } else if (ev.city === '*' || !ev.city) {
      city = pickCity(state, beastDef, beastState, pref, items, rand, excludeCities, stampBlessing);
    } else if (Array.isArray(ev.city)) {
      const avail = ev.city.filter((c) => excludeCities.indexOf(c) < 0);
      if (!avail.length) return;
      city = cityById(randItem(rand, avail));
    } else {
      if (excludeCities.indexOf(ev.city) >= 0) return;
      city = cityById(ev.city);
    }
    if (!city) return;
    if (ev.weather && city.weather.indexOf(ev.weather) < 0) return;

    let w = ev.weight || 5;
    w *= 1 + overlap(ev.tags, beastDef.tags) * 0.6;
    if (pref) w *= 1 + overlap(ev.tags, pref.tags) * 0.5;
    if (quirk && quirk.tagBoost) {
      ev.tags.forEach((t) => {
        if (quirk.tagBoost[t]) w *= quirk.tagBoost[t];
      });
    }
    if (stampTags) {
      ev.tags.forEach((t) => {
        if (stampTags[t]) w *= stampTags[t];
      });
    }
    items.forEach((iid) => {
      const it = itemById(iid);
      if (!it || !it.boost) return;
      ev.tags.forEach((t) => {
        if (it.boost[t]) w *= 1 + (it.boost[t] - 1) * 0.7 + 0.35;
      });
    });
    if (state.seenEvents[ev.id]) w *= 0.16;
    if (ev.chain) w *= (ev.chain.step > 1 ? 6 : 4) * (hasExpress ? 1.5 : 1);
    if (ev.echo) w *= hasExpress ? 7.5 : 5;
    if (ev.weather && season && ev.weather === season.weatherBias) w *= 1.6;

    const vb = state.visitorBonus || {};
    ev.tags.forEach((t) => {
      if (vb[t]) w *= vb[t];
      if (aura.bonus[t]) w *= aura.bonus[t];
    });

    list.push({ ev, city, weight: w });
  });

  const hit = weightedPick(rand, list);
  if (!hit) return null;
  return {
    ev: hit.ev,
    city: hit.city,
    weather: pickWeather(hit.city, season, rand, hit.ev.weather)
  };
}

/* ---------- 出发 ---------- */
export function startTrip(state, beastId, preferenceId, itemIds, opts = {}) {
  const now = opts.now || Date.now();
  const beast = state.beasts[beastId];
  if (!beast || !beast.unlocked) return { ok: false, msg: '这只神兽还未加入驿站' };
  if (state.trips[beastId]) return { ok: false, msg: '它还在路上' };

  let partnerId = opts.partnerId || null;
  if (partnerId) {
    const pb = state.beasts[partnerId];
    if (!pb || !pb.unlocked || state.trips[partnerId] || partnerId === beastId) {
      partnerId = null;
    }
  }

  let giftSouvenir = opts.giftSouvenir || null;
  let targetCommission = null;
  if (giftSouvenir) {
    if (!(state.souvenirs[giftSouvenir] > 0)) return { ok: false, msg: '行囊里没有这件信物' };
    targetCommission = COMMISSIONS.find(
      (c) => c.wantSouvenir === giftSouvenir && !(state.commissions[c.id] && state.commissions[c.id].completed)
    ) || null;
    state.souvenirs[giftSouvenir] -= 1;
    if (state.souvenirs[giftSouvenir] <= 0) {
      delete state.souvenirs[giftSouvenir];
      Object.keys(state.placed).forEach((slot) => {
        if (state.placed[slot] === giftSouvenir) delete state.placed[slot];
      });
    }
  }

  const beastDef = beastById(beastId);
  const pref = PREFERENCES.find((p) => p.id === preferenceId) || PREFERENCES[0];
  const items = (itemIds || []).filter((id) => (state.inventory[id] || 0) > 0).slice(0, 3);
  items.forEach((id) => {
    state.inventory[id] -= 1;
    if (state.inventory[id] <= 0) delete state.inventory[id];
  });

  const stampBlessing = getBeastStampBlessing(state, beastId);
  if (stampBlessing && state.worldFlags) {
    delete state.worldFlags[`stamp_blessing:${beastId}`];
  }

  const seed = `${beastId}|${now}|${Math.floor(Math.random() * 1e6)}`;
  const rand = makeRng(`${seed}:plan`);
  const season = SEASONS[state.seasonIdx % SEASONS.length] || SEASONS[0];
  const aura = computeRoomAura(state);
  const hasVoyageAura = aura.all.some((a) => a.id === 'aura-voyage');

  const stops = [];
  const usedEvents = [];
  const excludeCities = [];
  const far = items.indexOf('map') >= 0 || items.indexOf('bamboo') >= 0 || items.indexOf('compass') >= 0;
  const twoStopProb = far && hasVoyageAura ? 0.88 : far || hasVoyageAura ? 0.78 : 0.38;
  const stopCount = rand() < twoStopProb ? 2 : 1;

  for (let i = 0; i < stopCount; i += 1) {
    const forcedCity = i === 0 && targetCommission ? targetCommission.targetCity : null;
    const hit = pickEvent(state, beastId, pref, items, rand, usedEvents, excludeCities, forcedCity, stampBlessing);
    if (!hit) {
      if (forcedCity) {
        const fc = cityById(forcedCity);
        excludeCities.push(fc.id);
        stops.push({ city: fc.id, weather: pickWeather(fc, season, rand), eventId: null });
        continue;
      }
      break;
    }
    usedEvents.push(hit.ev.id);
    excludeCities.push(hit.city.id);
    stops.push({ city: hit.city.id, weather: hit.weather, eventId: hit.ev.id });
  }

  if (!stops.length) {
    const c = pickCity(state, beastDef, beast, pref, items, rand, [], stampBlessing);
    stops.push({ city: c.id, weather: pickWeather(c, season, rand), eventId: null });
  }

  const isFirstTrip = totalStationTravels(state) === 0 && !(state.settings && state.settings.fastMode);
  let dur = CONSTANTS.DURATION.base + CONSTANTS.DURATION.perStop * stops.length + Math.floor(rand() * 5 * MIN);
  if (items.indexOf('waxseal') >= 0) dur = Math.round(dur * 0.65);
  if (state.settings && state.settings.fastMode) {
    dur = Math.max(15 * 1000, Math.round(dur * 0.06));
  } else if (isFirstTrip) {
    dur = items.indexOf('waxseal') >= 0 ? Math.round(CONSTANTS.FIRST_TRIP_MS * 0.65) : CONSTANTS.FIRST_TRIP_MS;
  }

  const trip = {
    beastId,
    beastName: beastDef.name,
    preference: pref.id,
    items,
    giftSouvenir,
    stampBlessing: stampBlessing ? stampBlessing.id : null,
    isFirstTrip,
    partnerId,
    seed,
    departAt: now,
    returnAt: now + dur,
    stops,
    resolved: false
  };
  state.trips[beastId] = trip;

  if (partnerId) {
    const pDef = beastById(partnerId);
    state.trips[partnerId] = {
      beastId: partnerId,
      beastName: pDef.name,
      companionOf: beastId,
      departAt: now,
      returnAt: trip.returnAt,
      stops: [],
      items: [],
      resolved: false
    };
  }

  return { ok: true, trip };
}

/* ---------- 结算辅助：组合式动态短笺与道具效果 ---------- */
function composeDynamicLetter(beastDef, city, weather, season, rand) {
  const opens = DYNAMIC_FRAGMENTS.openings[weather] || DYNAMIC_FRAGMENTS.openings.sunny;
  const obs = DYNAMIC_FRAGMENTS.observations[beastDef.id] || DYNAMIC_FRAGMENTS.observations.baize;
  const openLine = randItem(rand, opens);
  const obsLine = randItem(rand, obs);
  const closeLine = randItem(rand, DYNAMIC_FRAGMENTS.closings);
  return {
    title: `${city.name}的一隅 · ${season.name.split('·')[0]}`,
    body: `${openLine}\n我在${city.name}逛着，${obsLine}\n${closeLine}`
  };
}

function causesFor(beast, trip, ev) {
  const out = [];
  (Array.isArray(trip.items) ? trip.items : []).forEach((iid) => {
    const it = itemById(iid);
    if (!it) return;
    const hit = (ev && overlap(ev.tags, it.tags)) || (it.bias && trip.stops[0] && it.bias[trip.stops[0].city]);
    if (hit) out.push(`带上了「${it.name}」`);
  });
  if (beast.equippedQuirk) {
    const q = quirkById(beast.equippedQuirk);
    if (q) out.push(`带着「${q.name}」的心境`);
  }
  const order = beast.memoryOrder || [];
  order.slice(-2).reverse().forEach((k) => {
    if (MEMORY_LINES[k]) out.push(MEMORY_LINES[k]);
  });
  return out.slice(0, 4);
}

function applyItemEffects(trip, stop, ev, rand, acc) {
  const items = trip.items || [];
  const weather = stop.weather;
  items.forEach((iid) => {
    const it = itemById(iid);
    if (!it || !it.effect) return;
    switch (it.effect) {
      case 'postcard':
        if (rand() < 0.45) {
          acc.bonusSou = acc.bonusSou || 'sou-postcard';
          acc.takePhoto = true;
          acc.causes.push('旧式相机咔嚓拍下了这一刻');
        }
        break;
      case 'lore':
        if (ev && overlap(ev.tags, ['history', 'ancient', 'scholar'])) {
          acc.insightBonus += 1;
          acc.causes.push('它翻着古书残页做对照');
        }
        break;
      case 'rain':
        if (weather === 'rain') {
          acc.bonusSou = acc.bonusSou || 'sou-rain-bottle';
          acc.causes.push('雨里它撑开油纸伞，慢慢走');
        }
        break;
      case 'share':
        if (rand() < 0.55) {
          acc.bonusSou = acc.bonusSou || 'sou-postcard';
          acc.causes.push('它把桂花糕分给了路上的人');
        }
        break;
      case 'cheer':
        acc.insightBonus += 1;
        acc.causes.push('酸得直皱眉，心情却好了');
        break;
      case 'note':
        acc.dropBoost += 0.3;
        break;
      case 'meet':
        acc.dropBoost += 0.25;
        if (ev && overlap(ev.tags, ['social', 'letter'])) acc.causes.push('铃一响，就有人回头');
        break;
      case 'night':
        if (weather === 'night') {
          acc.bonusSou = acc.bonusSou || 'sou-lantern';
          acc.causes.push('小灯笼让它在夜里走得安稳');
        }
        break;
      case 'rare':
        acc.rareBoost = true;
        acc.insightBonus += 1;
        acc.causes.push('西域司南领着它拐进了不寻常的老巷');
        break;
      case 'express':
        acc.dropBoost += 0.2;
        acc.causes.push('加急火漆一路生风');
        break;
      default:
        break;
    }
  });
}

function composeCoAuthorDynamicLetter(beastA, beastB, city, weather, season, rand) {
  const opens = DYNAMIC_FRAGMENTS.openings[weather] || DYNAMIC_FRAGMENTS.openings.sunny;
  const obsA = DYNAMIC_FRAGMENTS.observations[beastA.id] || DYNAMIC_FRAGMENTS.observations.baize;
  const obsB = DYNAMIC_FRAGMENTS.observations[beastB.id] || DYNAMIC_FRAGMENTS.observations.jiuweihu;
  const cityName = city ? city.name : '山海道途';
  const seasonName = season ? season.name.split('·')[0] : '人间';
  return {
    title: `【合写】${cityName}同游杂记 · ${seasonName}`,
    body: `${randItem(rand, opens)}\n【${beastA.name}笔】今日与${beastB.name}在${cityName}结伴同行，${randItem(rand, obsA)}\n\n【${beastB.name}续】其实在半路我还发现件趣事：${randItem(rand, obsB)}路上遇着一位采药人，托我们顺手带些新采的灵材回驿站给掌柜添茶！`,
    cause: `${beastA.name}与${beastB.name}再次结伴游历 ${cityName}，合写短笺`
  };
}

function pickSouvenirWeighted(state, pool, rand) {
  if (!pool || !pool.length) return null;
  const weighted = pool.map((s) => ({
    s,
    weight: isSouvenirDiscovered(state, s.id) ? 1 : 3
  }));
  const hit = weightedPick(rand, weighted);
  return hit ? hit.s : pool[0];
}

function pickSeasonalMaterials(season, rand, count = 1) {
  const pool = MATERIALS.map((m) => ({
    mat: m,
    weight: season && season.materialBoost && season.materialBoost.indexOf(m.id) >= 0 ? 2.6 : 1
  }));
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const hit = weightedPick(rand, pool);
    if (hit) out.push(hit.mat);
  }
  return out;
}

export function advanceBeastProgression(state, beastId, now = Date.now()) {
  const beast = state && state.beasts && state.beasts[beastId];
  const beastDef = beastById(beastId);
  if (!beast || !beastDef) return { stages: [], stageLetters: [] };
  const stages = [];
  const stageLetters = [];
  while (beast.insight < 5 && beast.insightExp >= INSIGHT_THRESHOLD[beast.insight + 1]) {
    beast.insight += 1;
    const st = INSIGHT_STAGES[beast.insight];
    stages.push(st);
    stageLetters.unshift({
      id: `S${now}_${beastId}_${beast.insight}`,
      beastId,
      beastName: beastDef.name,
      city: null,
      cityName: '山海驿站',
      weather: null,
      title: `【第 ${beast.insight + 1} 阶 · ${st.name}】${st.desc}`,
      body: st.letter,
      eventId: null,
      reply: null,
      replied: null,
      opened: false,
      causes: [],
      souvenir: null,
      at: now,
      stage: true
    });
  }
  return { stages, stageLetters };
}

/* ---------- 结算旅行 ---------- */
export function resolveTrip(state, beastId, now = Date.now()) {
  const trip = state.trips[beastId];
  if (!trip || trip.resolved) return null;
  if (trip.companionOf) {
    return resolveTrip(state, trip.companionOf, now);
  }

  const beast = state.beasts[beastId];
  const beastDef = beastById(beastId);
  if (!beast || !beastDef) {
    delete state.trips[beastId];
    return null;
  }

  const rand = makeRng(`${trip.seed}:resolve`);
  const season = SEASONS[state.seasonIdx % SEASONS.length] || SEASONS[0];
  const aura = computeRoomAura(state);

  const letters = [];
  const gained = [];
  const tripCauses = [];
  const unlockedAll = [];

  trip.stops.forEach((stop, idx) => {
    const city = cityById(stop.city);
    if (!city) return;
    const ev = stop.eventId ? eventById(stop.eventId) : null;
    const causes = [];
    let title;
    let body;
    let souId;
    let insightGain = 1;
    let reply;

    if (ev && !state.seenEvents[ev.id]) {
      state.seenEvents[ev.id] = true;
      title = ev.title;
      body = ev.body;
      insightGain = ev.insight || 1;
      reply = ev.reply || null;
      if (ev.memory && ev.memory.set) writeMemory(beast, ev.memory.set);
      if (ev.worldFlag) state.worldFlags[ev.worldFlag] = true;
      if (ev.souvenir) souId = Array.isArray(ev.souvenir) ? randItem(rand, ev.souvenir) : ev.souvenir;
      if (ev.cause) causes.push(ev.cause);
    } else if (ev && rand() < 0.45) {
      title = ev.title;
      body = ev.body;
      insightGain = 1;
      reply = ev.reply || null;
      if (ev.souvenir) souId = Array.isArray(ev.souvenir) ? randItem(rand, ev.souvenir) : ev.souvenir;
      if (ev.cause) causes.push(ev.cause);
    } else {
      const dyn = composeDynamicLetter(beastDef, city, stop.weather, season, rand);
      title = dyn.title;
      body = dyn.body;
      reply = [
        { text: '写得真好，记在本子里吧', trait: 'scholar', memory: { record_habit: 1 } },
        { text: '路上平平安安就好', trait: 'calm', memory: { slow_down: 1 } },
        { text: '回来吃块热糕歇歇', trait: 'food', memory: { care_back: 1 } }
      ];
      if (rand() < 0.65) {
        const citySous = SOUVENIRS.filter((s) => s.city === city.id || s.city === '*');
        const pickedSou = pickSouvenirWeighted(state, citySous, rand) || SOUVENIRS[0];
        souId = pickedSou.id;
      }
    }

    if (idx === 0) {
      causesFor(beast, trip, ev).forEach((c) => {
        if (causes.indexOf(c) < 0) causes.push(c);
      });
      if (trip.stampBlessing) {
        const stDef = stampById(trip.stampBlessing);
        if (stDef) {
          causes.push(`带着上次落印「${stDef.name}」的余温`);
          if (stDef.blessing && stDef.blessing.bonusMaterial) {
            const mats = pickSeasonalMaterials(season, rand, 1);
            if (mats[0]) {
              state.materials[mats[0].id] = (state.materials[mats[0].id] || 0) + 1;
              causes.push(`「${stDef.name}」护佑额外拾得「${mats[0].name}」`);
            }
          }
        }
      }
    }

    const acc = { bonusSou: null, insightBonus: 0, dropBoost: 0, rareBoost: false, takePhoto: false, causes: [] };
    applyItemEffects(trip, stop, ev, rand, acc);
    acc.causes.forEach((c) => causes.push(c));
    insightGain += acc.insightBonus;

    if (aura.primary && aura.primary.id === 'aura-scholar') insightGain += 1;

    if (!souId && acc.rareBoost) {
      const rares = SOUVENIRS.filter((s) => s.rarity !== 'common' && (s.city === city.id || s.city === '*'));
      if (rares.length) souId = pickSouvenirWeighted(state, rares, rand).id;
    }
    if (!souId && acc.dropBoost > 0 && rand() < acc.dropBoost) {
      const pool = SOUVENIRS.filter((s) => s.city === city.id || s.city === '*');
      souId = (pickSouvenirWeighted(state, pool, rand) || SOUVENIRS[0]).id;
    }
    if (!souId && acc.bonusSou) souId = acc.bonusSou;

    if (souId) {
      state.souvenirs[souId] = (state.souvenirs[souId] || 0) + 1;
      markSouvenirDiscovered(state, souId);
      gained.push(souId);
    }

    beast.insightExp += insightGain;
    beast.visited[city.id] = (beast.visited[city.id] || 0) + 1;
    causes.forEach((c) => {
      if (tripCauses.indexOf(c) < 0) tripCauses.push(c);
    });

    letters.push({
      id: `L${now}_${idx}_${Math.floor(rand() * 1e6)}`,
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
      opened: false,
      stamp: null,
      causes: causes.slice(0, 5),
      souvenir: souId || null,
      at: now
    });

    if (acc.takePhoto || (souById(souId) && souById(souId).rarity !== 'common')) {
      state.postcards.unshift({
        id: `PC_${now}_${idx}_${Math.floor(rand() * 1e4)}`,
        beastId,
        coAuthorId: null,
        cityId: city.id,
        weather: stop.weather,
        title,
        caption: `${beastDef.name}在${city.name}留影`,
        stamp: null,
        at: now
      });
      state.postcards = state.postcards.slice(0, 80);
    }
  });

  // 结算第 4 格锦囊：跨城捎物委托 或 顺路赠礼回礼
  if (trip.giftSouvenir && trip.stops[0]) {
    const firstCityObj = cityById(trip.stops[0].city);
    const firstCity = trip.stops[0].city;
    const comm = COMMISSIONS.find(
      (c) =>
        c.wantSouvenir === trip.giftSouvenir &&
        c.targetCity === firstCity &&
        !(state.commissions[c.id] && state.commissions[c.id].completed)
    );
    if (comm) {
      const rec = state.commissions[comm.id] || { step: 0, completed: false };
      rec.step += 1;
      rec.completed = true;
      state.commissions[comm.id] = rec;

      if (comm.rewardSouvenir) {
        state.souvenirs[comm.rewardSouvenir] = (state.souvenirs[comm.rewardSouvenir] || 0) + 1;
        markSouvenirDiscovered(state, comm.rewardSouvenir);
        gained.push(comm.rewardSouvenir);
      }
      if (comm.rewardMaterial) {
        Object.keys(comm.rewardMaterial).forEach((m) => {
          state.materials[m] = (state.materials[m] || 0) + comm.rewardMaterial[m];
        });
      }
      if (comm.rewardStamp && state.stamps.indexOf(comm.rewardStamp) < 0) {
        state.stamps.push(comm.rewardStamp);
      }
      beast.insightExp += 3;

      letters.unshift({
        id: `C${now}_${comm.id}`,
        beastId,
        beastName: beastDef.name,
        city: comm.targetCity,
        cityName: firstCityObj ? firstCityObj.name : '远方',
        weather: trip.stops[0].weather,
        title: comm.fulfillTitle,
        body: comm.fulfillBody,
        eventId: null,
        commissionId: comm.id,
        reply: [
          { text: '替我向故人问好', trait: 'empathy', memory: { thank_friend: 1 } },
          { text: '信物能帮上忙太好了', trait: 'calm', memory: { value_ordinary: 1 } },
          { text: '这份情谊记进山海经里', trait: 'scholar', memory: { record_habit: 1 } }
        ],
        replied: null,
        opened: false,
        causes: [`捎带了「${(souById(trip.giftSouvenir) || {}).name || ''}」送到${comm.requester}手中`],
        souvenir: comm.rewardSouvenir || null,
        at: now
      });
    } else {
      // 普通风物顺路赠礼：转化为见闻与灵材回礼，绝不静默消失
      const giftName = (souById(trip.giftSouvenir) || {}).name || '驿站小物';
      const cityLabel = firstCityObj ? firstCityObj.name : '半途茶寮';
      const giftedMats = pickSeasonalMaterials(season, rand, 2);
      giftedMats.forEach((m) => {
        state.materials[m.id] = (state.materials[m.id] || 0) + 1;
      });
      beast.insightExp += 2;
      const matSummary = giftedMats.map((m) => m.name).join('、');
      if (letters[0]) {
        letters[0].body = `${letters[0].body}\n\n【顺路赠礼】途中我将你托我捎带的「${giftName}」送给了${cityLabel}的投缘茶客，人家欢喜极了，回赠了几份「${matSummary}」带回驿站。`;
        letters[0].causes = [`顺路赠出「${giftName}」，获赠 ${matSummary}`, ...(letters[0].causes || [])].slice(0, 5);
      }
    }
  }

  // 结算双兽同行羁绊、同伴升阶与合写家书（首次触发剧情合写，后续改写动态合写）
  let partnerStages = [];
  let partnerStageLetters = [];
  if (trip.partnerId && state.beasts[trip.partnerId]) {
    const partner = state.beasts[trip.partnerId];
    const pDef = beastById(trip.partnerId);
    const bondDelta = season.id === 'dahan' ? 2 : 1;
    beast.bonds[trip.partnerId] = (beast.bonds[trip.partnerId] || 0) + bondDelta;
    partner.bonds[beastId] = (partner.bonds[beastId] || 0) + bondDelta;
    partner.travels += 1;
    partner.insightExp += 2;
    if (trip.stops[0]) partner.visited[trip.stops[0].city] = (partner.visited[trip.stops[0].city] || 0) + 1;

    const pProg = advanceBeastProgression(state, trip.partnerId, now);
    partnerStages = pProg.stages;
    partnerStageLetters = pProg.stageLetters;

    state.worldFlags = state.worldFlags || {};
    const pairKey = [beastId, trip.partnerId].sort().join('_');
    const seenKey = `coauthor_seen:${pairKey}`;
    const cObj = cityById(trip.stops[0] && trip.stops[0].city);
    const pair = !state.worldFlags[seenKey]
      ? COAUTHOR_LETTERS.find((cl) => cl.beasts.indexOf(beastId) >= 0 && cl.beasts.indexOf(trip.partnerId) >= 0)
      : null;

    if (pair) {
      state.worldFlags[seenKey] = true;
      if (pair.souvenir) {
        state.souvenirs[pair.souvenir] = (state.souvenirs[pair.souvenir] || 0) + 1;
        markSouvenirDiscovered(state, pair.souvenir);
        gained.push(pair.souvenir);
      }
      letters.unshift({
        id: `CA_${now}_${beastId}_${trip.partnerId}`,
        beastId,
        beastName: beastDef.name,
        coAuthorId: trip.partnerId,
        coAuthorName: pDef.name,
        city: cObj ? cObj.id : null,
        cityName: cObj ? cObj.name : '半途茶寮',
        weather: trip.stops[0] ? trip.stops[0].weather : 'sunny',
        title: pair.title,
        body: pair.body,
        eventId: null,
        reply: [
          { text: '你们俩拌嘴比风景还好看', trait: 'food', memory: { comfort_others: 1 } },
          { text: '下次还一起出门作伴吧', trait: 'empathy', memory: { bring_friend: 1 } },
          { text: '这封双笔信我要裱起来', trait: 'scholar', memory: { record_habit: 1 } }
        ],
        replied: null,
        opened: false,
        causes: [pair.cause],
        souvenir: pair.souvenir || null,
        at: now
      });
    } else {
      const dynCo = composeCoAuthorDynamicLetter(
        beastDef,
        pDef,
        cObj,
        trip.stops[0] ? trip.stops[0].weather : 'sunny',
        season,
        rand
      );
      const giftMat = pickSeasonalMaterials(season, rand, 1)[0];
      if (giftMat) state.materials[giftMat.id] = (state.materials[giftMat.id] || 0) + 1;
      letters.unshift({
        id: `CAD_${now}_${beastId}_${trip.partnerId}`,
        beastId,
        beastName: beastDef.name,
        coAuthorId: trip.partnerId,
        coAuthorName: pDef.name,
        city: cObj ? cObj.id : null,
        cityName: cObj ? cObj.name : '半途茶寮',
        weather: trip.stops[0] ? trip.stops[0].weather : 'sunny',
        title: dynCo.title,
        body: dynCo.body,
        eventId: null,
        reply: [
          { text: '二位这趟默契更深了', trait: 'empathy', memory: { bring_friend: 1 } },
          { text: '带回的灵材正好拿来烹茶', trait: 'calm', memory: { care_back: 1 } },
          { text: '记下这页新的同行篇章', trait: 'scholar', memory: { record_habit: 1 } }
        ],
        replied: null,
        opened: false,
        causes: [dynCo.cause],
        souvenir: null,
        at: now
      });
    }
    delete state.trips[trip.partnerId];
  }

  if (letters.length) beast.travels += 1;

  // 每累计 3 次出行推进一个节气
  const totalTravels = totalStationTravels(state);
  state.seasonIdx = Math.floor(totalTravels / 3) % SEASONS.length;

  // 认知弧线六阶升级（主出行神兽 + 同伴汇总）
  const mainProg = advanceBeastProgression(state, beastId, now);
  const stages = [...mainProg.stages, ...partnerStages];
  const stageLetters = [...mainProg.stageLetters, ...partnerStageLetters];

  state.letters = stageLetters.concat(letters, state.letters);
  delete state.trips[beastId];

  const jwUnlocked = checkJingweiUnlock(state, now);
  if (jwUnlocked) unlockedAll.push(jwUnlocked);
  refreshVisitors(state, now);

  return {
    beastId,
    letters: stageLetters.concat(letters),
    gained,
    causes: tripCauses,
    stages,
    unlockedBeast: jwUnlocked
  };
}

export function tickTrips(state, now = Date.now()) {
  const done = [];
  Object.keys(state.trips).forEach((bid) => {
    const t = state.trips[bid];
    if (t && !t.resolved && !t.companionOf && now >= t.returnAt) {
      const r = resolveTrip(state, bid, now);
      if (r) done.push(r);
    }
  });
  return done;
}

export function hourglassLeft(state, now = Date.now()) {
  const today = fmtDate(now);
  const hg = state.hourglass || { day: today, used: 0 };
  if (hg.day !== today) return CONSTANTS.HOURGLASS_LIMIT;
  return Math.max(0, CONSTANTS.HOURGLASS_LIMIT - hg.used);
}

export function forceReturn(state, beastId, now = Date.now()) {
  let targetId = beastId;
  let t = state.trips[targetId];
  if (t && t.companionOf) {
    targetId = t.companionOf;
    t = state.trips[targetId];
  }
  if (!t) return null;
  const today = fmtDate(now);
  const hg = state.hourglass || (state.hourglass = { day: today, used: 0 });
  if (hg.day !== today) {
    hg.day = today;
    hg.used = 0;
  }
  if (hg.used >= CONSTANTS.HOURGLASS_LIMIT) {
    return { limited: true, remain: 0 };
  }
  hg.used += 1;
  t.returnAt = now;
  return resolveTrip(state, targetId, now);
}

/* ---------- 拆信与盖印回信 ---------- */
export function openLetter(state, letterId) {
  const letter = state.letters.find((l) => l.id === letterId);
  if (!letter) return null;
  letter.opened = true;
  return letter;
}

export function replyLetter(state, letterId, optionIndex, stampId = 'jianzi', now = Date.now()) {
  const letter = state.letters.find((l) => l.id === letterId);
  if (!letter || letter.replied != null || !letter.reply) return null;
  const opt = letter.reply[optionIndex];
  if (!opt) return null;

  const chosenStamp = state.stamps.indexOf(stampId) >= 0 ? stampId : state.stamps[0] || 'jianzi';
  const targetIds = letter.visitor
    ? BEASTS.filter((b) => state.beasts[b.id] && state.beasts[b.id].unlocked).map((b) => b.id)
    : [letter.beastId, letter.coAuthorId].filter((id) => id && state.beasts[id]);

  const newlyUnlockedQuirks = [];
  const stages = [];
  const stageLetters = [];
  state.worldFlags = state.worldFlags || {};

  targetIds.forEach((bid) => {
    const beast = state.beasts[bid];
    if (!beast) return;
    if (opt.memory) writeMemory(beast, opt.memory);
    if (opt.trait && beast.traits) {
      beast.traits[opt.trait] = (beast.traits[opt.trait] || 0) + 1;
    }
    if (!letter.visitor) {
      beast.insightExp += 1;
      // 记录本神兽下趟出行可激活的朱砂闲章余温
      state.worldFlags[`stamp_blessing:${bid}`] = chosenStamp;
    }
    const unlocked = unlockEligibleQuirks(beast);
    unlocked.forEach((q) => newlyUnlockedQuirks.push({ beast, quirk: q }));

    if (!letter.visitor) {
      const prog = advanceBeastProgression(state, bid, now);
      prog.stages.forEach((st) => stages.push(st));
      prog.stageLetters.forEach((sl) => stageLetters.push(sl));
    }
  });

  letter.opened = true;
  letter.replied = optionIndex;
  letter.replyText = opt.text;
  letter.stamp = chosenStamp;

  if (stageLetters.length) {
    state.letters = stageLetters.concat(state.letters);
  }
  const unlockedBeast = !letter.visitor ? checkJingweiUnlock(state, now) : null;

  return { opt, letter, newlyUnlockedQuirks, stages, stageLetters, unlockedBeast };
}

/* ---------- 图鉴与统计 ---------- */
export function ownedSouvenirCount(state) {
  return SOUVENIRS.filter((s) => isSouvenirDiscovered(state, s.id)).length;
}

export function codexProgress(state) {
  return CODEX_GROUPS.map((g) => {
    let n = 0;
    Object.keys(state.seenEvents || {}).forEach((eid) => {
      const ev = eventById(eid);
      if (ev && overlap(ev.tags, g.tags) > 0) n += 1;
    });
    return { ...g, count: n, pct: Math.min(100, Math.round((n / g.goal) * 100)) };
  });
}

export function computeTimeOfDay(state, now = Date.now()) {
  if (state && state.timeOfDay && state.timeOfDay !== 'auto') return state.timeOfDay;
  const h = new Date(now).getHours();
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 17) return 'noon';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function beastIdleQuote(state, beastId, seedIdx = 0) {
  const bs = state.beasts[beastId];
  const def = beastById(beastId);
  if (!bs || !def) return '';
  const stage = INSIGHT_STAGES[bs.insight] || INSIGHT_STAGES[0];
  const pool = (def.quotes || []).slice();
  if (bs.insight === 0) pool.unshift('人间……好大。到处都在发光。');
  else pool.unshift(stage.desc);

  const aura = computeRoomAura(state);
  if (aura.primary) {
    pool.push(`堂前这「${aura.primary.name}」摆得真舒服。`);
  }
  const order = bs.memoryOrder || [];
  if (order.length && MEMORY_LINES[order[order.length - 1]]) {
    pool.push(`我还记得，${MEMORY_LINES[order[order.length - 1]]}。`);
  }
  return pool[Math.abs(seedIdx) % pool.length];
}

export function petBeast(state, beastId, now = Date.now()) {
  const bs = state.beasts[beastId];
  if (!bs) return null;
  bs.petCount = (bs.petCount || 0) + 1;

  state.worldFlags = state.worldFlags || {};
  const today = fmtDate(now);
  const giftKey = `pet_gift_day:${beastId}`;
  let giftedMaterial = null;
  if (state.worldFlags[giftKey] !== today) {
    state.worldFlags[giftKey] = today;
    const season = SEASONS[(state.seasonIdx || 0) % SEASONS.length] || SEASONS[0];
    const rand = makeRng(`pet:${today}:${beastId}`);
    giftedMaterial = pickSeasonalMaterials(season, rand, 1)[0] || MATERIALS[0];
    if (giftedMaterial) {
      state.materials[giftedMaterial.id] = (state.materials[giftedMaterial.id] || 0) + 1;
    }
  }
  return { count: bs.petCount, giftedMaterial };
}

export {
  BEASTS,
  CITIES,
  SEASONS,
  TRAITS,
  PERSONA_QUIRKS,
  MATERIALS,
  ITEMS,
  SOUVENIRS,
  COMMISSIONS,
  ROOM_AURAS,
  VISITORS,
  STAMPS,
  PREFERENCES,
  INSIGHT_THRESHOLD,
  INSIGHT_STAGES,
  CODEX_GROUPS,
  MEMORY_LINES,
  EVENTS
};
