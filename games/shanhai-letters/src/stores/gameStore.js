/**
 * 《山海来信 v2.0》响应式状态与云存档协同仓库
 * 封装局部存储、云端防抖同步、1s 时钟驱动、飞行轨迹特效与震屏反馈。
 */
import { reactive, computed } from 'vue';
import '../../../../static/shanhai-letters/src/cloudCore.js';
import {
  BEASTS,
  SEASONS,
  createFreshState,
  normalizeState,
  grantStarterItems,
  grantWelcomeLetter,
  syncDiscoveredSouvenirs,
  isFreshState,
  refreshVisitors,
  computeRoomAura,
  computeTimeOfDay,
  tickTrips,
  startTrip,
  forceReturn,
  hourglassLeft,
  openLetter,
  replyLetter,
  equipQuirk,
  placeSouvenir,
  tradeWithVisitor,
  harvestGarden,
  craftItem,
  supplyRemain,
  petBeast,
  beastIdleQuote,
  ownedSouvenirCount,
  codexProgress,
  beastById,
  itemById,
  souById
} from '../systems/gameSystems.js';
import {
  storageBridge,
  hapticsBridge,
  audioBridge,
  httpRequest,
  platformInfo
} from '../bridge/platformBridge.js';
import { getAgentServiceUrl } from '../../../../src/shared/agentAccess.js';

const SAVE_KEY = 'shanhai-letters:save:v1';
const CLOUD_CORE = globalThis.SHANHAI_CLOUD_CORE;
const apiBase = () => `${getAgentServiceUrl()}/api/shanhai`;

let toastTimer = null;
let shakeTimer = null;
let syncTimer = null;
let tickInterval = null;
let pollInterval = null;

export const gameState = reactive({
  state: createFreshState(),
  view: {
    scene: 'hall',        // 'hall' | 'yard'
    modal: null,          // null | 'pack' | 'mail' | 'tea' | 'shelf' | 'beast' | 'codex' | 'settings'
    codexTab: 'progress', // 'progress' | 'souvenirs' | 'cities' | 'album'
    shelfTab: 'shelf',    // 'shelf' | 'visitors'
    prepBeast: 'baize',
    prepPartner: null,
    prepPref: 'free',
    prepItems: [],
    prepGift: null,
    openLetterId: null,
    placingSlot: 0,
    inspectBeastId: 'baize',
    bubbleBeastId: null,
    bubbleSeed: 0,
    bubbleText: '',
    bubbleVisitorId: null,
    now: Date.now(),
    screenShake: false,
    flights: [],
    toast: null,
    petAnim: {}           // beastId -> timestamp
  },
  cloud: {
    enabled: false,
    disabledReason: '',
    meta: CLOUD_CORE.parseMeta(storageBridge.get(CLOUD_CORE.META_KEY)),
    offset: 0,
    inFlight: false,
    lastError: '',
    conflict: null,
    panelMessage: ''
  }
});

/* ---------- 计算视图派生量 ---------- */
export const unreadLetters = computed(() =>
  gameState.state.letters.filter((l) => !l.opened || (l.reply && l.replied == null))
);

export const currentSeason = computed(() =>
  SEASONS[(gameState.state.seasonIdx || 0) % SEASONS.length] || SEASONS[0]
);

export const currentTimeOfDay = computed(() =>
  computeTimeOfDay(gameState.state, gameState.view.now + gameState.cloud.offset)
);

export const currentAura = computed(() => computeRoomAura(gameState.state));

export const codexSummary = computed(() => {
  const prog = codexProgress(gameState.state);
  const avg = Math.round(prog.reduce((s, p) => s + p.pct, 0) / prog.length);
  return { prog, avg, owned: ownedSouvenirCount(gameState.state) };
});

/* ---------- 工具与反馈 ---------- */
export function serverNow() {
  return Date.now() + gameState.cloud.offset;
}

export function showToast(msg, type = 'normal', action = null) {
  const id = `${Date.now()}_${Math.random()}`;
  gameState.view.toast = { id, msg, type, action };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (gameState.view.toast && gameState.view.toast.id === id) {
      gameState.view.toast = null;
    }
  }, action ? 5200 : 3200);
}

export function triggerShake(ms = 240) {
  gameState.view.screenShake = true;
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => {
    gameState.view.screenShake = false;
  }, ms);
}

export function emitFlight({ fromRect, toSelector, kind, id, label }) {
  if (typeof document === 'undefined') return;
  let target = null;
  if (toSelector) {
    const candidates = Array.from(document.querySelectorAll(toSelector));
    target = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || candidates[0] || null;
  }
  const fromX = fromRect ? fromRect.left + fromRect.width / 2 : window.innerWidth * 0.5;
  const fromY = fromRect ? fromRect.top + fromRect.height / 2 : window.innerHeight * 0.5;
  const toRect = target ? target.getBoundingClientRect() : null;
  const toX = toRect ? toRect.left + toRect.width / 2 : window.innerWidth * 0.5;
  const toY = toRect ? toRect.top + toRect.height / 2 : window.innerHeight * 0.5;

  const flight = {
    id: `fl_${Date.now()}_${Math.random()}`,
    fromX,
    fromY,
    toX,
    toY,
    kind,
    itemId: id,
    label
  };
  gameState.view.flights.push(flight);
  setTimeout(() => {
    const idx = gameState.view.flights.findIndex((f) => f.id === flight.id);
    if (idx >= 0) gameState.view.flights.splice(idx, 1);
  }, 620);
}

/* ---------- 存读档与云同步 ---------- */
function saveCloudMeta() {
  storageBridge.set(CLOUD_CORE.META_KEY, JSON.stringify(gameState.cloud.meta));
}

export function saveGame(skipCloudMark = false) {
  storageBridge.set(SAVE_KEY, JSON.stringify(gameState.state));
  if (!skipCloudMark && gameState.cloud.enabled) {
    gameState.cloud.meta.dirty = true;
    saveCloudMeta();
    scheduleCloudPush(1800);
  }
}

function scheduleCloudPush(delay = 1800) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushCloudSave();
  }, delay);
}

async function ensureGuestToken() {
  if (gameState.cloud.meta.token) return gameState.cloud.meta.token;
  const res = await httpRequest(`${apiBase()}/guest`, { method: 'POST', body: {} });
  if (res.status !== 201 || !res.data || !res.data.token) {
    throw new Error('guest_failed');
  }
  gameState.cloud.meta.token = res.data.token;
  gameState.cloud.meta.code = res.data.transferCode || gameState.cloud.meta.code;
  gameState.cloud.meta.profileId = res.data.profileId || gameState.cloud.meta.profileId;
  gameState.cloud.meta.rev = Number(res.data.rev) || 0;
  saveCloudMeta();
  return gameState.cloud.meta.token;
}

export async function pushCloudSave() {
  const c = gameState.cloud;
  if (!c.enabled || c.inFlight || c.conflict) return;
  c.inFlight = true;
  try {
    await ensureGuestToken();
    const res = await httpRequest(`${apiBase()}/save`, {
      method: 'PUT',
      token: c.meta.token,
      body: { rev: c.meta.rev, state: gameState.state }
    });
    if (res.status === 200 && res.data) {
      c.meta.rev = Number(res.data.rev) || c.meta.rev;
      c.meta.dirty = false;
      c.meta.lastSyncAt = Date.now();
      c.lastError = '';
      saveCloudMeta();
    } else if (res.status === 409 && res.data) {
      c.conflict = {
        remoteRev: Number(res.data.rev) || c.meta.rev,
        localRev: c.meta.rev,
        updatedAt: res.data.updatedAt || 0
      };
    } else if (res.status === 401) {
      c.meta.token = '';
      c.meta.dirty = true;
      saveCloudMeta();
    } else {
      c.lastError = `同步状态 ${res.status}`;
    }
  } catch {
    c.lastError = '离线暂存，联网后补传';
  } finally {
    c.inFlight = false;
  }
}

export async function pullCloudOnStart() {
  const c = gameState.cloud;
  if (!c.enabled) return;
  try {
    if (!c.meta.token) {
      if (!isFreshState(gameState.state)) await pushCloudSave();
      return;
    }
    const res = await httpRequest(`${apiBase()}/save`, { token: c.meta.token });
    if (res.status !== 200 || !res.data) return;
    const remote = res.data;
    const decision = CLOUD_CORE.decideSync({
      remoteRev: Number(remote.rev) || 0,
      localRev: c.meta.rev,
      localDirty: c.meta.dirty,
      remoteHasState: !!remote.state,
      localFresh: isFreshState(gameState.state)
    });
    if (decision === 'pull' && remote.state) {
      applyRemoteState(remote);
    } else if (decision === 'push') {
      await pushCloudSave();
    } else if (decision === 'conflict') {
      c.conflict = {
        remoteRev: Number(remote.rev) || 0,
        localRev: c.meta.rev,
        updatedAt: remote.updatedAt || 0
      };
    }
  } catch {
    /* 网络不可达时安静降级本地 */
  }
}

function applyRemoteState(remote) {
  gameState.state = normalizeState(remote.state, false);
  syncDiscoveredSouvenirs(gameState.state);
  refreshVisitors(gameState.state, serverNow());
  gameState.cloud.meta.rev = Number(remote.rev) || 0;
  gameState.cloud.meta.dirty = false;
  gameState.cloud.meta.lastSyncAt = Date.now();
  saveCloudMeta();
  saveGame(true);
  syncAudioPrefs();
}

export async function resolveCloudConflict(choice) {
  const c = gameState.cloud;
  if (!c.conflict) return;
  if (choice === 'cloud') {
    const res = await httpRequest(`${apiBase()}/save`, { token: c.meta.token });
    if (res.status === 200 && res.data && res.data.state) {
      applyRemoteState(res.data);
      c.conflict = null;
      c.panelMessage = '已采用云端存档';
      showToast('已恢复为云端进度');
    }
  } else if (choice === 'local') {
    c.meta.rev = c.conflict.remoteRev;
    c.conflict = null;
    c.meta.dirty = true;
    saveCloudMeta();
    await pushCloudSave();
    c.panelMessage = '已用本地存档覆盖云端';
    showToast('已同步本地进度至云端');
  } else {
    c.conflict = null;
  }
}

export async function bindTransferCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (code.length !== 6) {
    gameState.cloud.panelMessage = '请输入 6 位转移码';
    return;
  }
  try {
    const res = await httpRequest(`${apiBase()}/guest`, {
      method: 'POST',
      body: { transferCode: code }
    });
    if (res.status !== 200 || !res.data || !res.data.token) {
      gameState.cloud.panelMessage = '转移码无效或暂不可用';
      return;
    }
    gameState.cloud.meta.token = res.data.token;
    gameState.cloud.meta.code = res.data.transferCode;
    gameState.cloud.meta.profileId = res.data.profileId;
    gameState.cloud.meta.rev = Number(res.data.rev) || 0;
    gameState.cloud.meta.dirty = false;
    saveCloudMeta();

    const remote = await httpRequest(`${apiBase()}/save`, { token: res.data.token });
    if (remote.status === 200 && remote.data && remote.data.state) {
      applyRemoteState(remote.data);
      gameState.cloud.panelMessage = '已拉取并载入云端存档';
      showToast('跨端存档已载入');
    } else {
      gameState.cloud.panelMessage = '已绑定转移码，云端尚无档案';
    }
  } catch {
    gameState.cloud.panelMessage = '网络异常，绑定失败';
  }
}

/* ---------- 音频与触感同步 ---------- */
export function syncAudioPrefs() {
  const s = gameState.state.settings || {};
  audioBridge.setMuted(!!s.muted);
  audioBridge.setAmbientMuted(!!s.ambientMuted);
  hapticsBridge.setEnabled(s.haptics !== false);
  if (!s.muted && !s.ambientMuted) {
    const weather = currentSeason.value.weatherBias || 'sunny';
    audioBridge.syncAmbient(gameState.view.scene, weather);
  }
}

/* ---------- 业务动作 ---------- */
function notifyReturnResults(results) {
  const done = (results || []).filter((r) => r && r.letters && r.letters.length);
  if (!done.length) return;
  audioBridge.arrive();
  hapticsBridge.trigger('medium');
  const names = done.map((r) => r.letters[0].beastName).join('、');
  const gainedCount = done.reduce((n, r) => n + r.gained.length, 0);
  const souStr = gainedCount ? `，带回 ${gainedCount} 件风物` : '';
  const firstLetter = done[0].letters.find((l) => !l.stage) || done[0].letters[0];

  if (done.some((r) => r.unlockedBeast)) {
    showToast('雨夜叩门：新同伴「精卫」加入了山海驿站！', 'return', {
      label: '去读信',
      act: () => openMailDrawer(firstLetter ? firstLetter.id : null)
    });
    return;
  }

  showToast(`${names} 归来${souStr}`, 'return', {
    label: '拆信',
    act: () => openMailDrawer(firstLetter ? firstLetter.id : null)
  });
}

export function switchScene(targetScene) {
  const next = targetScene || (gameState.view.scene === 'hall' ? 'yard' : 'hall');
  if (gameState.view.scene === next) return;
  audioBridge.tap();
  hapticsBridge.trigger('light');
  gameState.view.scene = next;
  gameState.view.bubbleBeastId = null;
  gameState.view.bubbleVisitorId = null;
  gameState.view.modal = null;
  syncAudioPrefs();
}

export function openModal(modalName) {
  audioBridge.paperOpen();
  hapticsBridge.trigger('light');
  gameState.view.bubbleBeastId = null;
  gameState.view.bubbleVisitorId = null;
  gameState.view.modal = modalName;
  if (modalName === 'pack') {
    const home = BEASTS.filter((b) => gameState.state.beasts[b.id]?.unlocked && !gameState.state.trips[b.id]);
    if (!gameState.view.prepBeast || gameState.state.trips[gameState.view.prepBeast] || !gameState.state.beasts[gameState.view.prepBeast]?.unlocked) {
      gameState.view.prepBeast = home[0] ? home[0].id : null;
    }
  }
}

export function closeModal() {
  audioBridge.tap();
  gameState.view.modal = null;
}

export function openMailDrawer(letterId = null) {
  if (letterId) gameState.view.openLetterId = letterId;
  else {
    const target = unreadLetters.value[0] || gameState.state.letters[0];
    gameState.view.openLetterId = target ? target.id : null;
  }
  openModal('mail');
}

export function tapBeastOnStage(beastId) {
  const bs = gameState.state.beasts[beastId];
  if (!bs || !bs.unlocked) return;
  const petRes = petBeast(gameState.state, beastId, serverNow()) || { count: 1, giftedMaterial: null };
  const idx = BEASTS.findIndex((b) => b.id === beastId);
  audioBridge.pet(idx, petRes.count % 4);
  hapticsBridge.trigger('light');
  gameState.view.petAnim[beastId] = Date.now();
  gameState.view.bubbleVisitorId = null;

  if (gameState.view.bubbleBeastId === beastId) {
    gameState.view.bubbleSeed += 1;
  } else {
    gameState.view.bubbleBeastId = beastId;
    gameState.view.bubbleSeed = Math.floor(Math.random() * 12);
  }
  gameState.view.bubbleText = beastIdleQuote(gameState.state, beastId, gameState.view.bubbleSeed);
  if (petRes.giftedMaterial) {
    const bName = beastById(beastId)?.name || '神兽';
    showToast(`${bName}蹭了蹭你的手心，顺爪递来一份「${petRes.giftedMaterial.name}」`);
  }
  saveGame();
}

export function doHarvestGarden(event) {
  const now = serverNow();
  const r = harvestGarden(gameState.state, now);
  if (!r.ok) {
    audioBridge.tap();
    showToast(`灵草仍在蓄露，还需 ${Math.ceil(r.remain / 1000)} 秒`, 'warn');
    return;
  }
  audioBridge.herb();
  hapticsBridge.trigger('medium');
  if (event && event.currentTarget) {
    const rect = event.currentTarget.getBoundingClientRect();
    emitFlight({
      fromRect: rect,
      toSelector: '[data-flight-target="tea"], [data-flight-target="tea-dock"]',
      kind: 'material',
      id: r.gotMaterials[0]?.id || 'dew',
      label: `+${r.gotMaterials.length} 灵材`
    });
  }
  const names = r.gotMaterials.map((m) => m.name).slice(0, 3).join('、');
  const bonusStr = r.bonusItem ? `，另拾得「${r.bonusItem.name}」` : '';
  showToast(`采撷灵草得 ${names}${bonusStr}`);
  saveGame();
}

export function doCraftItem(itemId, event) {
  const r = craftItem(gameState.state, itemId);
  if (!r.ok) {
    audioBridge.tap();
    showToast(r.msg, 'warn');
    return;
  }
  audioBridge.craft();
  hapticsBridge.trigger('medium');
  if (event && event.currentTarget) {
    emitFlight({
      fromRect: event.currentTarget.getBoundingClientRect(),
      toSelector: '[data-flight-target="pack"]',
      kind: 'item',
      id: itemId,
      label: r.item.name
    });
  }
  showToast(`茶案手作完成：「${r.item.name}」×1`);
  saveGame();
}

export function doDepartTrip() {
  const v = gameState.view;
  if (!v.prepBeast) {
    showToast('先选一只在家的神兽', 'warn');
    return false;
  }
  const res = startTrip(gameState.state, v.prepBeast, v.prepPref, v.prepItems.slice(), {
    giftSouvenir: v.prepGift,
    partnerId: v.prepPartner,
    now: serverNow()
  });
  if (!res.ok) {
    showToast(res.msg, 'warn');
    return false;
  }
  const bDef = beastById(v.prepBeast);
  const pDef = v.prepPartner ? beastById(v.prepPartner) : null;
  audioBridge.depart();
  hapticsBridge.trigger('medium');
  v.prepItems = [];
  v.prepGift = null;
  v.prepPartner = null;
  v.modal = null;
  showToast(
    pDef
      ? `${bDef.name} 与 ${pDef.name} 结伴背起包袱出门了，路上会合写来信`
      : `${bDef.name} 背起包袱出门了，远方寄信回来`
  );
  saveGame();
  return true;
}

export function doForceReturn(beastId) {
  const left = hourglassLeft(gameState.state, serverNow());
  if (!left) {
    showToast('今日静心沙漏已用尽，明天再来', 'warn');
    return;
  }
  const r = forceReturn(gameState.state, beastId, serverNow());
  if (!r || r.limited) {
    showToast('今日静心沙漏已用尽', 'warn');
    return;
  }
  saveGame();
  notifyReturnResults([r]);
}

export function doOpenLetter(letterId) {
  const l = openLetter(gameState.state, letterId);
  if (l) {
    audioBridge.waxBreak();
    setTimeout(() => audioBridge.paperOpen(), 90);
    hapticsBridge.trigger('medium');
    saveGame();
  }
}

export function doReplyLetter(letterId, optionIndex, stampId) {
  const res = replyLetter(gameState.state, letterId, optionIndex, stampId, serverNow());
  if (!res) return null;
  audioBridge.stampPress();
  hapticsBridge.trigger('heavy');
  triggerShake(260);
  saveGame();
  if (res.unlockedBeast) {
    showToast('雨夜叩门：新同伴「精卫」加入了山海驿站！', 'return');
  } else if (res.stages && res.stages.length) {
    showToast(`心境升阶：迈入第 ${res.stages[0].n + 1} 阶「${res.stages[0].name}」！`, 'return');
  } else if (res.newlyUnlockedQuirks.length) {
    const first = res.newlyUnlockedQuirks[0];
    showToast(`心境共鸣：觉醒新印记「${first.quirk.name}」！`, 'return');
  } else {
    showToast('已加盖朱砂闲章并寄出回信');
  }
  return res;
}

export function doEquipQuirk(beastId, quirkId) {
  const r = equipQuirk(gameState.state, beastId, quirkId);
  if (!r.ok) return showToast(r.msg, 'warn');
  audioBridge.wood();
  hapticsBridge.trigger('light');
  saveGame();
  showToast(r.quirk ? `已佩戴心境印记「${r.quirk.name}」` : '已卸下后天印记');
}

export function doPlaceSouvenir(slot, souId) {
  const r = placeSouvenir(gameState.state, slot, souId, serverNow());
  if (!r.ok) return showToast(r.msg, 'warn');
  audioBridge.wood();
  hapticsBridge.trigger('light');
  saveGame();
  if (r.unlocked && r.unlocked.length) {
    showToast(`堂前生香，引来访客「${r.unlocked.map((u) => u.name).join('、')}」`, 'return');
  } else if (souId) {
    const sou = souById(souId);
    showToast(r.movedFrom == null ? `已将「${sou?.name}」摆上博古架` : `已将「${sou?.name}」挪至第 ${slot + 1} 格`);
  } else {
    showToast('已收回珍藏柜');
  }
}

export function doTradeVisitor(visitorId, tradeId) {
  const r = tradeWithVisitor(gameState.state, visitorId, tradeId);
  if (!r.ok) {
    audioBridge.tap();
    showToast(r.msg, 'warn');
    return;
  }
  audioBridge.craft();
  hapticsBridge.trigger('medium');
  saveGame();
  showToast(`人情往来：换得 ${r.gainName}`);
}

export function doResetSave() {
  storageBridge.remove(SAVE_KEY);
  gameState.state = createFreshState();
  grantStarterItems(gameState.state);
  grantWelcomeLetter(gameState.state, serverNow());
  refreshVisitors(gameState.state, serverNow());
  saveGame();
  gameState.view.modal = null;
  gameState.view.scene = 'hall';
  gameState.view.prepItems = [];
  gameState.view.prepGift = null;
  gameState.view.prepPartner = null;
  gameState.view.openLetterId = null;
  syncAudioPrefs();
  showToast('山海驿站已重新开张');
}

export function doImportSave(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('这不是有效的 JSON 文件');
  }
  gameState.state = normalizeState(raw, true);
  syncDiscoveredSouvenirs(gameState.state);
  refreshVisitors(gameState.state, serverNow());
  saveGame();
  syncAudioPrefs();
  gameState.view.modal = null;
  showToast('存档已导入');
}

/* ---------- 生命周期启动 ---------- */
export async function bootGame() {
  const rawStr = storageBridge.get(SAVE_KEY);
  let rawObj = null;
  if (rawStr) {
    try {
      rawObj = JSON.parse(rawStr);
    } catch {
      rawObj = null;
    }
  }
  gameState.state = normalizeState(rawObj, false);
  if (isFreshState(gameState.state) && !Object.keys(gameState.state.inventory).length) {
    grantStarterItems(gameState.state);
  }
  syncDiscoveredSouvenirs(gameState.state);
  grantWelcomeLetter(gameState.state, serverNow());
  refreshVisitors(gameState.state, serverNow());
  saveGame(true);
  syncAudioPrefs();

  // 启动即刻结算离线途中到期的旅行
  const initialDone = tickTrips(gameState.state, serverNow());
  if (initialDone.length) {
    saveGame(true);
    setTimeout(() => notifyReturnResults(initialDone), 450);
  }

  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    gameState.view.now = Date.now();
  }, 1000);

  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    const done = tickTrips(gameState.state, serverNow());
    if (done.length) {
      saveGame();
      notifyReturnResults(done);
    }
  }, 4000);

  // 初始化云存档授时与同步（file:// 或未部署服务端时静默降级本地）
  const pInfo = platformInfo();
  if (pInfo.isFile) {
    gameState.cloud.enabled = false;
    gameState.cloud.disabledReason = '本地文件打开，仅启用本地存档';
  } else {
    try {
      const res = await httpRequest(`${apiBase()}/time`);
      if (res.status === 200 && res.data && Number.isFinite(Number(res.data.now))) {
        gameState.cloud.offset = Number(res.data.now) - Date.now();
        gameState.cloud.enabled = true;
        await pullCloudOnStart();
      } else {
        gameState.cloud.enabled = false;
        gameState.cloud.disabledReason = '云端服务暂未开启，使用本地存档';
      }
    } catch {
      gameState.cloud.enabled = false;
      gameState.cloud.disabledReason = '云端暂不可达，已使用本地存档';
    }
  }
}

export { BEASTS, itemById, supplyRemain };
