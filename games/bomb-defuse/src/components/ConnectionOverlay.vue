<template>
  <div class="connection-overlay">
    <section class="connection-dialog">
      <p class="eyebrow">
        connection
      </p>
      <h2>{{ statusLabel }}</h2>
      <p>{{ message || '正在恢复任务连接。' }}</p>
      <p v-if="status === 'reconnecting'">
        第 {{ attempt }} / {{ maxAttempts }} 次尝试
      </p>
      <div class="result-actions">
        <button
          class="primary-button"
          type="button"
          @click="$emit('retry')"
        >
          重试
        </button>
        <button
          class="secondary-button"
          type="button"
          @click="$emit('leave')"
        >
          离开
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  attempt: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 8
  }
})

defineEmits(['retry', 'leave'])

const statusLabel = computed(() => {
  if (props.status === 'error') return '连接异常'
  if (props.status === 'reconnecting') return '正在重连'
  return '正在连接'
})
</script>
