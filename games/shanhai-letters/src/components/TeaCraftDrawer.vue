<script setup>
import { computed } from 'vue';
import { MATERIALS, ITEMS, materialById } from '../systems/gameSystems.js';
import {
  gameState,
  currentSeason,
  closeModal,
  doCraftItem,
  openModal
} from '../stores/gameStore.js';
import ArtSprite from './ArtSprite.vue';
import GameIcon from './GameIcon.vue';

const state = computed(() => gameState.state);

function canCraft(it) {
  if (!it.recipe) return false;
  return Object.keys(it.recipe).every((mid) => (state.value.materials[mid] || 0) >= it.recipe[mid]);
}

function recipeParts(it) {
  return Object.entries(it.recipe || {}).map(([mid, need]) => ({
    id: mid,
    name: materialById(mid)?.name || mid,
    need,
    have: state.value.materials[mid] || 0
  }));
}
</script>

<template>
  <div
    class="modal-card modal-tea"
    role="dialog"
    aria-modal="true"
    aria-label="屋内茶案手作炉"
  >
    <div class="modal-head desk-head">
      <div>
        <h2>茶案手作炉</h2>
        <span class="mh-sub">当前节气「{{ currentSeason.name }}」 · 庭院采灵材，案头烹器物</span>
      </div>
      <div class="mh-actions">
        <button
          class="wood-btn tiny"
          @click="openModal('pack')"
        >
          回桌案整行囊
        </button>
        <button
          class="return-clasp"
          aria-label="收起茶案"
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

    <!-- 5 种灵材仓 -->
    <div class="material-bar">
      <div
        v-for="m in MATERIALS"
        :key="m.id"
        class="mat-pill"
        :title="m.desc"
      >
        <span class="mp-art"><ArtSprite
          :id="m.id"
          kind="material"
          :alt="m.name"
        /></span>
        <span class="mp-info">
          <b>{{ m.name }}</b>
          <em>×{{ state.materials[m.id] || 0 }}</em>
        </span>
      </div>
    </div>

    <!-- 12 种手作配方 -->
    <div class="modal-scroll">
      <div class="craft-grid">
        <div
          v-for="it in ITEMS"
          :key="it.id"
          class="craft-card"
          :class="{ ready: canCraft(it) }"
        >
          <div class="cc-top">
            <span class="cc-art"><ArtSprite
              :id="it.id"
              kind="item"
              :alt="it.name"
            /></span>
            <div class="cc-meta">
              <b>{{ it.name }} <em>现有 ×{{ state.inventory[it.id] || 0 }}</em></b>
              <p>{{ it.hint }}</p>
            </div>
          </div>
          <div class="cc-recipe">
            <span
              v-for="part in recipeParts(it)"
              :key="part.id"
              class="req-tag"
              :class="{ ok: part.have >= part.need }"
            >
              {{ part.name }} {{ part.have }}/{{ part.need }}
            </span>
          </div>
          <button
            class="wood-btn tiny cc-btn"
            :disabled="!canCraft(it)"
            @click="doCraftItem(it.id, $event)"
          >
            {{ canCraft(it) ? '烹制入囊' : '灵材不足' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
