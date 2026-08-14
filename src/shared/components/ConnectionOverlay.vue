<template>
  <Transition name="overlay-fade">
    <div
      v-if="visible"
      class="connection-overlay"
      :class="overlayClass"
    >
      <div class="overlay-card">
        <div class="overlay-icon">
          {{ icon }}
        </div>
        <div class="overlay-title">
          {{ title }}
        </div>
        <div class="overlay-message">
          {{ message || defaultMessage }}
        </div>
        <div
          v-if="showProgress"
          class="overlay-progress"
        >
          <div
            v-for="i in 3"
            :key="i"
            class="progress-dot"
            :style="{ animationDelay: (i * 0.3) + 's' }"
          />
        </div>
        <DiagnosticsPanel
          v-if="status === 'error' || status === 'disconnected'"
          :connection-status="status"
          :connected="false"
          :room-code="roomCode"
          :player-count="playerCount"
          variant="detail"
        />
        <div class="overlay-actions">
          <button
            v-if="showRetry"
            class="overlay-btn overlay-btn-primary"
            @click="$emit('retry')"
          >
            🔄 手动重连
          </button>
          <button
            class="overlay-btn overlay-btn-secondary"
            @click="$emit('leave')"
          >
            🚪 离开房间
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * 共享断线遮罩 — 连接中/重连中/断开/失败时的全屏提示与手动重连入口。
 *
 * props 与 createGameNetwork 的 RECONNECT_METADATA / gameState.connectionStatus 对齐。
 * 主题：通过 CSS 变量接入各游戏配色（--overlay-* 优先，回退到 --cat-* / 中性默认值）。
 */
import { computed } from 'vue'
import DiagnosticsPanel from './DiagnosticsPanel.vue'

const props = defineProps({
  status: { type: String, default: 'connected' },
  message: { type: String, default: '' },
  attempt: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 6 },
  roomCode: { type: String, default: '' },
  playerCount: { type: Number, default: 0 },
  // 未知状态时的占位图标（各游戏可传自己的主题图标）
  defaultIcon: { type: String, default: '📡' }
})

defineEmits(['retry', 'leave'])

const visible = computed(() => props.status !== 'connected')

const showProgress = computed(() =>
  props.status === 'connecting' || props.status === 'reconnecting'
)

const showRetry = computed(() =>
  props.status === 'error' || props.status === 'disconnected'
)

const icon = computed(() => {
  switch (props.status) {
    case 'connecting': return '🔗'
    case 'reconnecting': return '🔄'
    case 'disconnected': return '⚠️'
    case 'error': return '❌'
    default: return props.defaultIcon
  }
})

const title = computed(() => {
  switch (props.status) {
    case 'connecting': return '正在连接...'
    case 'reconnecting': return `正在重连 (${props.attempt}/${props.maxAttempts})`
    case 'disconnected': return '连接已断开'
    case 'error': return '连接失败'
    default: return ''
  }
})

const defaultMessage = computed(() => {
  switch (props.status) {
    case 'connecting': return '正在建立连接，请稍候...'
    case 'reconnecting': return '检测到网络波动，正在自动恢复连接...'
    case 'disconnected': return '与房间的连接已断开，请检查网络后手动重连'
    case 'error': return '多次重连失败，请检查网络环境后重试'
    default: return ''
  }
})

const overlayClass = computed(() => `overlay-${props.status}`)
</script>

<style scoped>
.connection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-backdrop, rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.overlay-card {
  background: var(--overlay-card-bg, #fff);
  border: 3px solid var(--overlay-card-border, var(--cat-border, #e0e0e0));
  border-radius: 20px;
  padding: 32px 28px;
  max-width: 360px;
  width: 90%;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.overlay-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.overlay-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--overlay-title, var(--cat-text, #333));
}

.overlay-message {
  font-size: 14px;
  color: var(--overlay-text, var(--cat-text-light, #666));
  margin-bottom: 20px;
  line-height: 1.5;
}

.overlay-progress {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--overlay-accent, var(--cat-accent, #4a90d9));
  animation: dot-bounce 0.6s ease-in-out infinite alternate;
}

@keyframes dot-bounce {
  from {
    transform: translateY(0);
    opacity: 0.5;
  }
  to {
    transform: translateY(-8px);
    opacity: 1;
  }
}

.overlay-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overlay-btn {
  width: 100%;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.overlay-btn:hover {
  opacity: 0.85;
}

.overlay-btn-primary {
  border: none;
  background: var(--overlay-accent, var(--cat-accent, #4a90d9));
  color: var(--overlay-btn-text, #fff);
}

.overlay-btn-secondary {
  border: 2px solid var(--overlay-card-border, var(--cat-border, #ccc));
  background: transparent;
  color: var(--overlay-text, var(--cat-text-light, #666));
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.overlay-error .overlay-card {
  border-color: var(--overlay-error, var(--cat-red, #e87060));
}

.overlay-reconnecting .overlay-card {
  border-color: var(--overlay-accent, var(--cat-accent, #4a90d9));
}

.overlay-connecting .overlay-card {
  border-color: var(--overlay-info, var(--cat-blue, #7ab8d4));
}

.overlay-disconnected .overlay-card {
  border-color: var(--overlay-warn, var(--cat-brown, #c47a30));
}

@media (max-width: 600px) {
  .overlay-card {
    padding: 24px 20px;
  }
  .overlay-icon {
    font-size: 36px;
  }
  .overlay-title {
    font-size: 16px;
  }
}
</style>
