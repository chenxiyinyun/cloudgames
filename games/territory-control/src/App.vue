<template>
  <MenuScreen
    v-if="gameState.screen === 'menu'"
    :connecting="gameState.connecting"
    :error="gameState.error"
    :has-restoreable-state="hasRestoreable"
    @create-room="createRoom"
    @join-room="joinRoom"
    @restore-room="handleRestoreRoom"
  />
  <LobbyScreen
    v-else-if="gameState.screen === 'lobby'"
    :room="gameState.room"
    :room-code="gameState.roomCode || ''"
    :is-host="gameState.isHost"
    :error="gameState.error"
    @set-map-size="handleSetMapSize"
    @start-game="handleStartGame"
    @leave-room="leaveRoom"
  />
  <GameScreen
    v-else-if="gameState.screen === 'game'"
    :room="gameState.room"
    :room-code="gameState.roomCode || ''"
    :player-id="gameState.playerId"
    :is-host="gameState.isHost"
    :error="gameState.error"
    @dispatch="handleDispatch"
    @end-game="handleEndGame"
    @leave-room="leaveRoom"
  />
  <ResultScreen
    v-else
    :room="gameState.room"
    :player-id="gameState.playerId"
    :is-host="gameState.isHost"
    @restart="handleRestartGame"
    @leave-room="leaveRoom"
  />
</template>

<script setup>
import { computed } from 'vue'
import {
  createRoom,
  gameState,
  handleDispatch,
  handleEndGame,
  handleRestartGame,
  handleSetMapSize,
  handleStartGame,
  hasRestoreableState,
  joinRoom,
  leaveRoom,
  reconnectRoom,
  restoreFromCache
} from './stores/gameStore'
import GameScreen from './components/GameScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import MenuScreen from './components/MenuScreen.vue'
import ResultScreen from './components/ResultScreen.vue'

// reactive: 当 gameState.screen 切到 menu 时,这个 computed 重新评估 —
// 如果用户刚刚点"返回"清掉缓存,按钮会自动消失
const hasRestoreable = computed(() => {
  return gameState.screen === 'menu' && hasRestoreableState()
})

async function handleRestoreRoom() {
  if (!restoreFromCache()) return
  await reconnectRoom()
}
</script>
