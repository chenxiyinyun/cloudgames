<template>
  <div class="screen active">
    <div class="card">
      <div class="telegram-header" style="margin-bottom: 1.5rem;">
        <div class="telegram-icon">T</div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1rem; font-weight: 700;">BRIEFING ROOM</div>
          <div class="morse-decoration">-... .-. .. . ..-. .. -. --.</div>
        </div>
        <div class="telegram-icon">R</div>
      </div>
      
      <h2>作战室</h2>
      
      <div class="room-code">{{ gameState.roomCode }}</div>
      
      <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter); font-size: 0.9rem;">
        分享任务编号给其他特工
      </p>

      <div class="players-grid">
        <div class="team-card white">
          <div class="team-title">白队</div>
          <div v-if="getTeamPlayers('white').length === 0" style="color: rgba(0,0,0,0.3); text-align: center; padding: 1rem; font-family: var(--typewriter);">
            等待特工加入...
          </div>
          <div v-for="player in getTeamPlayers('white')" :key="player.id" class="player-item" :class="{ you: player.id === gameState.playerId }">
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.isHost" class="role-tag">队长</span>
          </div>
        </div>

        <div class="team-card black">
          <div class="team-title">黑队</div>
          <div v-if="getTeamPlayers('black').length === 0" style="color: rgba(0,0,0,0.3); text-align: center; padding: 1rem; font-family: var(--typewriter);">
            等待特工加入...
          </div>
          <div v-for="player in getTeamPlayers('black')" :key="player.id" class="player-item" :class="{ you: player.id === gameState.playerId }">
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.isHost" class="role-tag">队长</span>
          </div>
        </div>
      </div>

      <div class="waiting-text">
        <template v-if="!gameState.isHost">
          等待队长开始任务...
        </template>
        <template v-else-if="gameState.room.players.length < 4">
          等待其他特工加入... ({{ gameState.room.players.length }}/4)
        </template>
        <template v-else>
          准备就绪！点击开始任务
        </template>
      </div>

      <div class="btn-group" style="margin-top: 1.5rem;">
        <button 
          class="btn btn-primary" 
          @click="handleStart"
          :disabled="!gameState.isHost || gameState.room.players.length < 4"
        >
          开始任务
        </button>
        <button class="btn btn-danger" @click="handleLeave">
          撤离
        </button>
      </div>
      
      <div class="morse-decoration" style="margin-top: 1.5rem;">
        .-- .- .. - .. -. --. / ..-. --- .-. / --- .--. . .-. .- - .. --- -. ...
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { gameState, handleStartGame, leaveRoom } from '../stores/gameStore';

function getTeamPlayers(team) {
  if (!gameState.room.players) return [];
  return gameState.room.players.filter(p => p.team === team);
}

async function handleStart() {
  handleStartGame();
}

async function handleLeave() {
  await leaveRoom();
}
</script>