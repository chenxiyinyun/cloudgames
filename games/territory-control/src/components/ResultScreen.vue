<template>
  <main class="screen result-screen">
    <section class="result-panel">
      <p class="eyebrow">
        battle report
      </p>
      <h1>{{ title }}</h1>
      <div class="score-list">
        <div
          v-for="player in rankedPlayers"
          :key="player.id"
          class="score-row"
        >
          <span
            class="swatch"
            :style="{ background: player.color }"
          />
          <span>{{ player.name }}</span>
          <strong>{{ player.territories }} 块</strong>
        </div>
      </div>
      <div class="result-actions">
        <button
          v-if="isHost"
          class="primary-button"
          type="button"
          @click="$emit('restart')"
        >
          再开一局
        </button>
        <button
          class="ghost-button"
          type="button"
          @click="$emit('leave-room')"
        >
          返回
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
  playerId: {
    type: String,
    default: null
  },
  isHost: Boolean
})

defineEmits(['restart', 'leave-room'])

const winner = computed(() =>
  props.room.players.find(player => player.id === props.room.gameState.winnerId)
)

const title = computed(() => {
  if (!winner.value) return '战局结束'
  return winner.value.id === props.playerId ? '你赢得了全图' : `${winner.value.name} 统一了战场`
})

const rankedPlayers = computed(() =>
  props.room.players
    .map(player => ({
      ...player,
      territories: props.room.gameState.territories.filter(t => t.ownerId === player.id).length
    }))
    .sort((a, b) => b.territories - a.territories)
)
</script>
