<script setup>
import { computed, ref } from 'vue';
import gsap from 'gsap';
import {
  BEASTS,
  ITEMS,
  PREFERENCES,
  SOUVENIRS,
  COMMISSIONS,
  CONSTANTS,
  cityById,
  itemById,
  souById,
  quirkById,
  getBeastStampBlessing,
  totalStationTravels
} from '../systems/gameSystems.js';
import {
  gameState,
  closeModal,
  doDepartTrip,
  emitFlight,
  showToast,
  openModal
} from '../stores/gameStore.js';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import ArtSprite from './ArtSprite.vue';
import GameIcon from './GameIcon.vue';

const tying = ref(false);
const furoshikiRef = ref(null);

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);

const unlockedBeasts = computed(() => BEASTS.filter((b) => state.value.beasts[b.id]?.unlocked));
const lockedJingwei = computed(() => !state.value.beasts.jingwei?.unlocked);

const selectedBeast = computed(() => {
  const id = view.value.prepBeast;
  return BEASTS.find((b) => b.id === id) || null;
});

const selectedBeastState = computed(() =>
  selectedBeast.value ? state.value.beasts[selectedBeast.value.id] : null
);

const activeStampBlessing = computed(() =>
  selectedBeast.value ? getBeastStampBlessing(state.value, selectedBeast.value.id) : null
);

const availablePartners = computed(() =>
  unlockedBeasts.value.filter((b) => b.id !== view.value.prepBeast && !state.value.trips[b.id])
);

const activePref = computed(() =>
  PREFERENCES.find((p) => p.id === view.value.prepPref) || PREFERENCES[0]
);

/* 筛选当前拥有的可捎带跨城信物（优先高亮有未完成故人委托匹配的纪念品） */
const giftCandidates = computed(() => {
  const owned = SOUVENIRS.filter((s) => (state.value.souvenirs[s.id] || 0) > 0);
  return owned.map((s) => {
    const comm = COMMISSIONS.find(
      (c) => c.wantSouvenir === s.id && !(state.value.commissions[c.id] && state.value.commissions[c.id].completed)
    );
    return {
      sou: s,
      count: state.value.souvenirs[s.id] || 0,
      commission: comm || null,
      targetCityName: comm ? cityById(comm.targetCity)?.name : null
    };
  }).sort((a, b) => (b.commission ? 1 : 0) - (a.commission ? 1 : 0));
});

const activeGiftComm = computed(() => {
  if (!view.value.prepGift) return null;
  return COMMISSIONS.find(
    (c) => c.wantSouvenir === view.value.prepGift && !(state.value.commissions[c.id] && state.value.commissions[c.id].completed)
  ) || null;
});

const durRangeText = computed(() => {
  if (!selectedBeast.value) return '神兽都在外游历';
  const hasExpress = view.value.prepItems.includes('waxseal');
  if (totalStationTravels(state.value) === 0 && !state.value.settings.fastMode) {
    const sec = hasExpress ? Math.round((CONSTANTS.FIRST_TRIP_MS * 0.65) / 1000) : Math.round(CONSTANTS.FIRST_TRIP_MS / 1000);
    return `初探短途：约 ${sec} 秒归来，体验首封远方来信`;
  }
  const mult = (state.value.settings.fastMode ? 0.06 : 1) * (hasExpress ? 0.65 : 1);
  const minMs = Math.max(15000, Math.round((CONSTANTS.DURATION.base + CONSTANTS.DURATION.perStop) * mult));
  const maxMs = Math.max(25000, Math.round((CONSTANTS.DURATION.base + CONSTANTS.DURATION.perStop * 2 + 5 * 60000) * mult));
  if (state.value.settings.fastMode) {
    return `快速模式：约 ${Math.round(minMs / 1000)}–${Math.round(maxMs / 1000)} 秒归来`;
  }
  return `约 ${Math.round(minMs / 60000)}–${Math.round(maxMs / 60000)} 分钟归来${hasExpress ? '（火漆加急）' : ''}`;
});

function pickBeast(b) {
  if (state.value.trips[b.id]) {
    showToast(`${b.name}还在路上`, 'warn');
    return;
  }
  audioBridge.tap();
  hapticsBridge.trigger('light');
  view.value.prepBeast = b.id;
  if (view.value.prepPartner === b.id) view.value.prepPartner = null;
}

function togglePartner(id) {
  audioBridge.wood();
  hapticsBridge.trigger('light');
  view.value.prepPartner = view.value.prepPartner === id ? null : id;
}

function pickPref(id) {
  audioBridge.wood();
  view.value.prepPref = id;
}

function toggleItem(it, event) {
  const n = state.value.inventory[it.id] || 0;
  if (n <= 0) {
    showToast('这件用完了，去茶案手作或庭院采摘灵草吧', 'warn');
    return;
  }
  const idx = view.value.prepItems.indexOf(it.id);
  if (idx >= 0) {
    view.value.prepItems.splice(idx, 1);
    audioBridge.pack(false);
    hapticsBridge.trigger('light');
    return;
  }
  if (view.value.prepItems.length >= 3) {
    showToast('随身包袱最多装 3 件物件', 'warn');
    return;
  }
  view.value.prepItems.push(it.id);
  audioBridge.pack(true);
  hapticsBridge.trigger('medium');
  if (event && event.currentTarget) {
    emitFlight({
      fromRect: event.currentTarget.getBoundingClientRect(),
      toSelector: '.furoshiki-cloth',
      kind: 'item',
      id: it.id,
      label: it.name
    });
  }
}

function removeSlotItem(id) {
  const idx = view.value.prepItems.indexOf(id);
  if (idx >= 0) {
    view.value.prepItems.splice(idx, 1);
    audioBridge.pack(false);
  }
}

function pickGift(souId) {
  audioBridge.wood();
  hapticsBridge.trigger('light');
  view.value.prepGift = view.value.prepGift === souId ? null : souId;
}

function handleDepart() {
  if (tying.value || !selectedBeast.value) return;
  tying.value = true;
  audioBridge.wood();
  hapticsBridge.trigger('medium');
  if (furoshikiRef.value) {
    gsap.fromTo(
      furoshikiRef.value,
      { scale: 1, rotate: 0 },
      { scale: 0.88, rotate: -2, duration: 0.24, ease: 'power3.inOut' }
    );
  }
  setTimeout(() => {
    tying.value = false;
    doDepartTrip();
  }, 320);
}
</script>

<template>
  <div
    class="modal-card modal-pack"
    role="dialog"
    aria-modal="true"
    aria-label="桌案蓝印花布包袱"
  >
    <div class="modal-head desk-head">
      <div>
        <h2>桌案包袱</h2>
        <span class="mh-sub">点物件抛入包袱，还可为故人捎带跨城信物</span>
      </div>
      <div class="mh-actions">
        <button
          class="wood-btn tiny"
          @click="openModal('tea')"
        >
          去茶案手作
        </button>
        <button
          class="return-clasp"
          aria-label="收起桌案"
          @click="closeModal"
        >
          <GameIcon
            name="close-tab"
            :size="14"
          />
          <span>收起</span>
        </button>
      </div>
    </div>

    <!-- 出行神兽与双兽结伴栏 -->
    <div class="pack-beasts">
      <button
        v-for="b in unlockedBeasts"
        :key="b.id"
        class="pack-beast-tab"
        :class="{ on: view.prepBeast === b.id && !state.trips[b.id], busy: !!state.trips[b.id] }"
        :disabled="!!state.trips[b.id]"
        @click="pickBeast(b)"
      >
        <span class="pbt-fig"><ArtSprite
          :id="b.id"
          kind="beast"
          :alt="b.name"
        /></span>
        <span class="pbt-txt">
          <b>{{ b.name }}</b>
          <em v-if="state.trips[b.id]">在路上</em>
          <em v-else-if="state.beasts[b.id]?.equippedQuirk">{{ quirkById(state.beasts[b.id].equippedQuirk)?.name }}</em>
          <em v-else>{{ b.title }}</em>
        </span>
      </button>
      <div
        v-if="lockedJingwei"
        class="pack-beast-locked"
        :title="BEASTS[3].unlockHint"
      >
        <span class="pbl-title">
          <GameIcon
            name="bird-lock"
            :size="15"
          />
          <span>精卫未入驻</span>
        </span>
        <em>任意神兽达「好奇」阶或累计出行 4 次解锁</em>
      </div>
    </div>

    <div class="pack-layout">
      <!-- 左侧：蓝印花布包袱 + 捎带锦囊 + 路引 + 双兽结伴 -->
      <div class="furoshiki-zone">
        <div
          ref="furoshikiRef"
          class="furoshiki-cloth"
          :class="{ 'is-tying': tying }"
        >
          <div class="cloth-label">
            随身包袱（{{ view.prepItems.length }}/3）
          </div>
          <div class="cloth-slots">
            <template
              v-for="idx in 3"
              :key="idx"
            >
              <button
                v-if="view.prepItems[idx - 1]"
                class="cloth-slot filled"
                title="点击放回木格柜"
                @click="removeSlotItem(view.prepItems[idx - 1])"
              >
                <span class="cs-art">
                  <ArtSprite
                    :id="view.prepItems[idx - 1]"
                    kind="item"
                    :alt="itemById(view.prepItems[idx - 1])?.name"
                  />
                </span>
                <span class="cs-name">{{ itemById(view.prepItems[idx - 1])?.name }}</span>
              </button>
              <span
                v-else
                class="cloth-slot empty"
                aria-hidden="true"
              ><i>空位</i></span>
            </template>
          </div>

          <!-- 跨城捎带信物锦囊槽 -->
          <div class="gift-pouch">
            <div class="gp-head">
              <b>捎带信物锦囊（第 4 格）</b>
              <span v-if="activeGiftComm">将直飞「{{ cityById(activeGiftComm.targetCity)?.name }}」转交{{ activeGiftComm.requester }}</span>
              <span v-else-if="view.prepGift">将顺路赠予路人茶客，获回礼灵材与见闻（图鉴永久保留）</span>
              <span v-else>捎信物给故人圆梦，其余风物也可顺路换灵材</span>
            </div>
            <div class="gp-row">
              <div
                v-if="view.prepGift"
                class="gp-picked"
                @click="pickGift(view.prepGift)"
              >
                <span class="gp-art"><ArtSprite
                  :id="view.prepGift"
                  kind="souvenir"
                  :alt="souById(view.prepGift)?.name"
                /></span>
                <span>{{ souById(view.prepGift)?.name }}</span>
                <em>点此取下</em>
              </div>
              <div
                v-else-if="giftCandidates.length"
                class="gp-chips"
              >
                <button
                  v-for="cand in giftCandidates.slice(0, 6)"
                  :key="cand.sou.id"
                  class="gp-chip"
                  :class="{ urgent: !!cand.commission }"
                  @click="pickGift(cand.sou.id)"
                >
                  <span>{{ cand.sou.name }} ×{{ cand.count }}</span>
                  <em v-if="cand.commission">→ {{ cand.targetCityName }}心愿</em>
                  <em v-else>顺路赠礼</em>
                </button>
              </div>
              <div
                v-else
                class="gp-empty"
              >
                行囊尚无纪念品，先出门带回几件再替故人捎物吧。
              </div>
            </div>
          </div>
        </div>

        <!-- 上封信朱砂闲章余温提示 -->
        <div
          v-if="activeStampBlessing && activeStampBlessing.blessing"
          class="blessing-strip"
        >
          <b>闲章余温「{{ activeStampBlessing.name }}」</b>
          <span>{{ activeStampBlessing.blessing.desc }}</span>
        </div>

        <!-- 双兽结伴同行 -->
        <div
          v-if="selectedBeast && availablePartners.length"
          class="partner-strip"
        >
          <span class="ps-label">邀请同伴合写家书：</span>
          <div class="ps-btns">
            <button
              v-for="p in availablePartners"
              :key="p.id"
              class="way-chip"
              :class="{ on: view.prepPartner === p.id }"
              @click="togglePartner(p.id)"
            >
              + {{ p.name }}（羁绊 {{ selectedBeastState?.bonds?.[p.id] || 0 }}）
            </button>
          </div>
        </div>

        <!-- 路引方向 -->
        <div class="way-box">
          <div class="way-label">
            出行路引 · <em>{{ activePref.desc }}</em>
          </div>
          <div class="way-slips">
            <button
              v-for="p in PREFERENCES"
              :key="p.id"
              class="way-slip"
              :class="{ on: view.prepPref === p.id }"
              @click="pickPref(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：12 种行囊木格柜 -->
      <div class="cubby-tray">
        <div class="cubby-title">
          木格行囊柜 <em>点击取用 / 茶案可补充</em>
        </div>
        <div class="cubby-grid">
          <button
            v-for="it in ITEMS"
            :key="it.id"
            class="cubby"
            :class="{ on: view.prepItems.includes(it.id), gone: !(state.inventory[it.id] > 0) }"
            :title="it.desc"
            @click="toggleItem(it, $event)"
          >
            <span class="cubby-art"><ArtSprite
              :id="it.id"
              kind="item"
              :alt="it.name"
            /></span>
            <span class="cubby-name">{{ it.name }}</span>
            <span class="cubby-hint">{{ it.hint }}</span>
            <span class="cubby-n">×{{ state.inventory[it.id] || 0 }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-foot">
      <span class="mf-note">{{ durRangeText }}</span>
      <button
        class="wood-btn seal-btn"
        :disabled="!selectedBeast || tying"
        @click="handleDepart"
      >
        <span>{{ tying ? '正系包袱绳结…' : '扎紧包袱 · 送它出门' }}</span>
      </button>
    </div>
  </div>
</template>
