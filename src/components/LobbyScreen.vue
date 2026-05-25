<template>
  <div class="screen active">
    <div class="card">
      <h2>等待室</h2>
      
      <div class="room-code">{{ gameState.roomCode }}</div>
      
      <p style="text-align: center; margin-bottom: 1rem;">
        分享房间号给其他玩家
      </p>

      <div class="players-grid">
        <div class="team-card white">
          <div class="team-title">⚪ 白队</div>
          <div v-if="getTeamPlayers('white').length === 0" style="color: rgba(255,255,255,0.3); text-align: center; padding: 1rem;">
            等待玩家加入...
          </div>
          <div v-for="player in getTeamPlayers('white')" :key="player.id" class="player-item" :class="{ you: player.id === gameState.playerId }">
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.isHost" class="role-tag">房主</span>
            <span v-else-if="player.isEncryptor" class="role-tag">情报官</span>
          </div>
        </div>

        <div class="team-card black">
          <div class="team-title">⚫ 黑队</div>
          <div v-if="getTeamPlayers('black').length === 0" style="color: rgba(255,255,255,0.3); text-align: center; padding: 1rem;">
            等待玩家加入...
          </div>
          <div v-for="player in getTeamPlayers('black')" :key="player.id" class="player-item" :class="{ you: player.id === gameState.playerId }">
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.isHost" class="role-tag">房主</span>
            <span v-else-if="player.isEncryptor" class="role-tag">情报官</span>
          </div>
        </div>
      </div>

      <div class="waiting-text">
        <template v-if="!gameState.isHost">
          等待房主开始游戏...
        </template>
        <template v-else-if="gameState.room.players.length < 4">
          等待其他玩家加入... ({{ gameState.room.players.length }}/4)
        </template>
        <template v-else>
          准备就绪！点击开始游戏
        </template>
      </div>

      <div class="btn-group" style="margin-top: 1.5rem;">
        <button 
          class="btn btn-primary" 
          @click="handleStart"
          :disabled="!gameState.isHost || gameState.room.players.length < 4"
        >
          开始游戏
        </button>
        <button class="btn btn-danger" @click="handleLeave">
          离开房间
        </button>
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
