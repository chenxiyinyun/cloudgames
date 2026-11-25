<script setup>
import { computed, nextTick, ref } from 'vue';
import gsap from 'gsap';
import {
  BEASTS,
  CITIES,
  SOUVENIRS,
  COMMISSIONS,
  INSIGHT_STAGES,
  cityById,
  souById,
  isSouvenirDiscovered,
  tagName,
  fmtDate
} from '../systems/gameSystems.js';
import { WEATHER_MAP } from '../data/artwork.js';
import {
  gameState,
  codexSummary,
  closeModal,
  openModal
} from '../stores/gameStore.js';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import ArtSprite from './ArtSprite.vue';
import GameIcon from './GameIcon.vue';
import Relic3DStage from '../stage3d/Relic3DStage.vue';

const state = computed(() => gameState.state);
const view = computed(() => gameState.view);
const inspectSouId = ref(null);
const inspectPostcardId = ref(null);
const bookBodyRef = ref(null);

const tabs = [
  ['progress', '山海总卷'],
  ['souvenirs', '百物雅志'],
  ['cities', '九州风物'],
  ['album', '山海留影']
];

const selectedSou = computed(() => {
  if (!inspectSouId.value || !isSouvenirDiscovered(state.value, inspectSouId.value)) return null;
  return souById(inspectSouId.value);
});

const selectedPostcard = computed(() => {
  if (!inspectPostcardId.value) return null;
  return (state.value.postcards || []).find((pc) => pc.id === inspectPostcardId.value) || null;
});

function switchTab(id) {
  if (view.value.codexTab === id) return;
  audioBridge.pageTurn();
  hapticsBridge.trigger('light');
  view.value.codexTab = id;
  inspectSouId.value = null;
  inspectPostcardId.value = null;
  nextTick(() => {
    if (!bookBodyRef.value) return;
    gsap.killTweensOf(bookBodyRef.value);
    gsap.fromTo(
      bookBodyRef.value,
      { rotateY: -12, opacity: 0.35, transformPerspective: 1100, transformOrigin: 'left center' },
      { rotateY: 0, opacity: 1, duration: 0.36, ease: 'power3.out' }
    );
  });
}

function toggleSou(s) {
  if (!isSouvenirDiscovered(state.value, s.id)) return;
  audioBridge.wood();
  inspectSouId.value = inspectSouId.value === s.id ? null : s.id;
}

function togglePostcard(pc) {
  audioBridge.paperOpen();
  inspectPostcardId.value = inspectPostcardId.value === pc.id ? null : pc.id;
}

function onCardMove(e) {
  const el = e.currentTarget;
  if (!el || el.classList.contains('locked')) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / Math.max(1, r.width);
  const y = (e.clientY - r.top) / Math.max(1, r.height);
  el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  el.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(1)}deg`);
  el.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(1)}deg`);
}

function onCardLeave(e) {
  const el = e.currentTarget;
  if (!el) return;
  el.style.removeProperty('--mx');
  el.style.removeProperty('--my');
  el.style.removeProperty('--rx');
  el.style.removeProperty('--ry');
}

function inspectBeast(id) {
  if (!state.value.beasts[id]?.unlocked) return;
  view.value.inspectBeastId = id;
  openModal('beast');
}
</script>

<template>
  <div
    class="modal-card modal-codex thread-book"
    role="dialog"
    aria-modal="true"
    aria-label="线装古籍《新山海经》"
  >
    <div
      class="book-spine-stitch"
      aria-hidden="true"
    >
      <i /><i /><i /><i />
    </div>
    <div class="modal-head desk-head">
      <div class="book-title-seal">
        <h2>新山海经</h2>
        <span class="mh-sub">总纂 {{ codexSummary.avg }}% · 藏品 {{ codexSummary.owned }}/{{ SOUVENIRS.length }}</span>
      </div>
      <div
        class="book-tabs"
        role="tablist"
      >
        <button
          v-for="[id, name] in tabs"
          :key="id"
          class="book-tab"
          :class="{ on: view.codexTab === id }"
          role="tab"
          :aria-selected="view.codexTab === id"
          @click="switchTab(id)"
        >
          {{ name }}
        </button>
      </div>
      <button
        class="return-clasp"
        aria-label="合上典籍"
        @click="closeModal"
      >
        <GameIcon
          name="close-tab"
          :size="14"
        />
        <span>合卷</span>
      </button>
    </div>

    <!-- 线装古籍双页书脊 -->
    <div
      ref="bookBodyRef"
      class="modal-scroll book-pages"
    >
      <!-- 分页 1：山海总卷（左右双页排版） -->
      <div
        v-if="view.codexTab === 'progress'"
        class="book-spread"
      >
        <div class="book-page left-page">
          <div class="codex-hero">
            <span class="ch-cover">
              <ArtSprite
                id="codex-cover.jpg"
                kind="ui"
                alt="新山海经封面"
              />
            </span>
            <div>
              <h3>《新山海经》编纂录</h3>
              <p class="hint">
                上古山海图久未更新。神兽从人间寄回的每一封信、每一件风物，都在把这卷书重新补全。
              </p>
            </div>
          </div>
          <div class="ink-wrap">
            <div
              v-for="p in codexSummary.prog"
              :key="p.id"
              class="ink-row"
            >
              <span class="ink-name">{{ p.name }}</span>
              <span class="ink-bar"><i :style="{ width: `${p.pct}%` }" /></span>
              <span class="ink-num">{{ p.pct }}%</span>
            </div>
          </div>
        </div>

        <div class="book-page right-page">
          <h4 class="page-subhead">
            神兽认知六阶弧线 · 点按可观心境
          </h4>
          <div class="arc-list">
            <button
              v-for="b in BEASTS"
              :key="b.id"
              class="arc-card"
              :class="{ locked: !state.beasts[b.id]?.unlocked }"
              @click="inspectBeast(b.id)"
            >
              <span class="ac-fig"><ArtSprite
                :id="b.id"
                kind="beast"
                :alt="b.name"
              /></span>
              <div class="ac-info">
                <template v-if="state.beasts[b.id]?.unlocked">
                  <b>{{ b.name }} · 第 {{ state.beasts[b.id].insight + 1 }} 阶「{{ INSIGHT_STAGES[state.beasts[b.id].insight]?.name }}」</b>
                  <p>{{ INSIGHT_STAGES[state.beasts[b.id].insight]?.desc }}</p>
                  <em>出行 {{ state.beasts[b.id].travels }} 次 · 见闻 {{ state.beasts[b.id].insightExp }} · 踏足 {{ Object.keys(state.beasts[b.id].visited).length }} 城</em>
                </template>
                <template v-else>
                  <b>{{ b.name }} · 待迎入驿站</b>
                  <p>{{ b.unlockHint }}</p>
                </template>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- 分页 2：百物雅志（36 件藏品 + 3D 描金鉴赏台） -->
      <div
        v-else-if="view.codexTab === 'souvenirs'"
        class="souvenirs-page"
      >
        <div
          v-if="selectedSou"
          class="sou-inspect relic-showcase"
        >
          <Relic3DStage
            :key="selectedSou.id"
            kind="souvenir"
            :art-id="selectedSou.id"
            :title="selectedSou.name"
            :rarity="selectedSou.rarity"
          />
          <div class="si-txt">
            <span class="si-rarity">{{ selectedSou.rarity === 'legend' ? '稀世孤品' : selectedSou.rarity === 'rare' ? '雅致珍玩' : '山海风物' }}</span>
            <b>{{ selectedSou.name }}</b>
            <p>{{ selectedSou.desc }}</p>
            <em>
              招客气息：{{ (selectedSou.attract || []).map((t) => tagName(t)).join('、') || '暂无' }} ·
              {{ (state.souvenirs[selectedSou.id] || 0) > 0 ? `现有 ×${state.souvenirs[selectedSou.id]}` : '已赠出 · 图鉴永久收录（可再寻得）' }}
            </em>
          </div>
        </div>
        <p
          v-else
          class="hint"
        >
          点按已收到的风物纪念品，在 3D 赏玩台拨动细观描金釉色；即使送礼用尽，图鉴也永久保留。
        </p>

        <div class="shelf">
          <button
            v-for="s in SOUVENIRS"
            :key="s.id"
            class="frame"
            :class="[
              isSouvenirDiscovered(state, s.id) ? 'have' : 'locked',
              `r-${s.rarity}`,
              { focus: inspectSouId === s.id }
            ]"
            :disabled="!isSouvenirDiscovered(state, s.id)"
            @click="toggleSou(s)"
            @pointermove="onCardMove"
            @pointerleave="onCardLeave"
          >
            <div class="frame-art">
              <ArtSprite
                :id="s.id"
                kind="souvenir"
                :alt="s.name"
              />
            </div>
            <div class="frame-name">
              {{ isSouvenirDiscovered(state, s.id) ? s.name : '？？？' }}
            </div>
            <div class="frame-city">
              {{ isSouvenirDiscovered(state, s.id) ? (s.city === '*' ? '旅途各处' : cityById(s.city)?.name) : '' }}
              {{ (state.souvenirs[s.id] || 0) > 1 ? ` ×${state.souvenirs[s.id]}` : isSouvenirDiscovered(state, s.id) && !(state.souvenirs[s.id] > 0) ? ' · 已赠' : '' }}
            </div>
            <i
              v-if="isSouvenirDiscovered(state, s.id) && s.rarity === 'legend'"
              class="frame-shine"
            />
          </button>
        </div>
      </div>

      <!-- 分页 3：九州风物与跨城故人委托录 -->
      <div
        v-else-if="view.codexTab === 'cities'"
        class="cities-page"
      >
        <div class="postcard-row">
          <div
            v-for="c in CITIES"
            :key="c.id"
            class="postcard"
            :class="{
              have: BEASTS.some((b) => (state.beasts[b.id]?.visited?.[c.id] || 0) > 0),
              locked: !BEASTS.some((b) => (state.beasts[b.id]?.visited?.[c.id] || 0) > 0)
            }"
          >
            <div class="postcard-photo">
              <ArtSprite
                :id="c.id"
                kind="city"
                :alt="c.name"
              />
            </div>
            <div class="postcard-body">
              <b>{{ c.name }} · {{ c.region }}</b>
              <span>
                {{
                  BEASTS.reduce((sum, b) => sum + (state.beasts[b.id]?.visited?.[c.id] || 0), 0)
                    ? `共到访 ${BEASTS.reduce((sum, b) => sum + (state.beasts[b.id]?.visited?.[c.id] || 0), 0)} 次`
                    : '尚未踏足'
                }}
              </span>
              <em>{{ BEASTS.some((b) => (state.beasts[b.id]?.visited?.[c.id] || 0) > 0) ? c.intro : '给神兽备好路引，去遇见这座城。' }}</em>
            </div>
          </div>
        </div>

        <h4 class="page-subhead">
          跨城故人心愿录（整理行囊第 4 格捎带信物可达成）
        </h4>
        <div class="commission-grid">
          <div
            v-for="cm in COMMISSIONS"
            :key="cm.id"
            class="comm-card"
            :class="{ done: state.commissions[cm.id]?.completed }"
          >
            <div class="cm-head">
              <b>{{ cm.title }}</b>
              <span class="cm-tag">{{ state.commissions[cm.id]?.completed ? '已圆梦' : `盼「${souById(cm.wantSouvenir)?.name}」` }}</span>
            </div>
            <p class="cm-story">
              {{ cm.requester }}（{{ cityById(cm.targetCity)?.name }}）：{{ cm.story }}
            </p>
          </div>
        </div>
      </div>

      <!-- 分页 4：山海留影拍立得画廊 -->
      <div
        v-else
        class="album-page"
      >
        <div
          v-if="selectedPostcard"
          class="sou-inspect relic-showcase"
        >
          <Relic3DStage
            :key="selectedPostcard.id"
            kind="city"
            :art-id="selectedPostcard.cityId"
            :title="selectedPostcard.title"
            rarity="rare"
          />
          <div class="si-txt">
            <span class="si-rarity">{{ cityById(selectedPostcard.cityId)?.name || '九州胜景' }}</span>
            <b>{{ selectedPostcard.title }}</b>
            <p>{{ selectedPostcard.caption }}</p>
            <em>摄于 {{ fmtDate(selectedPostcard.at) }}</em>
          </div>
        </div>

        <div
          v-if="state.postcards.length"
          class="polaroid-grid"
        >
          <button
            v-for="pc in state.postcards"
            :key="pc.id"
            type="button"
            class="polaroid-card"
            :class="{ focus: inspectPostcardId === pc.id }"
            @click="togglePostcard(pc)"
            @pointermove="onCardMove"
            @pointerleave="onCardLeave"
          >
            <div class="pol-photo">
              <ArtSprite
                :id="pc.cityId"
                kind="city"
                :alt="cityById(pc.cityId)?.name"
              />
              <span class="pol-weather">
                <GameIcon
                  :name="WEATHER_MAP[pc.weather]?.iconName || 'weather-sunny'"
                  :size="14"
                />
              </span>
            </div>
            <div class="pol-cap">
              <b>{{ pc.title }}</b>
              <em>{{ pc.caption }} · {{ fmtDate(pc.at) }}</em>
            </div>
          </button>
        </div>
        <div
          v-else
          class="album-empty"
        >
          <p>相册还空着。行囊里装上「旧式相机」或带回稀有风物时，神兽就会留下旅途留影。</p>
        </div>
      </div>
    </div>
  </div>
</template>
