<template>
  <main class="screen lobby-screen">
    <header class="top-bar">
      <div>
        <p class="eyebrow">
          mission room
        </p>
        <h1>等待搭档</h1>
      </div>
      <button
        class="ghost-button"
        type="button"
        @click="$emit('leave-room')"
      >
        离开
      </button>
    </header>

    <section class="room-code-panel">
      <span>任务代码</span>
      <strong>{{ roomCode }}</strong>
    </section>

    <section
      class="player-grid"
      aria-label="玩家席位"
    >
      <article
        v-for="slot in playerSlots"
        :key="slot.id"
        class="player-slot"
        :class="{ offline: !slot.isOnline }"
      >
        <span class="role-label">{{ roleLabel(slot.role) }}</span>
        <h2>{{ slot.name }}</h2>
        <p>{{ slot.isOnline ? '已连接' : '等待连接' }}</p>
        <small v-if="slot.id === playerId">你</small>
      </article>
    </section>

    <button
      v-if="canSwapRoles"
      class="ghost-button wide"
      type="button"
      @click="$emit('swap-roles')"
    >
      交换身份
    </button>

    <button
      class="primary-button wide"
      type="button"
      :disabled="!canStart"
      @click="$emit('start-game')"
    >
      {{ isHost ? '开始拆弹' : '等待房主开始' }}
    </button>
  </main>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  roomCode: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  playerId: {
    type: String,
    default: null
  },
  isHost: {
    type: Boolean,
    default: false
  },
  connected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['start-game', 'swap-roles', 'leave-room'])

const playerSlots = computed(() => {
  const slots = [...props.players]
  while (slots.length < 2) {
    slots.push({
      id: `empty-${slots.length}`,
      name: slots.length === 0 ? '等待拆弹员' : '等待说明书专家',
      role: slots.length === 0 ? 'defuser' : 'expert',
      isOnline: false
    })
  }
  return slots.slice(0, 2)
})

const canStart = computed(() =>
  props.isHost && props.connected && props.players.filter(player => player.isOnline).length === 2
)

const canSwapRoles = computed(() =>
  props.isHost &&
  props.players.length === 2 &&
  props.players.every(p => p.role)
)

function roleLabel(role) {
  return role === 'expert' ? '说明书专家' : '现场拆弹员'
}
</script>
