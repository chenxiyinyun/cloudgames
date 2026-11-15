<template>
  <div class="history-panel">
    <div class="history-title">
      手数记录
    </div>
    <div class="history-list">
      <div
        v-if="items.length === 0"
        class="history-empty"
      >
        尚未落子
      </div>
      <div
        v-for="item in items"
        :key="item.index"
        class="history-item"
      >
        <span class="history-num">{{ item.index + 1 }}.</span>
        <span
          class="stone-dot"
          :class="item.color === BLACK ? 'black' : 'white'"
        />
        <span class="history-coord">{{ item.coord }}</span>
        <span class="history-player">{{ item.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { BLACK } from '../services/gameEngine';
import { coordLabel } from '../services/coords';

const props = defineProps({
  moves: { type: Array, default: () => [] },
  players: { type: Array, default: () => [] }
});

const items = computed(() => props.moves.map((move, index) => ({
  index,
  color: move.color,
  coord: coordLabel(move.row, move.col),
  name: props.players.find(player => player.id === move.playerId)?.name || '未知'
})));
</script>

<style scoped>
.history-panel {
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  padding: 1rem;
}

.history-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-brown);
  margin-bottom: 0.6rem;
  letter-spacing: 0.1em;
}

.history-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.history-empty {
  color: rgba(44, 36, 22, 0.4);
  font-size: 0.85rem;
  text-align: center;
  padding: 0.8rem 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.2rem;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
}

.history-item:last-child {
  border-bottom: none;
}

.history-num {
  color: var(--ink-brown);
  min-width: 26px;
}

.history-coord {
  font-weight: 700;
}

.history-player {
  margin-left: auto;
  color: var(--ink-brown);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80px;
}
</style>
