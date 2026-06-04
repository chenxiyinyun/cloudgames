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
        v-for="player in players"
        :key="player.id"
        class="player-slot"
        :class="{ offline: !player.isOnline }"
      >
        <span class="role-label">{{ roleLabel(player.role) }}</span>
        <h2>{{ player.name }}</h2>
        <p>{{ player.isOnline ? '已连接' : '等待连接' }}</p>
      </article>
    </section>

    <button
      class="primary-button wide"
      type="button"
      :disabled="!canStart"
      @click="$emit('start-game')"
    >
      开始拆弹
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
  isHost: {
    type: Boolean,
    default: false
  }
})

defineEmits(['start-game', 'leave-room'])

const canStart = computed(() => props.isHost && props.players.filter(player => player.isOnline).length >= 1)

function roleLabel(role) {
  return role === 'expert' ? '说明书专家' : '现场拆弹员'
}
</script>
