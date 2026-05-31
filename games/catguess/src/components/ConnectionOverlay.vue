<template>
  <Transition name="overlay-fade">
    <div v-if="visible" class="connection-overlay" :class="overlayClass">
      <div class="overlay-card">
        <div class="overlay-icon">{{ icon }}</div>
        <div class="overlay-title">{{ title }}</div>
        <div class="overlay-message">{{ message || defaultMessage }}</div>
        <div v-if="showProgress" class="overlay-progress">
          <div v-for="i in 3" :key="i" class="progress-dot"
            :style="{ animationDelay: (i * 0.3) + 's' }" />
        </div>
        <div class="overlay-actions">
          <button v-if="showRetry" class="btn btn-primary" @click="$emit('retry')">
            🔄 手动重连
          </button>
          <button v-if="showLeave" class="btn btn-secondary" @click="$emit('leave')">
            🚪 离开房间
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'connected' },
  message: { type: String, default: '' },
  attempt: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 8 }
})

defineEmits(['retry', 'leave'])

const visible = computed(() => props.status !== 'connected')

const showProgress = computed(() =>
  props.status === 'connecting' || props.status === 'reconnecting'
)

const showRetry = computed(() =>
  props.status === 'error' || props.status === 'disconnected'
)

const showLeave = computed(() => true)

const icon = computed(() => {
  switch (props.status) {
    case 'connecting': return '🔗'
    case 'reconnecting': return '🔄'
    case 'disconnected': return '⚠️'
    case 'error': return '❌'
    default: return '🐱'
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
    case 'connecting': return '正在建立 P2P 连接，请稍候...'
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.overlay-card {
  background: white;
  border: 3px solid var(--cat-border);
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
  color: var(--cat-text);
}

.overlay-message {
  font-size: 14px;
  color: var(--cat-text-light);
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
  background: var(--cat-accent);
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

.overlay-actions .btn {
  width: 100%;
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
  border-color: var(--cat-red);
}

.overlay-reconnecting .overlay-card {
  border-color: var(--cat-accent);
}

.overlay-connecting .overlay-card {
  border-color: var(--cat-blue);
}

.overlay-disconnected .overlay-card {
  border-color: var(--cat-brown);
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
