<template>
  <div class="diagnostics-panel" :class="`variant-${variant}`">
    <!-- 紧凑模式：菜单页底部一行 -->
    <button
      v-if="variant === 'compact'"
      class="diag-row"
      :class="severityClass"
      type="button"
      @click="expanded = !expanded"
    >
      <span class="diag-icon">{{ severityIcon }}</span>
      <span class="diag-summary">{{ summaryText }}</span>
      <span class="diag-toggle">{{ expanded ? '▴' : '▾' }}</span>
    </button>

    <!-- 详情模式：连接/错误时显示 -->
    <div v-else class="diag-detail">
      <div class="diag-title">连接诊断</div>
      <div class="diag-grid">
        <div class="diag-cell">
          <span class="diag-label">信令</span>
          <span class="diag-value" :class="signalingSeverity">
            {{ signalingLabel }}
          </span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">TURN</span>
          <span class="diag-value" :class="turnSeverity">
            {{ turnLabel }}
          </span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">当前模式</span>
          <span class="diag-value" :class="modeSeverity">
            {{ modeLabel }}
          </span>
        </div>
        <div v-if="lastChange" class="diag-cell full">
          <span class="diag-label">最近切换</span>
          <span class="diag-value">
            {{ formatLastChange(lastChange) }}
          </span>
        </div>
        <div v-for="(peer, peerId) in peers" :key="peerId" class="diag-cell full">
          <span class="diag-label">对端 {{ shortPeerId(peerId) }}</span>
          <span class="diag-value">
            ICE: {{ peer.iceConnectionState || '?' }}
            · conn: {{ peer.connectionState || '?' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 展开后的详情（紧凑模式展开用） -->
    <div v-if="variant === 'compact' && expanded" class="diag-expanded">
      <div class="diag-grid">
        <div class="diag-cell">
          <span class="diag-label">信令</span>
          <span class="diag-value" :class="signalingSeverity">{{ signalingLabel }}</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">TURN</span>
          <span class="diag-value" :class="turnSeverity">{{ turnLabel }}</span>
        </div>
        <div v-if="lastChange" class="diag-cell full">
          <span class="diag-label">最近切换</span>
          <span class="diag-value">{{ formatLastChange(lastChange) }}</span>
        </div>
        <div v-for="(peer, peerId) in peers" :key="peerId" class="diag-cell full">
          <span class="diag-label">{{ shortPeerId(peerId) }}</span>
          <span class="diag-value">
            ICE: {{ peer.iceConnectionState || '?' }} · conn: {{ peer.connectionState || '?' }}
          </span>
        </div>
      </div>
      <!-- 没配国内/自建基础设施时给玩家解释为啥 -->
      <div v-if="!turnRelayInfo?.totalCount" class="diag-hint">
        ⚠️ 未配置 TURN 中继，5G/4G 对称 NAT 设备大概率连不上。
      </div>
      <div v-else-if="signalingInfo?.isRisky" class="diag-hint">
        ⚠️ 未配置国内/自建 PeerJS 信令，无法创建或加入房间。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  diagnostics: { type: Object, required: true },
  variant: {
    type: String,
    default: 'compact',
    validator: (v) => ['compact', 'detail'].includes(v)
  }
});

const expanded = ref(false);

const signalingInfo = computed(() => props.diagnostics?.signaling || null);
const turnRelayInfo = computed(() => props.diagnostics?.turnRelay || null);
const mode = computed(() => props.diagnostics?.mode || 'unknown');
const lastChange = computed(() => props.diagnostics?.lastModeChange || null);
const peers = computed(() => props.diagnostics?.peers || {});

const signalingLabel = computed(() => signalingInfo.value?.label || '未初始化');
const turnLabel = computed(() => turnRelayInfo.value?.label || '未初始化');
const modeLabel = computed(() => {
  const m = mode.value;
  if (m === 'relay') return '中继 (TURN)';
  if (m === 'direct-or-relay') return '尝试直连';
  return m;
});

// 紧凑模式用一句话总结
const summaryText = computed(() => {
  const sig = signalingInfo.value?.isConfigured ? '✓ 国内信令' : '✗ 无信令';
  const turn = turnRelayInfo.value?.tier === 'excellent'
    ? '✓ TURN'
    : '✗ 无 TURN';
  return `${sig} · ${turn}`;
});

const severityClass = computed(() => {
  if (signalingInfo.value?.isRisky && !turnRelayInfo.value?.hasSelfHosted) return 'severity-bad';
  if (signalingInfo.value?.isRisky || !turnRelayInfo.value?.hasSelfHosted) return 'severity-warn';
  return 'severity-ok';
});

const severityIcon = computed(() => {
  if (severityClass.value === 'severity-bad') return '🔴';
  if (severityClass.value === 'severity-warn') return '🟡';
  return '🟢';
});

const signalingSeverity = computed(() => {
  if (!signalingInfo.value) return '';
  return signalingInfo.value.isRisky ? 'severity-warn' : 'severity-ok';
});

const turnSeverity = computed(() => {
  if (!turnRelayInfo.value) return '';
  if (turnRelayInfo.value.tier === 'excellent') return 'severity-ok';
  return 'severity-bad';
});

const modeSeverity = computed(() => {
  if (mode.value === 'relay') return 'severity-warn'; // 走中继说明直连不通
  if (mode.value === 'direct-or-relay') return 'severity-ok';
  return '';
});

function formatLastChange(c) {
  if (!c) return '';
  const phaseText = {
    'trying-direct': '正在尝试直连',
    'switching-to-relay': '切换到 TURN 中继',
    'using-relay': '使用 TURN 中继',
    'failed': '连接失败'
  }[c.phase] || c.phase;
  return c.reason ? `${phaseText} — ${c.reason}` : phaseText;
}

function shortPeerId(id) {
  if (!id) return '';
  if (id.length <= 12) return id;
  return id.slice(0, 6) + '…' + id.slice(-4);
}
</script>

<style scoped>
.diagnostics-panel {
  font-size: 12px;
  color: var(--cat-text-light);
  font-family: 'Courier New', 'Courier Prime', monospace;
  user-select: none;
}

/* 紧凑模式：菜单页底部一行 */
.diag-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--cat-border);
  border-radius: 12px;
  font-family: inherit;
  font-size: 11px;
  color: var(--cat-text-light);
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}
.diag-row:hover {
  background: rgba(255, 255, 255, 0.85);
}
.diag-icon {
  font-size: 10px;
}
.diag-summary {
  flex: 1;
}
.diag-toggle {
  font-size: 10px;
  color: var(--cat-text-light);
}

.diag-row.severity-ok {
  border-color: #b8d8b8;
  background: rgba(220, 240, 220, 0.5);
}
.diag-row.severity-warn {
  border-color: #f0c89a;
  background: rgba(252, 240, 220, 0.5);
}
.diag-row.severity-bad {
  border-color: #e87060;
  background: rgba(252, 220, 215, 0.5);
}

/* 展开后的详情 */
.diag-expanded {
  margin-top: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--cat-border);
  border-radius: 12px;
}

.diag-hint {
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(232, 112, 96, 0.1);
  border-left: 3px solid #e87060;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: #a04030;
}

/* 详情模式：连接/错误时显示 */
.diag-detail {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--cat-border);
  border-radius: 12px;
  text-align: left;
}
.diag-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--cat-text);
  margin-bottom: 8px;
  letter-spacing: 0.05em;
}

.diag-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.diag-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.diag-cell.full {
  grid-column: 1 / -1;
}
.diag-label {
  font-size: 10px;
  color: var(--cat-text-light);
  letter-spacing: 0.03em;
}
.diag-value {
  font-size: 12px;
  color: var(--cat-text);
  word-break: break-all;
}
.diag-value.severity-ok { color: #4a8a4a; }
.diag-value.severity-warn { color: #c47a30; }
.diag-value.severity-bad { color: #c44030; }
</style>
