<template>
  <div :class="['screen', { active: gameState.screen === 'lobby' }]">
    <div class="card">
      <!-- Cat Header -->
      <div class="cat-header">
        <span class="cat-icon">🐱</span>
        <h1>喵喵猜词</h1>
        <div class="subtitle">等待玩家加入...</div>
      </div>

      <!-- Room Code -->
      <div class="room-code">
        {{ gameState.roomCode }}
      </div>

      <p style="text-align: center; margin-bottom: 16px; font-size: 14px; color: var(--cat-text-light);">
        分享房间号给其他小伙伴
      </p>

      <!-- Connection Status -->
      <div
        v-if="connectionMessage"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- Player List -->
      <div class="player-list">
        <div class="section-title">
          玩家列表（{{ onlinePlayerCount }}/6）
        </div>
        <div
          v-for="player in allPlayers"
          :key="player.id"
          class="player-row"
          :class="{
            you: player.id === gameState.playerId,
            offline: !player.isOnline
          }"
        >
          <span class="player-name">{{ player.name }}</span>
          <span
            v-if="player.id === gameState.playerId"
            class="badge badge-you"
          >你</span>
          <span
            v-if="player.isHost"
            class="badge badge-host"
          >房主</span>
          <span
            v-if="!player.isOnline"
            class="badge badge-offline"
          >离线</span>
        </div>
      </div>

      <!-- Waiting / Start -->
      <div v-if="gameState.isHost" class="waiting-text" style="margin-bottom: 12px;">
        <template v-if="onlinePlayerCount < 3">
          等待更多玩家加入...（至少3人）
        </template>
        <template v-else>
          喵！准备就绪，可以开始游戏啦！
        </template>
      </div>
      <div v-else class="waiting-text" style="margin-bottom: 12px;">
        等待房主开始游戏...
      </div>

      <!-- Action Buttons -->
      <div class="btn-group">
        <button
          v-if="gameState.isHost"
          class="btn btn-primary"
          :disabled="onlinePlayerCount < 3"
          @click="handleStart"
        >
          开始游戏
        </button>
        <button
          class="btn btn-danger"
          @click="handleLeave"
        >
          离开房间
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { gameState, handleStartGame, leaveRoom } from '../stores/gameStore'

const allPlayers = computed(() => gameState.room.players || [])

const onlinePlayers = computed(() => gameState.room.players?.filter(p => p.isOnline) || [])

const onlinePlayerCount = computed(() => onlinePlayers.value.length)

const connectionStatus = computed(() => gameState.connectionStatus)
const connectionMessage = computed(() => gameState.connectionMessage)

async function handleStart() {
  try {
    await handleStartGame()
  } catch {
    // Error handling would be via gameState.error or showToast
  }
}

async function handleLeave() {
  try {
    await leaveRoom()
  } catch {
    // Error handling
  }
}
</script>
