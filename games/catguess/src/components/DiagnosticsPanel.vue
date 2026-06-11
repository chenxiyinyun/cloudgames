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
          <span class="diag-label">连接方式</span>
          <span class="diag-value">WebSocket</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">状态</span>
          <span class="diag-value" :class="statusSeverity">{{ statusLabel }}</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">房间号</span>
          <span class="diag-value">{{ roomCode || '—' }}</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">在线人数</span>
          <span class="diag-value">{{ playerCount }}</span>
        </div>
      </div>
    </div>

    <!-- 展开后的详情（紧凑模式展开用） -->
    <div v-if="variant === 'compact' && expanded" class="diag-expanded">
      <div class="diag-grid">
        <div class="diag-cell">
          <span class="diag-label">连接方式</span>
          <span class="diag-value">WebSocket</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">状态</span>
          <span class="diag-value" :class="statusSeverity">{{ statusLabel }}</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">房间号</span>
          <span class="diag-value">{{ roomCode || '—' }}</span>
        </div>
        <div class="diag-cell">
          <span class="diag-label">在线人数</span>
          <span class="diag-value">{{ playerCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  connectionStatus: { type: String, default: 'disconnected' },
  connected: { type: Boolean, default: false },
  roomCode: { type: String, default: '' },
  playerCount: { type: Number, default: 0 },
  variant: {
    type: String,
    default: 'compact',
    validator: (v) => ['compact', 'detail'].includes(v)
  }
});

const expanded = ref(false);

const STATUS_LABELS = {
  connected: '已连接',
  connecting: '连接中',
  reconnecting: '重连中',
  disconnected: '未连接',
  error: '连接失败'
};

const statusLabel = computed(
  () => STATUS_LABELS[props.connectionStatus] || props.connectionStatus
);

const statusSeverity = computed(() => {
  if (props.connectionStatus === 'connected') return 'severity-ok';
  if (props.connectionStatus === 'error' || props.connectionStatus === 'disconnected') {
    return 'severity-bad';
  }
  return 'severity-warn';
});

const severityClass = computed(() => statusSeverity.value);

const severityIcon = computed(() => {
  if (severityClass.value === 'severity-bad') return '🔴';
  if (severityClass.value === 'severity-warn') return '🟡';
  return '🟢';
});

// 紧凑模式用一句话总结
const summaryText = computed(() => {
  if (props.connected && props.roomCode) {
    return `WebSocket · ${statusLabel.value} · 房间 ${props.roomCode}`;
  }
  return `WebSocket · ${statusLabel.value}`;
});
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
