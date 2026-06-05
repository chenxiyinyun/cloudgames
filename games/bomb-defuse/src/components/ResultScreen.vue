<template>
  <main class="screen result-screen">
    <section
      class="result-panel"
      :class="result"
    >
      <p class="eyebrow">
        room {{ roomCode }}
      </p>
      <h1>{{ title }}</h1>
      <p>
        {{ summary }}
      </p>

      <dl class="result-stats">
        <div>
          <dt>用时</dt>
          <dd>{{ elapsedTime }}</dd>
        </div>
        <div>
          <dt>错误</dt>
          <dd>{{ strikes.length }} / {{ room.gameState.strikeLimit }}</dd>
        </div>
        <div>
          <dt>模块</dt>
          <dd>{{ solvedCount }} / {{ modules.length }}</dd>
        </div>
      </dl>

      <ol
        v-if="actionLog.length"
        class="action-log"
      >
        <li
          v-for="entry in actionLog"
          :key="`${entry.moduleId}-${entry.at}`"
        >
          {{ entry.moduleId }} · {{ entry.correct ? '正确' : '错误' }}
        </li>
      </ol>

      <div class="result-actions">
        <button
          v-if="isHost"
          class="primary-button"
          type="button"
          @click="$emit('restart')"
        >
          返回等待室
        </button>
        <button
          class="secondary-button"
          type="button"
          @click="$emit('back-to-menu')"
        >
          回到菜单
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  roomCode: {
    type: String,
    required: true
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

defineEmits(['restart', 'back-to-menu'])

const result = computed(() => props.room.gameState.result || props.room.phase)
const modules = computed(() => props.room.gameState.modules || [])
const strikes = computed(() => props.room.gameState.strikes || [])
const actionLog = computed(() => props.room.gameState.actionLog || [])
const solvedCount = computed(() => props.room.gameState.solvedModuleIds?.length || 0)
const title = computed(() => {
  if (result.value === 'solved') return '炸弹已解除'
  if (result.value === 'exploded') return '任务失败'
  return '任务结束'
})
const summary = computed(() => {
  if (result.value === 'solved') return '所有模块都已完成，现场保持安全。'
  if (result.value === 'exploded') return '错误次数或倒计时触发了爆炸条件。'
  return '房主结束了当前任务。'
})
const elapsedTime = computed(() => {
  const startedAt = props.room.gameState.startedAt
  const endedAt = props.room.gameState.endedAt || Date.now()
  if (!startedAt) return '--:--'
  const totalSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})
</script>
