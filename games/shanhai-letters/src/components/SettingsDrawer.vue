<script setup>
import { computed, ref } from 'vue';
import { SEASONS, CONSTANTS, fmtDuration } from '../systems/gameSystems.js';
import {
  gameState,
  currentSeason,
  closeModal,
  saveGame,
  syncAudioPrefs,
  supplyRemain,
  serverNow,
  pushCloudSave,
  pullCloudOnStart,
  bindTransferCode,
  resolveCloudConflict,
  doResetSave,
  doImportSave,
  showToast
} from '../stores/gameStore.js';
import { hourglassLeft } from '../systems/gameSystems.js';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import GameIcon from './GameIcon.vue';

const state = computed(() => gameState.state);
const cloud = computed(() => gameState.cloud);
const bindInput = ref('');

const timeModes = [
  ['auto', '随现实'],
  ['dawn', '晨晓'],
  ['noon', '晌午'],
  ['dusk', '暮霞'],
  ['night', '宵夜']
];

const leftHourglass = computed(() => hourglassLeft(state.value, serverNow()));
const herbRemain = computed(() => supplyRemain(state.value, serverNow()));

function setTimeOfDay(mode) {
  audioBridge.tap();
  state.value.timeOfDay = mode;
  saveGame();
}

function toggleSetting(key) {
  state.value.settings[key] = !state.value.settings[key];
  saveGame();
  syncAudioPrefs();
  if (key === 'haptics' && state.value.settings.haptics) {
    hapticsBridge.trigger('medium');
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.value, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `山海来信-存档-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('存档 JSON 已导出');
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        doImportSave(String(reader.result));
      } catch (err) {
        showToast(`导入失败：${err.message}`, 'warn');
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

function handleReset() {
  if (window.confirm('确定重开驿站？所有来信、纪念品、印记与心境都会清空。')) {
    doResetSave();
  }
}

async function copyCode() {
  if (!cloud.value.meta.code) return;
  try {
    await navigator.clipboard.writeText(cloud.value.meta.code);
    cloud.value.panelMessage = `已复制转移码：${cloud.value.meta.code}`;
  } catch {
    cloud.value.panelMessage = `转移码：${cloud.value.meta.code}（请手动记录）`;
  }
}

async function syncNow() {
  cloud.value.panelMessage = '正在同步…';
  await pullCloudOnStart();
  await pushCloudSave();
  cloud.value.panelMessage = cloud.value.lastError || '云端同步完成';
}

async function submitBind() {
  await bindTransferCode(bindInput.value);
  bindInput.value = '';
}
</script>

<template>
  <div
    class="modal-card modal-settings"
    role="dialog"
    aria-modal="true"
    aria-label="驿站杂记与云存档"
  >
    <div class="modal-head desk-head">
      <div>
        <h2>驿站杂记</h2>
        <span class="mh-sub">四时天光 · 声画触感 · 跨端云存档</span>
      </div>
      <button
        class="return-clasp"
        aria-label="收起杂记"
        @click="closeModal"
      >
        <GameIcon
          name="close-tab"
          :size="14"
        />
        <span>收起</span>
      </button>
    </div>

    <div class="modal-scroll settings-body">
      <div class="guide-box">
        <b>山海漫游指南</b>
        <p>① <b>整行囊出门</b>：点茶桌包袱（支持 3 件随身物件 + 第 4 格捎带跨城信物 + 双兽结伴）。</p>
        <p>② <b>采灵材手作</b>：庭院采撷灵草得时令风物，进屋点茶炉可亲手烹糕制器（含「西域司南」「加急火漆」）。</p>
        <p>③ <b>拆火漆盖印</b>：门口信箱收信后点碎火漆，回信塑造五维心境、觉醒后天印记，最后亲手加盖朱砂闲章。</p>
        <p>④ <b>博古架茶会</b>：摆满 3 件同气韵藏品聚成「堂前雅韵」，可在庭院接待茶客以物易物。</p>
      </div>

      <!-- 天光日晷切换 -->
      <div class="set-card">
        <div class="sc-title">
          四时天光滤镜 <em>当前节气：{{ currentSeason.name }}（{{ SEASONS.findIndex((s) => s.id === currentSeason.id) + 1 }}/8）</em>
        </div>
        <div class="time-pills">
          <button
            v-for="[id, label] in timeModes"
            :key="id"
            class="way-chip"
            :class="{ on: state.timeOfDay === id }"
            @click="setTimeOfDay(id)"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <!-- 开关项 -->
      <div class="set-toggles">
        <label class="switch">
          <input
            type="checkbox"
            :checked="state.settings.fastMode"
            @change="toggleSetting('fastMode')"
          >
          <span>快速体验模式（大幅缩短远行与灵草蓄露等待时间）</span>
        </label>
        <label class="switch">
          <input
            type="checkbox"
            :checked="!state.settings.muted"
            @change="toggleSetting('muted')"
          >
          <span>开启木石丝竹拟音</span>
        </label>
        <label class="switch">
          <input
            type="checkbox"
            :checked="!state.settings.ambientMuted"
            @change="toggleSetting('ambientMuted')"
          >
          <span>开启环境白噪音（细雨 / 微风 / 五声古琴泛音）</span>
        </label>
        <label class="switch">
          <input
            type="checkbox"
            :checked="state.settings.haptics"
            @change="toggleSetting('haptics')"
          >
          <span>开启指尖震动反馈（支持移动端与微信小程序）</span>
        </label>
      </div>

      <div class="set-meta">
        <span>今日静心沙漏：剩 {{ leftHourglass }}/{{ CONSTANTS.HOURGLASS_LIMIT }} 次</span>
        <span>灵草蓄露：{{ herbRemain ? `还需 ${fmtDuration(herbRemain)}` : '已可采撷' }}</span>
      </div>

      <!-- 云存档协同区 -->
      <div class="cloud-box">
        <div class="cb-head">
          <b>云存档同步</b>
          <span class="cb-status">{{ cloud.enabled ? (cloud.inFlight ? '同步中…' : cloud.meta.dirty ? '待同步' : '已连接云端') : cloud.disabledReason }}</span>
        </div>

        <div
          v-if="cloud.conflict"
          class="conflict-alert"
        >
          <p>云端（v{{ cloud.conflict.remoteRev }}）与本地进度存在差异，请选择保留哪一份：</p>
          <div class="set-btns">
            <button
              class="wood-btn tiny"
              @click="resolveCloudConflict('cloud')"
            >
              使用云端进度
            </button>
            <button
              class="wood-btn tiny"
              @click="resolveCloudConflict('local')"
            >
              保留本地覆盖云端
            </button>
          </div>
        </div>

        <div
          v-if="cloud.enabled"
          class="cloud-controls"
        >
          <div class="cc-row">
            <span>本机转移码：</span>
            <code>{{ cloud.meta.code || '尚未生成' }}</code>
            <button
              v-if="cloud.meta.code"
              class="wood-btn tiny"
              @click="copyCode"
            >
              复制
            </button>
            <button
              class="wood-btn tiny"
              @click="syncNow"
            >
              立即同步
            </button>
          </div>
          <div class="cc-row">
            <input
              v-model="bindInput"
              maxlength="6"
              placeholder="输入 6 位转移码迁移他处存档"
              class="code-input"
            >
            <button
              class="wood-btn tiny"
              @click="submitBind"
            >
              绑定恢复
            </button>
          </div>
          <p
            v-if="cloud.panelMessage"
            class="cb-msg"
          >
            {{ cloud.panelMessage }}
          </p>
        </div>
      </div>

      <div class="set-btns">
        <button
          class="wood-btn tiny"
          @click="exportJson"
        >
          导出本地 JSON
        </button>
        <button
          class="wood-btn tiny"
          @click="triggerImport"
        >
          导入 JSON
        </button>
        <button
          class="wood-btn tiny danger"
          @click="handleReset"
        >
          重置驿站存档
        </button>
      </div>
    </div>
  </div>
</template>
