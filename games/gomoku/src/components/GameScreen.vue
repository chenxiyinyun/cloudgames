<template>
  <div class="screen active">
    <div class="game-container">
      <!-- 顶部玩家栏 -->
      <div class="players-bar">
        <div
          class="player-card"
          :class="{ active: isBlackTurn, offline: blackPlayer && !blackPlayer.isOnline }"
        >
          <span class="stone-dot black" />
          <div class="player-meta">
            <div class="player-name">
              {{ blackPlayer?.name || '等待加入' }}
              <ParticipantTag
                v-if="blackPlayer"
                :type="blackPlayer.type"
                compact
              />
            </div>
            <div class="player-role">
              黑棋
            </div>
          </div>
          <span
            v-if="blackPlayer && !blackPlayer.isOnline"
            class="offline-badge"
          >断线</span>
        </div>

        <div class="status-center">
          <div class="turn-text">
            {{ turnText }}
          </div>
          <div
            class="countdown"
            :class="{ urgent: isUrgent }"
          >
            {{ countdownText }}
          </div>
          <div class="move-count">
            第 {{ moveCount }} 手
          </div>
        </div>

        <div
          class="player-card"
          :class="{ active: isWhiteTurn, offline: whitePlayer && !whitePlayer.isOnline }"
        >
          <span class="stone-dot white" />
          <div class="player-meta">
            <div class="player-name">
              {{ whitePlayer?.name || '等待加入' }}
              <ParticipantTag
                v-if="whitePlayer"
                :type="whitePlayer.type"
                compact
              />
            </div>
            <div class="player-role">
              白棋
            </div>
          </div>
          <span
            v-if="whitePlayer && !whitePlayer.isOnline"
            class="offline-badge"
          >断线</span>
        </div>
      </div>

      <!-- 连接状态提示 -->
      <div
        v-if="connectionMessage && connectionStatus !== 'connected'"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- 断线提示和重连按钮 -->
      <div
        v-if="!isOnline"
        class="disconnect-alert"
      >
        <div class="disconnect-title">
          连接中断
        </div>
        <p class="disconnect-message">
          你与对局服务器失去联系，重连后可继续对弈
        </p>
        <button
          class="btn btn-primary"
          :disabled="isReconnecting"
          @click="handleReconnect"
        >
          <span>{{ isReconnecting ? '重新连接中...' : '重新连接' }}</span>
        </button>
      </div>

      <!-- 终局横幅：展示赛果并引导查看结算（棋盘保持可见，可看到获胜连线） -->
      <div
        v-if="isEnded"
        class="end-banner"
      >
        <span
          class="end-banner-title"
          :class="endBannerClass"
        >{{ endBannerTitle }}</span>
        <span class="end-banner-sub">{{ endBannerSub }}</span>
        <button
          class="btn btn-primary"
          @click="showResult"
        >
          <span>查看结算</span>
        </button>
      </div>

      <div class="game-main">
        <!-- 棋盘 -->
        <div class="board-wrap">
          <div class="goban">
            <!-- 坐标 -->
            <div class="coord col-coords">
              <span
                v-for="(letter, index) in COL_LETTERS"
                :key="'col-' + index"
              >{{ letter }}</span>
            </div>
            <div class="coord row-coords">
              <span
                v-for="n in 15"
                :key="'row-' + n"
              >{{ 16 - n }}</span>
            </div>

            <div
              class="grid-area"
              :class="gridAreaClass"
            >
              <!-- 网格线 -->
              <span
                v-for="i in 15"
                :key="'h-' + i"
                class="line h"
                :style="{ top: linePos(i) }"
              />
              <span
                v-for="i in 15"
                :key="'v-' + i"
                class="line v"
                :style="{ left: linePos(i) }"
              />
              <!-- 星位 -->
              <span
                v-for="(point, index) in STAR_POINTS"
                :key="'star-' + index"
                class="star-point"
                :style="{ left: pointPos(point[1]), top: pointPos(point[0]) }"
              />
              <!-- 落子点击层 -->
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
              <!-- 棋子 -->
              <span
                v-for="stone in stones"
                :key="'stone-' + stone.key"
                class="stone"
                :class="stone.color"
                :style="{ left: pointPos(stone.col), top: pointPos(stone.row) }"
              />
              <!-- 最后一手标记 -->
              <span
                v-if="lastMove"
                class="last-move-marker"
                :class="lastMove.color === BLACK ? 'on-black' : 'on-white'"
                :style="{ left: pointPos(lastMove.col), top: pointPos(lastMove.row) }"
              />
              <!-- 获胜连线高亮 -->
              <span
                v-for="cell in winningLineCells"
                :key="'win-' + cell.key"
                class="win-marker"
                :style="{ left: pointPos(cell.col), top: pointPos(cell.row) }"
              />
            </div>
          </div>
        </div>

        <!-- 侧栏 -->
        <div class="side-panel">
          <div class="panel-actions">
            <button
              class="btn btn-danger"
              :disabled="!canResign"
              @click="onResignClick"
            >
              <span>{{ confirmingResign ? '确认认输？' : '认输' }}</span>
            </button>
            <button
              v-if="gameState.isHost"
              class="btn btn-secondary"
              @click="onEndGame"
            >
              <span>结束对局</span>
            </button>
            <button
              class="btn btn-secondary"
              @click="showRules = true"
            >
              <span>规则</span>
            </button>
          </div>

          <div class="history-panel">
            <div class="history-title">
              手数记录
            </div>
            <div class="history-list">
              <div
                v-if="moveHistory.length === 0"
                class="history-empty"
              >
                尚未落子
              </div>
              <div
                v-for="(move, index) in moveHistory"
                :key="index"
                class="history-item"
              >
                <span class="history-num">{{ index + 1 }}.</span>
                <span
                  class="stone-dot"
                  :class="move.color === BLACK ? 'black' : 'white'"
                />
                <span class="history-coord">{{ coordLabel(move.row, move.col) }}</span>
                <span class="history-player">{{ playerNameById(move.playerId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Game Rules Modal ─── -->
      <div
        v-if="showRules"
        class="rules-overlay"
        @click.self="showRules = false"
      >
        <div class="rules-modal">
          <button
            class="rules-close"
            @click="showRules = false"
          >
            ✕
          </button>
          <h2 class="rules-title">
            ⚫ 五子棋
          </h2>
          <p class="rules-subtitle">
            游戏规则简介
          </p>

          <div class="rules-section">
            <h3>🎯 目标</h3>
            <p>在 15×15 的棋盘上，先将 <strong>5 颗棋子</strong>连成一线（横、竖、斜均可）者获胜。</p>
          </div>

          <div class="rules-section">
            <h3>⚫⚪ 先后手</h3>
            <p>房主执 <strong>黑棋</strong>先行，对手执 <strong>白棋</strong>。每局结束后再来一局会自动交换先后手。</p>
          </div>

          <div class="rules-section">
            <h3>⏱ 回合计时</h3>
            <p>每手限时 <strong>60 秒</strong>。超时未落子判负，对手直接获胜。</p>
          </div>

          <div class="rules-section">
            <h3>🏳 认输与结束</h3>
            <p>对局中可随时认输；房主也可以提前结束对局。棋盘下满仍无人获胜则为平局。</p>
          </div>

          <button
            class="btn btn-primary rules-got-it"
            @click="showRules = false"
          >
            <span>知道了！</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  gameState,
  handlePlaceStone,
  handleResign,
  handleEndGame,
  reconnectRoom,
  GAME_PHASES
} from '../stores/gameStore';
import ParticipantTag from '../../../../src/shared/components/ParticipantTag.vue';
import {
  BOARD_SIZE,
  BLACK,
  EMPTY,
  STAR_POINTS
} from '../services/gameEngine';
import { COL_LETTERS, coordLabel } from '../services/coords';

const showRules = ref(false);
const confirmingResign = ref(false);
const isReconnecting = ref(false);
let resignTimer = null;

const room = computed(() => gameState.room);
const players = computed(() => room.value.players || []);
const blackPlayer = computed(() => players.value.find(p => p.role === 'black'));
const whitePlayer = computed(() => players.value.find(p => p.role === 'white'));
const moveHistory = computed(() => room.value.moveHistory || []);
const moveCount = computed(() => moveHistory.value.length);
const lastMove = computed(() => moveHistory.value[moveHistory.value.length - 1] || null);
const winningLineCells = computed(() => (room.value.winningLine || []).map(cell => ({ key: `${cell.row}-${cell.col}`, row: cell.row, col: cell.col })));

const isBlackTurn = computed(() => room.value.phase === GAME_PHASES.PLAYING && room.value.currentTurn === 'black');
const isWhiteTurn = computed(() => room.value.phase === GAME_PHASES.PLAYING && room.value.currentTurn === 'white');

const connectionStatus = computed(() => gameState.connectionStatus);
const connectionMessage = computed(() => gameState.connectionMessage);

const isOnline = computed(() => {
  const me = players.value.find(p => p.id === gameState.playerId);
  return me?.isOnline !== false;
});

const canPlace = computed(() => {
  return room.value.phase === GAME_PHASES.PLAYING
    && gameState.role !== null
    && gameState.role === room.value.currentTurn
    && isOnline.value;
});

const canResign = computed(() => room.value.phase === GAME_PHASES.PLAYING && isOnline.value);

const gridAreaClass = computed(() => {
  if (!canPlace.value) return '';
  return gameState.role === 'black' ? 'my-turn-black' : 'my-turn-white';
});

// ── 棋盘渲染数据 ────────────────────────────────────────────────────────────

const stones = computed(() => {
  const result = [];
  const board = room.value.board;
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

function linePos(index) {
  // 第 index 条线（1 起始）位于 (index - 1) / 14 处
  return `${((index - 1) / (BOARD_SIZE - 1)) * 100}%`;
}

function pointPos(value) {
  return `${(value / (BOARD_SIZE - 1)) * 100}%`;
}

function cellOccupied(row, col) {
  const board = room.value.board;
  return board && board[row][col] !== EMPTY;
}

// ── 回合计时展示 ────────────────────────────────────────────────────────────

const nowTick = ref(Date.now());
let timer = null;

onMounted(() => {
  timer = setInterval(() => { nowTick.value = Date.now(); }, 500);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (resignTimer) clearTimeout(resignTimer);
});

const remainingSeconds = computed(() => {
  const deadline = room.value.turnDeadline;
  if (!deadline || room.value.phase !== GAME_PHASES.PLAYING) return null;
  return Math.max(0, Math.ceil((deadline - nowTick.value) / 1000));
});

const isUrgent = computed(() => remainingSeconds.value !== null && remainingSeconds.value <= 10);

const countdownText = computed(() => {
  if (remainingSeconds.value === null) return '--';
  return `${remainingSeconds.value}s`;
});

// ── 文案 ────────────────────────────────────────────────────────────────────

const turnText = computed(() => {
  if (room.value.phase === GAME_PHASES.WAITING) return '等待开始';
  if (room.value.phase === GAME_PHASES.ENDED) {
    if (room.value.winner === 'draw') return '平局';
    if (!room.value.winner) return '对局结束';
    return `${room.value.winner === 'black' ? '黑棋' : '白棋'}获胜`;
  }
  return gameState.role === room.value.currentTurn ? '轮到你落子' : '等待对手落子';
});

// ── 终局横幅 ────────────────────────────────────────────────────────────────

const isEnded = computed(() => room.value.phase === GAME_PHASES.ENDED);

const endBannerTitle = computed(() => {
  if (room.value.winner === 'draw') return '握手言和';
  if (!room.value.winner) return '对局结束';
  return gameState.role === room.value.winner ? '你赢了！' : '你输了';
});

const endBannerClass = computed(() => {
  if (room.value.winner === 'draw' || !room.value.winner) return 'draw';
  return gameState.role === room.value.winner ? 'win' : 'lose';
});

const endBannerSub = computed(() => {
  if (room.value.winner === 'draw') return '棋盘下满，双方势均力敌';
  if (!room.value.winner) return '房主结束了本局对弈';
  const winnerName = players.value.find(p => p.role === room.value.winner)?.name || '对手';
  return `${room.value.winner === 'black' ? '黑棋' : '白棋'} · ${winnerName} 获得胜利`;
});

function showResult() {
  gameState.screen = 'result';
}

function playerNameById(playerId) {
  return players.value.find(p => p.id === playerId)?.name || '未知';
}

// ── 操作 ────────────────────────────────────────────────────────────────────

function onCellClick(row, col) {
  if (!canPlace.value) return;
  if (cellOccupied(row, col)) return;
  handlePlaceStone(row, col);
}

function onResignClick() {
  if (!canResign.value) return;
  if (!confirmingResign.value) {
    confirmingResign.value = true;
    resignTimer = setTimeout(() => { confirmingResign.value = false; }, 3000);
    return;
  }
  confirmingResign.value = false;
  clearTimeout(resignTimer);
  handleResign();
}

function onEndGame() {
  if (!gameState.isHost) return;
  handleEndGame();
}

async function handleReconnect() {
  isReconnecting.value = true;
  try {
    await reconnectRoom();
  } finally {
    isReconnecting.value = false;
  }
}
</script>

<style scoped>
.game-container {
  width: 100%;
  max-width: 1060px;
  margin: 0 auto;
}

/* ─── 顶部玩家栏 ─── */
.players-bar {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.player-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  padding: 0.8rem 1rem;
  transition: all 0.3s ease;
  min-width: 0;
}

.player-card.active {
  border-color: var(--ink-black);
  box-shadow: 0 0 0 3px rgba(44, 36, 22, 0.15);
}

.player-card.offline {
  opacity: 0.6;
}

.player-meta {
  min-width: 0;
}

.player-name {
  font-size: 0.95rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.player-role {
  font-size: 0.75rem;
  color: var(--ink-brown);
  margin-top: 0.2rem;
}

.status-center {
  min-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  padding: 0.8rem 1rem;
}

.turn-text {
  font-size: 0.95rem;
  font-weight: 700;
}

.countdown {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--ink-blue);
  font-variant-numeric: tabular-nums;
}

.countdown.urgent {
  color: var(--ink-red);
  animation: blink 1s ease-in-out infinite;
}

.move-count {
  font-size: 0.75rem;
  color: var(--ink-brown);
}

/* ─── 主区域布局 ─── */
.game-main {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.board-wrap {
  flex: 1;
  min-width: 0;
  max-width: 640px;
}

/* ─── 棋盘 ─── */
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

/* ─── 侧栏 ─── */
.side-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.panel-actions .btn {
  width: 100%;
}

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

/* ─── 终局横幅 ─── */
.end-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--paper-bg);
  border: 3px solid var(--ink-black);
  padding: 0.9rem 1.2rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.end-banner-title {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.end-banner-title.win {
  color: var(--ink-green);
}

.end-banner-title.lose {
  color: var(--ink-red);
}

.end-banner-title.draw {
  color: var(--ink-blue);
}

.end-banner-sub {
  font-size: 0.9rem;
  color: var(--ink-brown);
}

/* ─── 断线提示 ─── */
.disconnect-alert {
  background: var(--paper-bg);
  border: 3px solid var(--ink-red);
  padding: 1.5rem;
  margin-bottom: 1.2rem;
  text-align: center;
}

.disconnect-title {
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--ink-red);
  margin-bottom: 0.6rem;
}

.disconnect-message {
  color: var(--ink-brown);
  margin-bottom: 1rem;
}

/* ─── Rules Modal ─── */
.rules-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.rules-modal {
  background: var(--paper-bg);
  border: 3px solid var(--telegram-border);
  padding: 32px 28px;
  max-width: 480px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.rules-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: 2px solid var(--telegram-border);
  font-size: 16px;
  cursor: pointer;
  color: var(--ink-brown);
  padding: 2px 8px;
  transition: all 0.2s;
}

.rules-close:hover {
  background: var(--ink-red);
  color: var(--paper-bg);
  border-color: var(--ink-red);
}

.rules-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--ink-black);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.rules-subtitle {
  font-size: 13px;
  color: var(--ink-brown);
  margin-bottom: 20px;
}

.rules-section {
  margin-bottom: 16px;
}

.rules-section h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-black);
  margin-bottom: 6px;
}

.rules-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-black);
}

.rules-got-it {
  margin-top: 8px;
  width: 100%;
}

/* ─── 响应式 ─── */
@media (max-width: 900px) {
  .game-main {
    flex-direction: column;
    align-items: center;
  }

  .board-wrap {
    width: 100%;
    max-width: 560px;
  }

  .side-panel {
    width: 100%;
    max-width: 560px;
  }

  .players-bar {
    flex-wrap: wrap;
  }

  .player-card {
    flex: 1 1 40%;
  }

  .status-center {
    order: 3;
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
