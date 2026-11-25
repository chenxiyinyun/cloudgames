<script setup>
import { computed } from 'vue';
import {
  SOUVENIRS,
  VISITORS,
  ROOM_AURAS,
  CONSTANTS,
  souById,
  tagName
} from '../systems/gameSystems.js';
import {
  gameState,
  currentAura,
  closeModal,
  doPlaceSouvenir,
  doTradeVisitor
} from '../stores/gameStore.js';
import { audioBridge } from '../bridge/platformBridge.js';
import ArtSprite from './ArtSprite.vue';
import GameIcon from './GameIcon.vue';

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);

const slot = computed(() => (view.value.placingSlot != null ? view.value.placingSlot : 0));
const slotHas = computed(() => state.value.placed[slot.value] || null);
const usedIds = computed(() => Object.values(state.value.placed || {}));

const ownedSouvenirs = computed(() =>
  SOUVENIRS.filter((s) => (state.value.souvenirs[s.id] || 0) > 0)
);

const activeGuestObjects = computed(() =>
  VISITORS.filter((v) => (state.value.activeVisitors || []).includes(v.id))
);

function selectSlot(i) {
  audioBridge.wood();
  view.value.placingSlot = i;
}

function switchTab(tab) {
  audioBridge.paperOpen();
  view.value.shelfTab = tab;
}

function canTrade(tr) {
  if (tr.costType === 'souvenir') return (state.value.souvenirs[tr.costId] || 0) >= tr.costCount;
  if (tr.costType === 'material') return (state.value.materials[tr.costId] || 0) >= tr.costCount;
  return false;
}
</script>

<template>
  <div
    class="modal-card modal-shelf"
    role="dialog"
    aria-modal="true"
    aria-label="堂前博古架与访客茶席"
  >
    <div class="modal-head desk-head">
      <div>
        <h2>堂前博古架</h2>
        <span class="mh-sub">摆出风物聚成堂前雅韵，还能在庭院招待茶客以物易物</span>
      </div>
      <div class="book-tabs">
        <button
          class="book-tab"
          :class="{ on: view.shelfTab === 'shelf' }"
          @click="switchTab('shelf')"
        >
          架上陈设
        </button>
        <button
          class="book-tab"
          :class="{ on: view.shelfTab === 'visitors' }"
          @click="switchTab('visitors')"
        >
          庭院茶客 ({{ activeGuestObjects.length }})
        </button>
      </div>
      <button
        class="return-clasp"
        aria-label="收起博古架"
        @click="closeModal"
      >
        <GameIcon
          name="close-tab"
          :size="14"
        />
        <span>收起</span>
      </button>
    </div>

    <!-- 堂前气场横幅 -->
    <div class="aura-banner">
      <template v-if="currentAura.primary">
        <span class="ab-badge">堂前雅韵 · {{ currentAura.primary.name }}</span>
        <p>{{ currentAura.primary.desc }}</p>
      </template>
      <template v-else>
        <span class="ab-badge empty">堂前未成局</span>
        <p>在架上摆满 3 件同气韵风物（如 {{ ROOM_AURAS.slice(0, 3).map((a) => a.name).join(' / ') }}），即可激活全局加护。</p>
      </template>
    </div>

    <!-- 分页 1：12 格博古架摆件 -->
    <template v-if="view.shelfTab === 'shelf'">
      <div class="shelf-mini-bar">
        <button
          v-for="i in CONSTANTS.SLOTS"
          :key="i"
          class="mini-slot"
          :class="{ on: slot === i - 1, filled: !!state.placed[i - 1] }"
          @click="selectSlot(i - 1)"
        >
          <ArtSprite
            v-if="state.placed[i - 1]"
            :id="state.placed[i - 1]"
            kind="souvenir"
            :alt="souById(state.placed[i - 1])?.name"
          />
          <span v-else>{{ i }}</span>
        </button>
      </div>

      <div class="shelf-actions">
        <span>第 {{ slot + 1 }} 格当前：<b>{{ slotHas ? souById(slotHas)?.name : '空置' }}</b></span>
        <button
          class="wood-btn tiny"
          :disabled="!slotHas"
          @click="doPlaceSouvenir(slot, null)"
        >
          从这格取下
        </button>
      </div>

      <div class="modal-scroll">
        <div
          v-if="ownedSouvenirs.length"
          class="picker-list"
        >
          <button
            v-for="s in ownedSouvenirs"
            :key="s.id"
            class="pick-sou"
            :class="{ cur: slotHas === s.id, used: usedIds.includes(s.id) && slotHas !== s.id }"
            @click="doPlaceSouvenir(slot, s.id)"
          >
            <span class="ps-art"><ArtSprite
              :id="s.id"
              kind="souvenir"
              :alt="s.name"
            /></span>
            <span class="ps-name">{{ s.name }} <em>×{{ state.souvenirs[s.id] }}</em></span>
            <span class="ps-desc">{{ s.desc }}</span>
            <span class="ps-tags">{{ (s.attract || []).map((t) => tagName(t)).join(' · ') }}</span>
            <span
              v-if="usedIds.includes(s.id) && slotHas !== s.id"
              class="ps-tag"
            >挪过来</span>
          </button>
        </div>
        <p
          v-else
          class="muted"
        >
          还没有收集到纪念品，先送神兽出门游历吧。
        </p>
      </div>
    </template>

    <!-- 分页 2：今日庭院茶会与以物易物 -->
    <div
      v-else
      class="modal-scroll"
    >
      <div
        v-if="activeGuestObjects.length"
        class="visitor-trade-list"
      >
        <div
          v-for="v in activeGuestObjects"
          :key="v.id"
          class="vt-card"
        >
          <div class="vt-head">
            <div>
              <b>{{ v.name }}</b>
              <em>{{ v.line }}</em>
            </div>
            <span
              v-if="v.bonus"
              class="vt-bonus"
            >
              常驻祈福：{{ Object.entries(v.bonus).map(([t, m]) => `${tagName(t)}×${m}`).join(' ') }}
            </span>
          </div>
          <div class="vt-trades">
            <div
              v-for="tr in v.trades"
              :key="tr.id"
              class="vt-trade-row"
            >
              <span>{{ tr.label }}</span>
              <button
                class="wood-btn tiny"
                :disabled="!canTrade(tr)"
                @click="doTradeVisitor(v.id, tr.id)"
              >
                {{ canTrade(tr) ? '交换' : '不足' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="all-guests-guide">
        <h4>驿站故客名录（{{ Object.keys(state.visitors).length }}/{{ VISITORS.length }}）</h4>
        <div class="guest-row">
          <div
            v-for="v in VISITORS"
            :key="v.id"
            class="guest"
            :class="{ have: state.visitors[v.id], locked: !state.visitors[v.id] }"
          >
            <div class="g-txt">
              <b>{{ state.visitors[v.id] ? v.name : '？？？' }}</b>
              <span>{{ state.visitors[v.id] ? v.line : `在博古架摆满 ${v.count} 件「${v.need.map((t) => tagName(t)).join('/')}」风物招来` }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
