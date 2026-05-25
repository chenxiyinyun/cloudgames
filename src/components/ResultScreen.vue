<template>
  <div class="screen active">
    <div class="card">
      <div class="result-panel">
        <div class="result-title" :class="isWinner ? 'win' : 'lose'">
          {{ isWinner ? '🎉 胜利！' : '😢 失败...' }}
        </div>
        <div class="result-subtitle">
          {{ winnerTeam === 'white' ? '⚪ 白队' : '⚫ 黑队' }} 获得了胜利！
        </div>
        <div class="result-details">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
            <div>
              <h4 style="color: var(--white-team);">⚪ 白队</h4>
              <p>拦截: {{ whiteInterception }}/2</p>
              <p>失误: {{ whiteMiscommunication }}/2</p>
            </div>
            <div>
              <h4 style="color: #999;">⚫ 黑队</h4>
              <p>拦截: {{ blackInterception }}/2</p>
              <p>失误: {{ blackMiscommunication }}/2</p>
            </div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" @click="onPlayAgain" :disabled="!gameState.isHost">
            {{ gameState.isHost ? '再来一局' : '等待房主重新开始' }}
          </button>
          <button class="btn btn-secondary" @click="onBackToMenu">返回主页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { gameState, handlePlayAgain, leaveRoom } from '../stores/gameStore';

const whiteInterception = computed(() => gameState.room.teams?.white?.interceptTokens || 0);
const whiteMiscommunication = computed(() => gameState.room.teams?.white?.missTokens || 0);
const blackInterception = computed(() => gameState.room.teams?.black?.interceptTokens || 0);
const blackMiscommunication = computed(() => gameState.room.teams?.black?.missTokens || 0);

const winnerTeam = computed(() => {
  return gameState.room.winner || 'white';
});

const isWinner = computed(() => {
  return winnerTeam.value === gameState.team;
});

async function onPlayAgain() {
  if (gameState.isHost) {
    handlePlayAgain();
  }
}

async function onBackToMenu() {
  await leaveRoom();
}
</script>
