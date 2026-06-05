<template>
  <article
    class="module-tile maze-module"
    :class="{ solved: module.status === 'solved' }"
  >
    <header>
      <h2>迷宫</h2>
      <span>{{ module.status === 'solved' ? 'SOLVED' : 'ARMED' }}</span>
    </header>
    <div class="maze-body">
      <div
        class="maze-board"
        :style="boardStyle"
      >
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="maze-cell"
          :class="cell.classes"
        >
          <span v-if="cell.marker">{{ cell.marker }}</span>
        </div>
      </div>
      <div class="maze-dpad">
        <button
          class="maze-step up"
          type="button"
          :disabled="module.status === 'solved'"
          aria-label="向上移动"
          @click="move('up')"
        >
          ↑
        </button>
        <button
          class="maze-step left"
          type="button"
          :disabled="module.status === 'solved'"
          aria-label="向左移动"
          @click="move('left')"
        >
          ←
        </button>
        <button
          class="maze-step right"
          type="button"
          :disabled="module.status === 'solved'"
          aria-label="向右移动"
          @click="move('right')"
        >
          →
        </button>
        <button
          class="maze-step down"
          type="button"
          :disabled="module.status === 'solved'"
          aria-label="向下移动"
          @click="move('down')"
        >
          ↓
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  module: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['module-action'])

// Each move carries a monotonically increasing nonce so two identical steps
// (e.g. "up" twice) are not collapsed by the network operation deduper.
const seq = ref(0)

const boardStyle = computed(() =>
  `grid-template-columns: repeat(${props.module.bombView.size}, 1fr)`
)

const cells = computed(() => {
  const { size, position, goal } = props.module.bombView
  const out = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const isPlayer = position.x === x && position.y === y
      const isGoal = goal.x === x && goal.y === y
      out.push({
        key: `${x}-${y}`,
        classes: { 'cell-player': isPlayer, 'cell-goal': isGoal },
        marker: isPlayer ? '●' : isGoal ? '⚑' : ''
      })
    }
  }
  return out
})

function move(direction) {
  seq.value += 1
  emit('module-action', {
    moduleId: props.module.id,
    action: {
      type: 'move',
      direction,
      seq: seq.value
    }
  })
}
</script>
