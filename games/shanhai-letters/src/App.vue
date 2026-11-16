<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  BEASTS,
  CONSTANTS,
  INSIGHT_STAGES,
  cityById,
  souById,
  visitorById,
  hourglassLeft,
  fmtDuration
} from './systems/gameSystems.js';
import {
  gameState,
  unreadLetters,
  currentSeason,
  currentTimeOfDay,
  currentAura,
  codexSummary,
  bootGame,
  saveGame,
  syncAudioPrefs,
  switchScene,
  openModal,
  closeModal,
  openMailDrawer,
  tapBeastOnStage,
  doHarvestGarden,
  doForceReturn,
  supplyRemain
} from './stores/gameStore.js';
import { audioBridge, hapticsBridge } from './bridge/platformBridge.js';

import StageCanvas from './stage/StageCanvas.vue';
import ArtSprite from './components/ArtSprite.vue';
import FlightFxLayer from './components/FlightFxLayer.vue';
import PackDrawer from './components/PackDrawer.vue';
import MailDeskDrawer from './components/MailDeskDrawer.vue';
import TeaCraftDrawer from './components/TeaCraftDrawer.vue';
import ShelfAuraDrawer from './components/ShelfAuraDrawer.vue';
import BeastSoulDrawer from './components/BeastSoulDrawer.vue';
import CodexBookDrawer from './components/CodexBookDrawer.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);

const actorPositions = reactive({});
const petTriggers = reactive({});
const scrollerRef = ref(null);

const homeBeasts = computed(() =>
  BEASTS.filter((b) => state.value.beasts[b.id]?.unlocked && !state.value.trips[b.id])
);
const homeBeastIds = computed(() => homeBeasts.value.map((b) => b.id));

const awayTrips = computed(() =>
  Object.values(state.value.trips).filter((t) => t && !t.companionOf)
);

const yardGuests = computed(() =>
  (state.value.activeVisitors || []).map((id) => visitorById(id)).filter(Boolean)
);

const herbRemainMs = computed(() => supplyRemain(state.value, view.value.now + gameState.cloud.offset));
const herbReady = computed(() => herbRemainMs.value === 0);
const leftHg = computed(() => hourglassLeft(state.value, view.value.now + gameState.cloud.offset));

const timeLabelMap = {
  dawn: '晨晓',
  noon: '晌午',
  dusk: '暮霞',
  night: '宵夜'
};

function onActorPositions(map) {
  Object.keys(map).forEach((id) => {
    actorPositions[id] = map[id];
  });
}

function handleTapBeast(id) {
  petTriggers[id] = Date.now();
  tapBeastOnStage(id);
}

function handleTapVisitor(id) {
  audioBridge.tap();
  hapticsBridge.trigger('light');
  view.value.bubbleBeastId = null;
  view.value.bubbleVisitorId = view.value.bubbleVisitorId === id ? null : id;
}

function openShelfSlot(slotIdx) {
  audioBridge.wood();
  view.value.placingSlot = slotIdx;
  view.value.shelfTab = 'shelf';
  openModal('shelf');
}

function openVisitorTrade() {
  view.value.shelfTab = 'visitors';
  openModal('shelf');
}

function openBeastNote(beastId) {
  view.value.inspectBeastId = beastId;
  openModal('beast');
}

function openPackForBeast(beastId) {
  view.value.prepBeast = beastId;
  openModal('pack');
}

function toggleSound() {
  state.value.settings.muted = !state.value.settings.muted;
  saveGame();
  syncAudioPrefs();
  if (!state.value.settings.muted) audioBridge.tap();
}

function cycleTimeFilter() {
  const order = ['auto', 'dawn', 'noon', 'dusk', 'night'];
  const idx = order.indexOf(state.value.timeOfDay || 'auto');
  state.value.timeOfDay = order[(idx + 1) % order.length];
  audioBridge.tap();
  saveGame();
}

function panScene(dir) {
  const el = scrollerRef.value;
  if (!el) return;
  el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.55), behavior: 'smooth' });
}

function handleToastAction() {
  const act = view.value.toast?.action?.act;
  view.value.toast = null;
  if (typeof act === 'function') act();
}

function onKeyDown(e) {
  if (e.key !== 'Escape') return;
  if (view.value.modal) {
    closeModal();
  } else if (view.value.bubbleBeastId || view.value.bubbleVisitorId) {
    view.value.bubbleBeastId = null;
    view.value.bubbleVisitorId = null;
  }
}

onMounted(() => {
  bootGame();
  window.addEventListener('keydown', onKeyDown);
  if (scrollerRef.value) {
    scrollerRef.value.scrollLeft = Math.max(0, (scrollerRef.value.scrollWidth - scrollerRef.value.clientWidth) / 2);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div
    class="game-shell"
    :class="{ 'is-shaking': view.screenShake }"
  >
    <div class="paper-bg" />

    <div class="viewport">
      <div
        ref="scrollerRef"
        class="scene-scroller"
      >
        <div class="scene-canvas">
          <!-- 60fps Canvas 2D 游戏舞台 -->
          <StageCanvas
            :scene="view.scene"
            :time-of-day="currentTimeOfDay"
            :particle-mode="currentSeason.particle"
            :home-beast-ids="homeBeastIds"
            :pet-triggers="petTriggers"
            @actor-positions="onActorPositions"
          />

          <!-- ============ 屋内正厅交互热点层 ============ -->
          <template v-if="view.scene === 'hall'">
            <!-- 墙上画轴：《新山海经》 -->
            <button
              class="scene-hotspot hs-scroll"
              aria-label="墙上山海画轴：打开新山海经图鉴"
              @click="openModal('codex')"
            >
              <span class="hs-glint" />
              <span class="hotspot-tag">新山海经</span>
            </button>

            <!-- 堂前博古架：12 格实景摆件 + 雅韵牌匾 -->
            <div
              class="wall-shelf"
              aria-label="堂前博古架"
            >
              <div
                v-if="currentAura.primary"
                class="shelf-aura-plaque"
              >
                {{ currentAura.primary.name }}
              </div>
              <div class="ws-frame">
                <button
                  v-for="i in CONSTANTS.SLOTS"
                  :key="i"
                  class="wall-slot"
                  :class="state.placed[i - 1] ? 'filled' : 'empty'"
                  :title="state.placed[i - 1] ? `${souById(state.placed[i - 1])?.name}（点按更换）` : `第 ${i} 格（点按摆件）`"
                  @click="openShelfSlot(i - 1)"
                >
                  <span
                    v-if="state.placed[i - 1]"
                    class="ws-art"
                  >
                    <ArtSprite
                      :id="state.placed[i - 1]"
                      kind="souvenir"
                      :alt="souById(state.placed[i - 1])?.name"
                    />
                  </span>
                  <span
                    v-else
                    class="ws-peg"
                  />
                </button>
              </div>
              <span class="hotspot-tag ws-tag">博古架 · 点格摆件</span>
            </div>

            <!-- 左下茶炉：茶案手作 -->
            <button
              class="scene-hotspot hs-stove"
              data-flight-target="tea"
              aria-label="茶炉手作案"
              @click="openModal('tea')"
            >
              <span class="stove-glow" />
              <span class="hotspot-tag">茶案手作</span>
            </button>

            <!-- 桌案包袱：整行囊 -->
            <button
              class="scene-hotspot hs-bundle"
              :class="{ ready: homeBeasts.length > 0 }"
              data-flight-target="pack"
              aria-label="桌案行囊包袱"
              @click="openModal('pack')"
            >
              <span class="bundle-badge">行囊</span>
              <span class="hotspot-tag">整理包袱出发</span>
            </button>

            <!-- 廊窗出口 -->
            <button
              class="scene-hotspot hs-window"
              aria-label="出门去庭院"
              @click="switchScene('yard')"
            >
              <span class="hs-door-sign">出门 · 庭院</span>
            </button>

            <!-- 出门留守木牌 -->
            <div
              v-for="(t, idx) in awayTrips"
              :key="t.beastId"
              class="away-marker"
              :style="{ left: `${24 + idx * 22}%`, top: '60%' }"
            >
              <div class="away-tag">
                <span class="at-name">{{ t.beastName }}{{ t.partnerId ? ` & ${BEASTS.find((b) => b.id === t.partnerId)?.name}` : '' }} 远行中</span>
                <span class="at-dest">去往 {{ cityById(t.stops[0]?.city)?.name || '远方' }}</span>
                <span class="at-time">{{ fmtDuration(t.returnAt - (view.now + gameState.cloud.offset)) }}</span>
              </div>
              <button
                class="away-hg"
                :disabled="!leftHg"
                :title="`使用静心沙漏（今日剩 ${leftHg} 次）`"
                @click="doForceReturn(t.beastId)"
              >
                ⏳ <span>{{ leftHg }}</span>
              </button>
            </div>
          </template>

          <!-- ============ 门前小院交互热点层 ============ -->
          <template v-else>
            <button
              class="scene-hotspot hs-porch"
              aria-label="回屋进正厅"
              @click="switchScene('hall')"
            >
              <span class="hs-door-sign">回屋 · 正厅</span>
            </button>

            <!-- 朱漆木信箱 -->
            <button
              class="scene-hotspot hs-mailbox"
              :class="{ 'has-mail': unreadLetters.length > 0 }"
              aria-label="驿站信箱"
              @click="openMailDrawer()"
            >
              <span
                v-if="unreadLetters.length"
                class="mailbox-count"
              >{{ unreadLetters.length }}</span>
              <span class="hotspot-tag">{{ unreadLetters.length ? `${unreadLetters.length} 封信待阅` : '驿站信箱' }}</span>
            </button>

            <!-- 今日庭院动态茶客 -->
            <div
              v-for="(v, idx) in yardGuests"
              :key="v.id"
              class="yard-visitor"
              :style="{ left: `${42 + idx * 9}%`, top: '52%' }"
            >
              <button
                class="yv-hit"
                @click="handleTapVisitor(v.id)"
              >
                <span class="yv-badge">🍵</span>
                <span class="yv-name">{{ v.name }}</span>
              </button>
              <div
                v-if="view.bubbleVisitorId === v.id"
                class="speech-pop dir-up"
                role="dialog"
              >
                <button
                  class="sp-close"
                  @click="view.bubbleVisitorId = null"
                >
                  ×
                </button>
                <div class="sp-head">
                  <b>{{ v.name }}</b>
                  <span>今日庭院茶客</span>
                </div>
                <p class="sp-line">
                  {{ v.line }}
                </p>
                <div class="sp-acts">
                  <button
                    class="mini-wood"
                    @click="openVisitorTrade"
                  >
                    以物易物
                  </button>
                </div>
              </div>
            </div>

            <!-- 月洞门远行路牌 -->
            <div class="gate-waystone">
              <template v-if="awayTrips.length">
                <div
                  v-for="t in awayTrips"
                  :key="t.beastId"
                  class="gate-trip-card"
                >
                  <span class="gtc-fig"><ArtSprite
                    :id="t.beastId"
                    kind="beast"
                    :alt="t.beastName"
                  /></span>
                  <span class="gtc-info">
                    <b>{{ t.beastName }} → {{ cityById(t.stops[0]?.city)?.name || '远方' }}</b>
                    <em>{{ fmtDuration(t.returnAt - (view.now + gameState.cloud.offset)) }}</em>
                  </span>
                  <button
                    class="away-hg"
                    :disabled="!leftHg"
                    @click="doForceReturn(t.beastId)"
                  >
                    ⏳ <span>{{ leftHg }}</span>
                  </button>
                </div>
              </template>
              <button
                v-else
                class="gate-idle-sign"
                @click="openModal('pack')"
              >
                山海路远 · 点此整装出发
              </button>
            </div>

            <!-- 庭院节气灵草药圃 -->
            <button
              class="scene-hotspot hs-herbs"
              :class="herbReady ? 'ready' : 'growing'"
              @click="doHarvestGarden($event)"
            >
              <span
                v-if="herbReady"
                class="herb-ready-glow"
              >✦ 灵草已熟 · 采撷灵材</span>
              <span
                v-else
                class="herb-cd-tag"
              >蓄露中 · {{ fmtDuration(herbRemainMs) }}</span>
            </button>
          </template>

          <!-- ============ 可动神兽交互定位层（实时跟随 Canvas 木偶坐标） ============ -->
          <div
            v-for="b in homeBeasts"
            :key="b.id"
            class="beast-anchor"
            :style="{
              left: `${actorPositions[b.id]?.leftPct || 50}%`,
              top: `${actorPositions[b.id]?.topPct || 52}%`
            }"
          >
            <button
              class="beast-hitbox"
              :aria-label="`${b.name}，点一点打招呼`"
              @click="handleTapBeast(b.id)"
            >
              <span class="ba-name">{{ b.name }}</span>
            </button>

            <div
              v-if="view.bubbleBeastId === b.id"
              class="speech-pop dir-up"
              role="dialog"
            >
              <button
                class="sp-close"
                aria-label="收起对话"
                @click="view.bubbleBeastId = null"
              >
                ×
              </button>
              <div class="sp-head">
                <b>{{ b.name }}</b>
                <span>第 {{ state.beasts[b.id].insight + 1 }} 阶 · {{ INSIGHT_STAGES[state.beasts[b.id].insight]?.name }}</span>
              </div>
              <p class="sp-line">
                “{{ view.bubbleText }}”
              </p>
              <div class="sp-acts">
                <button
                  class="mini-wood"
                  @click="openPackForBeast(b.id)"
                >
                  整行囊
                </button>
                <button
                  class="mini-wood ghost"
                  @click="openBeastNote(b.id)"
                >
                  心境谱
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 手机横滑按钮 -->
      <button
        class="pan-hint left"
        aria-label="向左查看"
        @click="panScene(-1)"
      >
        ‹
      </button>
      <button
        class="pan-hint right"
        aria-label="向右查看"
        @click="panScene(1)"
      >
        ›
      </button>

      <!-- 顶部极简木牌 HUD -->
      <div class="hud-top">
        <div class="hud-left-cluster">
          <button
            class="hud-plaque"
            @click="openModal('codex')"
          >
            <span class="hp-seal"><ArtSprite
              id="ui-stamp-red.jpg"
              kind="ui"
            /></span>
            <span class="hp-main">
              <strong>山海驿站</strong>
              <em>新山海经 {{ codexSummary.avg }}% · 藏品 {{ codexSummary.owned }}/36</em>
            </span>
          </button>

          <button
            class="hud-season-pill"
            :title="currentSeason.desc"
            @click="cycleTimeFilter"
          >
            <span>{{ currentSeason.name }}</span>
            <em>{{ state.timeOfDay === 'auto' ? `${timeLabelMap[currentTimeOfDay]}（自动）` : timeLabelMap[currentTimeOfDay] }}</em>
          </button>
        </div>

        <div class="hud-tools">
          <button
            class="hud-icon-btn"
            :title="state.settings.muted ? '开启声音' : '静音'"
            @click="toggleSound"
          >
            {{ state.settings.muted ? '🔇' : '🔔' }}
          </button>
          <button
            class="hud-icon-btn"
            :class="{ 'has-alert': !!gameState.cloud.conflict }"
            title="驿站杂记与云存档"
            @click="openModal('settings')"
          >
            ⚙
          </button>
        </div>
      </div>

      <!-- 底部木牌操作坞 -->
      <div class="hud-bottom">
        <div
          class="hud-tokens"
          role="toolbar"
          aria-label="驿站器物"
        >
          <button
            class="token-btn"
            @click="openModal('pack')"
          >
            <span class="tb-glyph">🎒</span>
            <span>行囊</span>
          </button>
          <button
            class="token-btn"
            :class="{ 'has-badge': unreadLetters.length > 0 }"
            @click="openMailDrawer()"
          >
            <span class="tb-glyph">✉️</span>
            <span>信箱</span>
            <i
              v-if="unreadLetters.length"
              class="tb-badge"
            >{{ unreadLetters.length }}</i>
          </button>
          <button
            class="token-btn"
            @click="openModal('tea')"
          >
            <span class="tb-glyph">🍵</span>
            <span>茶案</span>
          </button>
          <button
            class="token-btn"
            @click="openModal('shelf')"
          >
            <span class="tb-glyph">🏺</span>
            <span>博古</span>
          </button>
          <button
            class="token-btn"
            @click="openModal('beast')"
          >
            <span class="tb-glyph">🦊</span>
            <span>心境</span>
          </button>
          <button
            class="token-btn"
            @click="openModal('codex')"
          >
            <span class="tb-glyph">📜</span>
            <span>图鉴</span>
          </button>
        </div>

        <button
          class="scene-flip"
          @click="switchScene()"
        >
          <span>{{ view.scene === 'hall' ? '出门去庭院' : '回屋进正厅' }}</span>
          <i
            v-if="view.scene === 'hall' && (unreadLetters.length || herbReady)"
            class="flip-dot"
          />
        </button>
      </div>

      <!-- 拟物器物抽匣弹层 -->
      <Transition name="drawer-pop">
        <div
          v-if="view.modal"
          class="modal-backdrop"
          @click.self="closeModal"
        >
          <PackDrawer v-if="view.modal === 'pack'" />
          <MailDeskDrawer v-else-if="view.modal === 'mail'" />
          <TeaCraftDrawer v-else-if="view.modal === 'tea'" />
          <ShelfAuraDrawer v-else-if="view.modal === 'shelf'" />
          <BeastSoulDrawer v-else-if="view.modal === 'beast'" />
          <CodexBookDrawer v-else-if="view.modal === 'codex'" />
          <SettingsDrawer v-else-if="view.modal === 'settings'" />
        </div>
      </Transition>
    </div>

    <!-- 抛物线飞行特效层 -->
    <FlightFxLayer :flights="view.flights" />

    <!-- 温润提示 Toast -->
    <Transition name="toast-drop">
      <div
        v-if="view.toast"
        class="toast-layer"
      >
        <div
          class="toast"
          :class="`toast-${view.toast.type}`"
          role="status"
        >
          <span>{{ view.toast.msg }}</span>
          <button
            v-if="view.toast.action"
            class="toast-act"
            @click="handleToastAction"
          >
            {{ view.toast.action.label }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
