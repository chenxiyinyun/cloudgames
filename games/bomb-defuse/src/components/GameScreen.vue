<template>
  <main class="screen game-screen">
    <header class="game-header">
      <div>
        <p class="eyebrow">
          room {{ roomCode }}
        </p>
        <h1>{{ currentRole === 'expert' ? '说明书终端' : '炸弹面板' }}</h1>
      </div>
      <div
        class="timer"
        aria-label="倒计时"
      >
        {{ countdown }}
      </div>
    </header>

    <section class="status-strip">
      <span>错误次数 {{ strikes.length }} / {{ room.gameState.strikeLimit }}</span>
      <span>{{ roleCopy }}</span>
      <span>{{ onlineNames }}</span>
    </section>

    <BombPanel
      v-if="currentRole === 'defuser'"
      :modules="modules"
      :serial-number="room.gameState.serialNumber"
      :batteries="room.gameState.batteries"
      :indicators="room.gameState.indicators"
      @module-action="$emit('module-action', $event)"
    />
    <ManualPanel
      v-else
      :modules="modules"
      :serial-number="room.gameState.serialNumber"
      :batteries="room.gameState.batteries"
      :indicators="room.gameState.indicators"
    />

    <footer class="debug-actions">
      <button
        v-if="isHost"
        class="danger-button"
        type="button"
        @click="$emit('end-game')"
      >
        结束任务
      </button>
      <button
        class="ghost-button"
        type="button"
        @click="$emit('leave-room')"
      >
        离开
      </button>
    </footer>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BombPanel from './BombPanel.vue'
import ManualPanel from './ManualPanel.vue'

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  roomCode: {
    type: String,
    required: true
  },
  playerId: {
    type: String,
    default: null
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

defineEmits(['module-action', 'end-game', 'leave-room'])

const now = ref(Date.now())
let tickTimer = null

const currentPlayer = computed(() =>
  props.room.players.find(player => player.id === props.playerId)
)

const currentRole = computed(() => currentPlayer.value?.role || 'expert')
const modules = computed(() => props.room.gameState.modules || [])
const strikes = computed(() => props.room.gameState.strikes || [])
const roleCopy = computed(() =>
  currentRole.value === 'defuser' ? '你负责操作模块' : '你负责阅读说明书'
)
const onlineNames = computed(() =>
  props.room.players
    .filter(player => player.isOnline)
    .map(player => `${player.name} · ${player.role === 'expert' ? '专家' : '拆弹员'}`)
    .join(' / ')
)
const countdown = computed(() => {
  const deadlineAt = props.room.gameState.deadlineAt
  if (!deadlineAt) return '05:00'
  const remainingMs = Math.max(0, deadlineAt - now.value)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})

onMounted(() => {
  tickTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 250)
})

onUnmounted(() => {
  window.clearInterval(tickTimer)
})
</script>
