<template>
  <details class="diagnostics-panel">
    <summary>连接诊断</summary>
    <dl>
      <div>
        <dt>连接方式</dt>
        <dd>WebSocket</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ statusLabel }}</dd>
      </div>
      <div>
        <dt>房间号</dt>
        <dd>{{ roomCode || '—' }}</dd>
      </div>
      <div>
        <dt>在线人数</dt>
        <dd>{{ playerCount }}</dd>
      </div>
    </dl>
  </details>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  connectionStatus: { type: String, default: 'disconnected' },
  connected: { type: Boolean, default: false },
  roomCode: { type: String, default: '' },
  playerCount: { type: Number, default: 0 }
})

const STATUS_LABELS = {
  connected: '已连接',
  connecting: '连接中',
  reconnecting: '重连中',
  disconnected: '已断开',
  error: '连接失败'
}

const statusLabel = computed(() => STATUS_LABELS[props.connectionStatus] || props.connectionStatus)
</script>
