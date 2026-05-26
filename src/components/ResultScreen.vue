<template>
  <div class="screen active">
    <div class="card">
      <div class="telegram-header" style="margin-bottom: 1.5rem;">
        <div class="telegram-icon">T</div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1rem; font-weight: 700;">MISSION REPORT</div>
          <div class="morse-decoration">-- .. ... ... .. --- -. / .-. . .--. --- .-. -</div>
        </div>
        <div class="telegram-icon">R</div>
      </div>
      
      <div class="result-panel">
        <div class="result-title" :class="isWinner ? 'win' : 'lose'">
          {{ isWinner ? '任务成功' : '任务失败' }}
        </div>
        <div class="result-subtitle">
          {{ winnerTeam === 'white' ? '白队' : '黑队' }} 获得胜利
        </div>
        <div class="stamp" style="margin: 1rem auto; display: inline-block;">
          {{ isWinner ? 'APPROVED' : 'REJECTED' }}
        </div>
        <div class="result-details">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
            <div>
              <h4 style="color: var(--ink-black); font-family: var(--typewriter);">白队</h4>
              <p style="font-family: var(--typewriter);">拦截: {{ whiteInterception }}/2</p>
              <p style="font-family: var(--typewriter);">失误: {{ whiteMiscommunication }}/2</p>
            </div>
            <div>
              <h4 style="color: var(--ink-brown); font-family: var(--typewriter);">黑队</h4>
              <p style="font-family: var(--typewriter);">拦截: {{ blackInterception }}/2</p>
              <p style="font-family: var(--typewriter);">失误: {{ blackMiscommunication }}/2</p>
            </div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" @click="onPlayAgain" :disabled="!gameState.isHost">
            {{ gameState.isHost ? '新的任务' : '等待队长' }}
          </button>
          <button class="btn btn-secondary" @click="onBackToMenu">返回基地</button>
        </div>
      </div>
      
      <div class="morse-decoration" style="margin-top: 1.5rem;">
        . -. -.. / --- ..-. / -- .. ... ... .. --- -.
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { gameState, handlePlayAgain, leaveRoom } from '../stores/gameStore';

const whiteInterception = computed(() => gameState.room.teams?.white?.interceptionTokens || 0);
const whiteMiscommunication = computed(() => gameState.room.teams?.white?.miscommunicationTokens || 0);
const blackInterception = computed(() => gameState.room.teams?.black?.interceptionTokens || 0);
const blackMiscommunication = computed(() => gameState.room.teams?.black?.miscommunicationTokens || 0);

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