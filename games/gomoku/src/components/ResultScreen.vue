<template>
  <div class="screen active">
    <div class="card">
      <div class="result-header">
        <span class="header-stone black" />
        <div>
          <div class="header-title">
            GAME RESULT
          </div>
          <div class="header-subtitle">
            对 局 结 算
          </div>
        </div>
        <span class="header-stone white" />
      </div>

      <div class="result-panel">
        <div
          class="result-title"
          :class="resultClass"
        >
          {{ resultTitle }}
        </div>
        <div class="result-subtitle">
          {{ resultSubtitle }}
        </div>

        <div class="result-detail">
          <div class="detail-row">
            <span class="detail-label">对局手数</span>
            <span class="detail-value">{{ moveCount }} 手</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">结束方式</span>
            <span class="detail-value">{{ endReasonText }}</span>
          </div>
          <div
            v-if="winningLineCoords"
            class="detail-row"
          >
            <span class="detail-label">获胜连线</span>
            <span class="detail-value">{{ winningLineCoords }}</span>
          </div>
        </div>

        <div class="result-actions">
          <button
            class="btn btn-primary"
            :disabled="!gameState.isHost"
            @click="onRestart"
          >
            <span>{{ gameState.isHost ? '再来一局' : '等待房主' }}</span>
          </button>
          <button
            class="btn btn-secondary"
            @click="onBackToMenu"
          >
            <span>返回大厅</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { gameState, handleRestart, leaveRoom } from '../stores/gameStore';
import { coordLabel } from '../services/coords';

const winner = computed(() => gameState.room.winner);
const endReason = computed(() => gameState.room.endReason);
const moveCount = computed(() => (gameState.room.moveHistory || []).length);

const isDraw = computed(() => winner.value === 'draw');
const isWinner = computed(() => !isDraw.value && winner.value !== null && winner.value === gameState.role);
const isLoser = computed(() => !isDraw.value && winner.value !== null && winner.value !== gameState.role);

const resultTitle = computed(() => {
  if (isDraw.value) return '握手言和';
  if (isWinner.value) return '你赢了！';
  if (isLoser.value) return '你输了';
  return '对局结束';
});

const resultClass = computed(() => {
  if (isDraw.value) return 'draw';
  return isWinner.value ? 'win' : 'lose';
});

const resultSubtitle = computed(() => {
  if (isDraw.value) return '棋盘下满，双方势均力敌';
  if (!winner.value) return '房主结束了本局对弈';
  const winnerName = (gameState.room.players || []).find(p => p.role === winner.value)?.name || '对手';
  return `${winner.value === 'black' ? '黑棋' : '白棋'} · ${winnerName} 获得胜利`;
});

const END_REASON_TEXT = {
  win: '五子连线',
  draw: '棋盘下满',
  timeout: '回合超时判负',
  resign: '一方认输',
  host_end: '房主结束对局'
};

const endReasonText = computed(() => END_REASON_TEXT[endReason.value] || '对局结束');

const winningLineCoords = computed(() => {
  const line = gameState.room.winningLine;
  if (!line || line.length === 0) return null;
  return line.map(cell => coordLabel(cell.row, cell.col)).join(' · ');
});

async function onRestart() {
  if (gameState.isHost) {
    handleRestart();
  }
}

async function onBackToMenu() {
  await leaveRoom();
}
</script>

<style scoped>
.result-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-stone {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.header-stone.black {
  background: radial-gradient(circle at 35% 30%, #555, #181818 70%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}

.header-stone.white {
  background: radial-gradient(circle at 35% 30%, #fff, #d8d4c8 75%);
  border: 1px solid #b8b4a8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.header-title {
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-align: center;
}

.header-subtitle {
  font-size: 0.7rem;
  color: var(--ink-brown);
  letter-spacing: 0.2em;
  text-align: center;
}

.result-panel {
  text-align: center;
  padding: 1rem 0;
}

.result-title {
  font-size: 2.2rem;
  font-weight: 900;
  margin-bottom: 0.6rem;
  letter-spacing: 0.15em;
}

.result-title.win {
  color: var(--ink-green);
}

.result-title.lose {
  color: var(--ink-red);
}

.result-title.draw {
  color: var(--ink-blue);
}

.result-subtitle {
  font-size: 1.05rem;
  margin-bottom: 1.5rem;
  color: var(--ink-brown);
}

.result-detail {
  background: rgba(0, 0, 0, 0.03);
  border: 2px solid var(--telegram-border);
  padding: 1rem;
  margin-bottom: 1.5rem;
  text-align: left;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 0.9rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--ink-brown);
  flex-shrink: 0;
}

.detail-value {
  font-weight: 700;
  text-align: right;
}

.result-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.result-actions .btn {
  min-width: 150px;
}
</style>
