<script setup>
import { computed } from 'vue';
import {
  BEASTS,
  TRAITS,
  PERSONA_QUIRKS,
  INSIGHT_STAGES,
  INSIGHT_THRESHOLD,
  MEMORY_LINES,
  beastById,
  quirkById
} from '../systems/gameSystems.js';
import {
  gameState,
  closeModal,
  openModal,
  doEquipQuirk
} from '../stores/gameStore.js';
import { audioBridge } from '../bridge/platformBridge.js';
import ArtSprite from './ArtSprite.vue';

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);

const unlockedBeasts = computed(() => BEASTS.filter((b) => state.value.beasts[b.id]?.unlocked));

const beastDef = computed(() => beastById(view.value.inspectBeastId) || BEASTS[0]);
const bs = computed(() => state.value.beasts[beastDef.value.id]);
const stage = computed(() => INSIGHT_STAGES[bs.value.insight] || INSIGHT_STAGES[0]);
const nextStageExp = computed(() => INSIGHT_THRESHOLD[bs.value.insight + 1] || null);

const maxTrait = computed(() => {
  const vals = TRAITS.map((t) => (bs.value.traits && bs.value.traits[t.id]) || 0);
  return Math.max(5, ...vals);
});

const rememberedLines = computed(() =>
  (bs.value.memoryOrder || [])
    .slice(-8)
    .reverse()
    .map((k) => MEMORY_LINES[k])
    .filter(Boolean)
);

const bondPeers = computed(() =>
  unlockedBeasts.value
    .filter((b) => b.id !== beastDef.value.id)
    .map((b) => ({
      beast: b,
      val: (bs.value.bonds && bs.value.bonds[b.id]) || 0
    }))
);

function pickBeast(id) {
  audioBridge.tap();
  view.value.inspectBeastId = id;
}

function goPack() {
  view.value.prepBeast = beastDef.value.id;
  openModal('pack');
}

function quirkReqText(q) {
  return Object.entries(q.requireTrait)
    .map(([tid, n]) => `${TRAITS.find((t) => t.id === tid)?.name || tid}≥${n}`)
    .join(' · ');
}
</script>

<template>
  <div
    class="modal-card modal-beast"
    role="dialog"
    aria-modal="true"
    aria-label="神兽心境与印记谱"
  >
    <div class="modal-head">
      <div>
        <h2>神兽心境谱</h2>
        <span class="mh-sub">回信话语塑造五维心境，觉醒可切换的后天性格印记</span>
      </div>
      <div class="book-tabs">
        <button
          v-for="b in unlockedBeasts"
          :key="b.id"
          class="book-tab"
          :class="{ on: beastDef.id === b.id }"
          @click="pickBeast(b.id)"
        >
          {{ b.name }}
        </button>
      </div>
      <button
        class="modal-close"
        aria-label="关闭"
        @click="closeModal"
      >
        ×
      </button>
    </div>

    <div class="modal-scroll beast-note-body">
      <div class="bnb-top">
        <span class="bnb-fig"><ArtSprite
          :id="beastDef.id"
          kind="beast"
          :alt="beastDef.name"
        /></span>
        <div class="bnb-summary">
          <span class="bnb-stage">第 {{ bs.insight + 1 }} 阶 · {{ stage.name }}（见闻 {{ bs.insightExp }}{{ nextStageExp ? ` / ${nextStageExp}` : ' · 已著终章' }}）</span>
          <p class="bnb-desc">
            {{ beastDef.desc }}
          </p>
          <p class="bnb-quirk">
            先天秉性：{{ beastDef.quirk }}
          </p>
        </div>
      </div>

      <!-- 五维心境盘 -->
      <div class="soul-section">
        <h3>五维心境盘</h3>
        <div class="trait-bars">
          <div
            v-for="t in TRAITS"
            :key="t.id"
            class="trait-row"
            :title="t.desc"
          >
            <span class="tr-name">{{ t.name }}</span>
            <span class="tr-bar">
              <i :style="{ width: `${Math.min(100, Math.round(((bs.traits?.[t.id] || 0) / maxTrait) * 100))}%`, background: t.color }" />
            </span>
            <span class="tr-val">{{ bs.traits?.[t.id] || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- 12 种后天性格印记（佩戴可激发反差萌奇遇） -->
      <div class="soul-section">
        <h3>后天性格印记 <em>当前佩戴：{{ bs.equippedQuirk ? quirkById(bs.equippedQuirk)?.name : '无（顺其自然）' }}</em></h3>
        <div class="quirk-grid">
          <button
            v-for="q in PERSONA_QUIRKS"
            :key="q.id"
            class="quirk-chip"
            :class="{
              unlocked: bs.unlockedQuirks.includes(q.id),
              equipped: bs.equippedQuirk === q.id
            }"
            :disabled="!bs.unlockedQuirks.includes(q.id)"
            :title="q.desc"
            @click="doEquipQuirk(beastDef.id, bs.equippedQuirk === q.id ? null : q.id)"
          >
            <b>{{ q.name }}</b>
            <em v-if="bs.equippedQuirk === q.id">已佩戴（点此卸下）</em>
            <em v-else-if="bs.unlockedQuirks.includes(q.id)">点击佩戴</em>
            <em v-else>{{ quirkReqText(q) }}</em>
          </button>
        </div>
      </div>

      <!-- 同伴羁绊 & 记忆 -->
      <div class="soul-cols">
        <div class="soul-section">
          <h3>同伴羁绊</h3>
          <div class="bond-list">
            <div
              v-for="p in bondPeers"
              :key="p.beast.id"
              class="bond-pill"
            >
              <span>{{ p.beast.name }}</span>
              <b>同行 {{ p.val }} 次</b>
            </div>
          </div>
        </div>

        <div class="soul-section">
          <h3>它记住的那些话</h3>
          <ul
            v-if="rememberedLines.length"
            class="mem-list"
          >
            <li
              v-for="(line, i) in rememberedLines"
              :key="i"
            >
              {{ line }}
            </li>
          </ul>
          <p
            v-else
            class="muted"
          >
            还没有聊过太多，等它寄信回来给它回信盖章吧。
          </p>
        </div>
      </div>
    </div>

    <div class="modal-foot">
      <span class="mf-note">已出行 {{ bs.travels }} 次 · 到访 {{ Object.keys(bs.visited).length }}/8 城 · 摸头 {{ bs.petCount }} 次</span>
      <span
        v-if="state.trips[beastDef.id]"
        class="mf-note"
      >它正在远行路上</span>
      <button
        v-else
        class="wood-btn"
        @click="goPack"
      >
        替它整行囊
      </button>
    </div>
  </div>
</template>
