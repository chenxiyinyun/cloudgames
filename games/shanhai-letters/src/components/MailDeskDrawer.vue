<script setup>
import { computed, ref, watch } from 'vue';
import {
  TRAITS,
  STAMPS,
  cityById,
  souById,
  stampById,
  beastById,
  fmtDate
} from '../systems/gameSystems.js';
import { WEATHER_MAP } from '../data/artwork.js';
import {
  gameState,
  unreadLetters,
  closeModal,
  openModal,
  doOpenLetter,
  doReplyLetter
} from '../stores/gameStore.js';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import ArtSprite from './ArtSprite.vue';
import GameIcon from './GameIcon.vue';
import Envelope3DStage from '../stage3d/Envelope3DStage.vue';
import Stamp3DStage from '../stage3d/Stamp3DStage.vue';

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);

const inkRevealing = ref(false);
const pendingOptionIdx = ref(null);
const selectedStampId = ref('jianzi');
const stamping = ref(false);
const stampStageRef = ref(null);

const curLetter = computed(() => {
  const list = state.value.letters;
  if (!list.length) return null;
  const hit = list.find((l) => l.id === view.value.openLetterId);
  if (hit) return hit;
  const fallback = unreadLetters.value[0] || list[0];
  return fallback || null;
});

const curCity = computed(() => (curLetter.value?.city ? cityById(curLetter.value.city) : null));
const curSouvenir = computed(() => (curLetter.value?.souvenir ? souById(curLetter.value.souvenir) : null));
const curWeather = computed(() => (curLetter.value?.weather ? WEATHER_MAP[curLetter.value.weather] : null));
const curBeastDef = computed(() => (curLetter.value?.beastId ? beastById(curLetter.value.beastId) : null));
const curStampDef = computed(() => (curLetter.value?.stamp ? stampById(curLetter.value.stamp) : null));

const letterParagraphs = computed(() => {
  if (!curLetter.value || !curLetter.value.body) return [];
  return String(curLetter.value.body).split('\n').filter((p) => p.trim().length > 0);
});

watch(curLetter, () => {
  pendingOptionIdx.value = null;
  inkRevealing.value = false;
  stamping.value = false;
});

function selectLetter(l) {
  audioBridge.paperOpen();
  hapticsBridge.trigger('light');
  view.value.openLetterId = l.id;
}

function onEnvelopeOpened() {
  if (!curLetter.value) return;
  doOpenLetter(curLetter.value.id);
  inkRevealing.value = true;
}

function skipInkReveal() {
  inkRevealing.value = false;
}

function traitLabel(traitId) {
  return TRAITS.find((t) => t.id === traitId) || null;
}

function pickReplyChoice(idx) {
  audioBridge.tap();
  hapticsBridge.trigger('light');
  pendingOptionIdx.value = idx;
  if (!state.value.stamps.includes(selectedStampId.value)) {
    selectedStampId.value = state.value.stamps[0] || 'jianzi';
  }
}

function triggerStampPress() {
  if (!curLetter.value || pendingOptionIdx.value == null || stamping.value) return;
  stamping.value = true;
  if (stampStageRef.value && typeof stampStageRef.value.triggerStamp === 'function') {
    stampStageRef.value.triggerStamp();
  } else {
    completeReplyAfterStamp();
  }
}

function completeReplyAfterStamp() {
  if (!curLetter.value || pendingOptionIdx.value == null) {
    stamping.value = false;
    return;
  }
  doReplyLetter(curLetter.value.id, pendingOptionIdx.value, selectedStampId.value);
  pendingOptionIdx.value = null;
  stamping.value = false;
}
</script>

<template>
  <div
    class="modal-card modal-mail"
    :class="{ 'empty-mail': !state.letters.length }"
    role="dialog"
    aria-modal="true"
    aria-label="驿站信笺桌"
  >
    <div class="modal-head desk-head">
      <div>
        <h2>驿站信案</h2>
        <span
          v-if="state.letters.length"
          class="mh-sub"
        >{{ state.letters.length }} 封来信 · {{ unreadLetters.length ? `${unreadLetters.length} 封待拆或待回` : '皆已回信落印' }}</span>
      </div>
      <button
        class="return-clasp"
        aria-label="收起信案"
        @click="closeModal"
      >
        <GameIcon
          name="close-tab"
          :size="14"
        />
        <span>收起</span>
      </button>
    </div>

    <div
      v-if="!state.letters.length"
      class="mail-empty-box"
    >
      <div class="meb-envelope">
        <span class="meb-seal">山海</span>
      </div>
      <p class="meb-title">
        信箱里还空着
      </p>
      <p class="meb-desc">
        正厅桌案上摆着蓝印花布包袱，送一只神兽出门，它走远了就会寄信回来。
      </p>
      <button
        class="wood-btn"
        @click="openModal('pack')"
      >
        去屋里整行囊
      </button>
    </div>

    <div
      v-else-if="curLetter"
      class="mail-desk"
    >
      <!-- 左侧信封栈 -->
      <div
        class="env-list"
        aria-label="来信列表"
      >
        <button
          v-for="l in state.letters"
          :key="l.id"
          class="env-tab"
          :class="{
            on: l.id === curLetter.id,
            stage: l.stage,
            visitor: l.visitor,
            sealed: !l.opened
          }"
          @click="selectLetter(l)"
        >
          <span class="et-stamp">
            <ArtSprite
              id="ui-stamp-red.jpg"
              kind="ui"
            />
          </span>
          <span class="et-info">
            <b>{{ l.title }}</b>
            <em>{{ l.beastName }}{{ l.coAuthorName ? ` & ${l.coAuthorName}` : '' }} · {{ l.cityName }}</em>
          </span>
          <i
            v-if="!l.opened"
            class="et-dot"
          >未拆</i>
          <i
            v-else-if="l.reply && l.replied == null"
            class="et-dot"
          >待回</i>
          <i
            v-else-if="l.stage"
            class="et-tag"
          >阶段</i>
          <i
            v-else-if="l.coAuthorId"
            class="et-tag"
          >合写</i>
        </button>
      </div>

      <!-- 右侧信笺桌 -->
      <div class="letter-pane">
        <!-- 仪式 1：未拆封的 3D 宣纸火漆信封特写 -->
        <Envelope3DStage
          v-if="!curLetter.opened"
          :key="curLetter.id"
          :title="curLetter.title"
          :from-text="`${curLetter.beastName}${curLetter.coAuthorName ? ` 与 ${curLetter.coAuthorName}` : ''} 寄呈`"
          :city-name="curLetter.cityName"
          :date-text="fmtDate(curLetter.at)"
          :paper-tint="curBeastDef?.paperTint || 'warm'"
          @opened="onEnvelopeOpened"
        />

        <!-- 仪式 2：已展开的宣纸信笺 + 水墨显影 -->
        <template v-else>
          <div
            class="sheet"
            :class="[
              curBeastDef ? `paper-${curBeastDef.paperTint}` : '',
              { 'ink-reveal': inkRevealing }
            ]"
            :style="{ '--ink-color': curBeastDef ? curBeastDef.inkTone : '#453729' }"
            @click="skipInkReveal"
          >
            <ArtSprite
              id="ui-letter-paper.jpg"
              kind="ui"
              class="ui-letter-bg"
            />
            <div
              v-if="curCity"
              class="sheet-photo"
            >
              <ArtSprite
                :id="curCity.id"
                kind="city"
                :alt="curCity.name"
              />
              <span class="sp-city-tag">{{ curCity.name }} · {{ curCity.region }}</span>
            </div>
            <div
              v-if="curWeather"
              class="sheet-weather"
              :title="curWeather.label"
            >
              <GameIcon
                :name="curWeather.iconName || 'weather-sunny'"
                :size="18"
              />
            </div>

            <h3 class="sheet-title">
              {{ curLetter.title }}
            </h3>
            <div class="sheet-body">
              <p
                v-for="(para, pIdx) in letterParagraphs"
                :key="pIdx"
                class="sheet-para"
                :style="{ '--stagger-delay': `${pIdx * 110}ms` }"
              >
                {{ para }}
              </p>
            </div>

            <div class="sheet-sign-row">
              <span
                v-if="curStampDef"
                class="paper-stamp-seal"
                :title="curStampDef.motto"
              >
                {{ curStampDef.name }}
              </span>
              <span class="sheet-sign">
                —— {{ curLetter.beastName }}{{ curLetter.coAuthorName ? `、${curLetter.coAuthorName}` : '' }} 于 {{ curLetter.cityName }}，{{ fmtDate(curLetter.at) }}
              </span>
            </div>
          </div>

          <!-- 归因回显胶囊 -->
          <div
            v-if="curLetter.causes && curLetter.causes.length"
            class="causes"
          >
            <span class="causes-label">因果回显</span>
            <span
              v-for="(c, cIdx) in curLetter.causes"
              :key="cIdx"
              class="cause-pill"
            >{{ c }}</span>
          </div>

          <!-- 随信带回的风物纪念品 -->
          <div
            v-if="curSouvenir"
            class="gain"
          >
            <span class="gain-art">
              <ArtSprite
                :id="curSouvenir.id"
                kind="souvenir"
                :alt="curSouvenir.name"
              />
            </span>
            <span class="gain-text">
              <b>带回「{{ curSouvenir.name }}」</b>
              <em>{{ curSouvenir.desc }}</em>
            </span>
          </div>

          <!-- 已回信状态 -->
          <div
            v-if="curLetter.reply && curLetter.replied != null"
            class="replied"
          >
            <span class="replied-mark">已寄回信</span>
            <span>「{{ curLetter.reply[curLetter.replied].text }}」</span>
            <span
              v-if="curStampDef"
              class="replied-stamp"
            >盖章：{{ curStampDef.name }}</span>
            <em>{{ curLetter.visitor ? '驿站记住了这句话。' : '心境又深了一寸。' }}</em>
          </div>

          <!-- 仪式 3：回信选择 + 朱砂闲章盖印 -->
          <div
            v-else-if="curLetter.reply"
            class="reply-box"
          >
            <p class="reply-q">
              提笔回一句给{{ curLetter.beastName }}：
            </p>
            <div class="reply-opts">
              <button
                v-for="(r, idx) in curLetter.reply"
                :key="idx"
                class="reply-opt"
                :class="{ picked: pendingOptionIdx === idx }"
                @click="pickReplyChoice(idx)"
              >
                <i aria-hidden="true">{{ '一二三'[idx] || '·' }}</i>
                <span class="ro-text">{{ r.text }}</span>
                <span
                  v-if="r.trait && traitLabel(r.trait)"
                  class="ro-trait"
                  :style="{ '--trait-color': traitLabel(r.trait).color }"
                >
                  +{{ traitLabel(r.trait).name }}
                </span>
              </button>
            </div>

            <!-- 选定语句后展开 3D 朱砂印泥台 -->
            <div
              v-if="pendingOptionIdx != null"
              class="stamp-tray"
            >
              <div class="st-head">
                <b>择一枚山海朱砂闲章落印</b>
                <span>{{ stampById(selectedStampId)?.motto }}</span>
              </div>
              <div class="st-grid">
                <button
                  v-for="st in STAMPS"
                  :key="st.id"
                  class="stamp-chip"
                  :class="{ on: selectedStampId === st.id, locked: !state.stamps.includes(st.id) }"
                  :disabled="!state.stamps.includes(st.id) || stamping"
                  @click="selectedStampId = st.id"
                >
                  <span>{{ state.stamps.includes(st.id) ? st.name : '未得' }}</span>
                </button>
              </div>
              <Stamp3DStage
                ref="stampStageRef"
                :stamp-name="stampById(selectedStampId)?.name || '见字如晤'"
                :stamp-motto="stampById(selectedStampId)?.motto || ''"
                :disabled="stamping"
                @stamped="completeReplyAfterStamp"
              />
              <button
                class="wood-btn seal-btn stamp-press-btn"
                :class="{ 'is-stamping': stamping }"
                :disabled="stamping"
                @click="triggerStampPress"
              >
                落印寄出「{{ stampById(selectedStampId)?.name }}」
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
