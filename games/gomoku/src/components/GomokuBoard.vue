<template>
  <div class="goban">
    <div class="coord col-coords">
      <span
        v-for="(letter, index) in COL_LETTERS"
        :key="'col-' + index"
      >{{ letter }}</span>
    </div>
    <div class="coord row-coords">
      <span
        v-for="n in BOARD_SIZE"
        :key="'row-' + n"
      >{{ BOARD_SIZE + 1 - n }}</span>
    </div>

    <div
      class="grid-area"
      :class="gridAreaClass"
    >
      <span
        v-for="i in BOARD_SIZE"
        :key="'h-' + i"
        class="line h"
        :style="{ top: linePos(i) }"
      />
      <span
        v-for="i in BOARD_SIZE"
        :key="'v-' + i"
        class="line v"
        :style="{ left: linePos(i) }"
      />
      <span
        v-for="(point, index) in STAR_POINTS"
        :key="'star-' + index"
        class="star-point"
        :style="{ left: pointPos(point[1]), top: pointPos(point[0]) }"
      />
      <button
        v-for="cell in hitCells"
        :key="'hit-' + cell.key"
        type="button"
        class="hit-cell"
        :style="{ left: pointPos(cell.col), top: pointPos(cell.row) }"
        :disabled="!canPlace || cellOccupied(cell.row, cell.col)"
        :aria-label="cell.label"
        @click="onCellClick(cell.row, cell.col)"
      />
      <span
        v-for="stone in stones"
        :key="'stone-' + stone.key"
        class="stone"
        :class="stone.color"
        :style="{ left: pointPos(stone.col), top: pointPos(stone.row) }"
      />
      <span
        v-if="lastMove"
        class="last-move-marker"
        :class="lastMove.color === BLACK ? 'on-black' : 'on-white'"
        :style="{ left: pointPos(lastMove.col), top: pointPos(lastMove.row) }"
      />
      <span
        v-for="cell in winningLineCells"
        :key="'win-' + cell.key"
        class="win-marker"
        :style="{ left: pointPos(cell.col), top: pointPos(cell.row) }"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { BLACK, BOARD_SIZE, EMPTY, STAR_POINTS } from '../services/gameEngine';
import { COL_LETTERS, coordLabel } from '../services/coords';

const props = defineProps({
  board: { type: Array, default: () => [] },
  canPlace: { type: Boolean, default: false },
  myRole: { type: String, default: null },
  lastMove: { type: Object, default: null },
  winningLine: { type: Array, default: () => [] }
});

const emit = defineEmits(['place']);

const gridAreaClass = computed(() => {
  if (!props.canPlace) return '';
  return props.myRole === 'black' ? 'my-turn-black' : 'my-turn-white';
});

const stones = computed(() => {
  const result = [];
  const board = props.board;
  if (!board) return result;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const value = board[row][col];
      if (value !== EMPTY) {
        result.push({ key: `${row}-${col}`, row, col, color: value === BLACK ? 'black' : 'white' });
      }
    }
  }
  return result;
});

// 点击层只需生成一次（位置固定）
const hitCells = [];
for (let row = 0; row < BOARD_SIZE; row++) {
  for (let col = 0; col < BOARD_SIZE; col++) {
    hitCells.push({ key: `${row}-${col}`, row, col, label: coordLabel(row, col) });
  }
}

const winningLineCells = computed(() => (props.winningLine || []).map(cell => ({ key: `${cell.row}-${cell.col}`, row: cell.row, col: cell.col })));

function linePos(index) {
  // 第 index 条线（1 起始）位于 (index - 1) / 14 处
  return `${((index - 1) / (BOARD_SIZE - 1)) * 100}%`;
}

function pointPos(value) {
  return `${(value / (BOARD_SIZE - 1)) * 100}%`;
}

function cellOccupied(row, col) {
  return props.board && props.board[row][col] !== EMPTY;
}

function onCellClick(row, col) {
  if (!props.canPlace || cellOccupied(row, col)) return;
  emit('place', { row, col });
}
</script>

<style scoped>
.goban {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 235, 190, 0.35), transparent 60%),
    linear-gradient(135deg, var(--wood) 0%, var(--wood-dark) 100%);
  border: 3px solid var(--wood-deep);
  border-radius: 6px;
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.45),
    inset 0 0 46px rgba(120, 72, 20, 0.28);
}

.coord {
  position: absolute;
  display: flex;
  color: var(--board-line);
  font-size: 0.65rem;
  font-weight: 700;
  pointer-events: none;
  opacity: 0.85;
}

.col-coords {
  bottom: 1.4%;
  left: 5.5%;
  right: 5.5%;
  justify-content: space-between;
}

.row-coords {
  left: 1.4%;
  top: 5.5%;
  bottom: 5.5%;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.grid-area {
  position: absolute;
  inset: 5.5%;
}

.line {
  position: absolute;
  background: var(--board-line);
}

.line.h {
  left: 0;
  right: 0;
  height: 1px;
}

.line.v {
  top: 0;
  bottom: 0;
  width: 1px;
}

.star-point {
  position: absolute;
  width: 7px;
  height: 7px;
  background: var(--board-line);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.hit-cell {
  position: absolute;
  width: calc(100% / 14);
  height: calc(100% / 14);
  transform: translate(-50%, -50%);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.hit-cell:disabled {
  cursor: default;
}

.grid-area.my-turn-black .hit-cell:not(:disabled):hover::after,
.grid-area.my-turn-white .hit-cell:not(:disabled):hover::after {
  content: '';
  position: absolute;
  inset: 10%;
  border-radius: 50%;
}

.grid-area.my-turn-black .hit-cell:not(:disabled):hover::after {
  background: radial-gradient(circle at 35% 30%, #5a5a5a, #181818 70%);
  opacity: 0.45;
}

.grid-area.my-turn-white .hit-cell:not(:disabled):hover::after {
  background: radial-gradient(circle at 35% 30%, #ffffff, #d8d4c8 75%);
  border: 1px solid #b0aca0;
  opacity: 0.6;
}

.stone {
  position: absolute;
  width: calc(100% / 14 * 0.92);
  height: calc(100% / 14 * 0.92);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.stone.black {
  background: radial-gradient(circle at 35% 30%, #5a5a5a, #181818 70%);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.5), inset -2px -2px 3px rgba(0, 0, 0, 0.4);
}

.stone.white {
  background: radial-gradient(circle at 35% 30%, #ffffff, #d8d4c8 75%);
  border: 1px solid #b0aca0;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.35), inset -2px -2px 3px rgba(0, 0, 0, 0.12);
}

.last-move-marker {
  position: absolute;
  width: calc(100% / 14 * 0.28);
  height: calc(100% / 14 * 0.28);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.last-move-marker.on-black {
  background: #e8e4d9;
}

.last-move-marker.on-white {
  background: var(--ink-red);
}

.win-marker {
  position: absolute;
  width: calc(100% / 14 * 0.98);
  height: calc(100% / 14 * 0.98);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 3px solid var(--ink-red);
  box-sizing: border-box;
  pointer-events: none;
  animation: win-pulse 1s ease-in-out infinite;
}

@keyframes win-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
