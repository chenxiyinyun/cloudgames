<template>
  <div id="bomb-defuse-app">
    <MenuScreen
      v-if="gameState.screen === 'menu'"
      :connecting="gameState.connecting"
      :error="gameState.error"
      :has-restoreable-state="hasRestoreableState()"
      @create-room="handleCreateRoom"
      @join-room="handleJoinRoom"
      @restore-room="handleRestoreRoom"
    />
    <LobbyScreen
      v-else-if="gameState.screen === 'lobby'"
      :room-code="gameState.roomCode || ''"
      :players="gameState.room.players"
      :player-id="gameState.playerId"
      :is-host="gameState.isHost"
      :connected="gameState.connected"
      @start-game="handleStartGame"
      @swap-roles="handleSwapRoles"
      @leave-room="handleLeaveRoom"
    />
    <GameScreen
      v-else-if="gameState.screen === 'game'"
      :room="gameState.room"
      :room-code="gameState.roomCode || ''"
      :player-id="gameState.playerId"
      :is-host="gameState.isHost"
      @module-action="handleModuleAction"
      @end-game="handleEndGame"
      @leave-room="handleLeaveRoom"
    />
    <ResultScreen
      v-else
      :room="gameState.room"
      :room-code="gameState.roomCode || ''"
      :is-host="gameState.isHost"
      @restart="handleRestart"
      @back-to-menu="handleLeaveRoom"
    />

    <ToastNotification :message="gameState.error || gameState.connectionMessage" />
    <DiagnosticsPanel
      v-if="gameState.screen !== 'menu'"
      :diagnostics="gameState.diagnostics"
    />
    <ConnectionOverlay
      v-if="showConnectionOverlay"
      :status="gameState.connectionStatus"
      :message="gameState.connectionMessage"
      :attempt="RECONNECT_METADATA.attempt"
      :max-attempts="RECONNECT_METADATA.MAX_ATTEMPTS"
      @retry="handleReconnect"
      @leave="handleLeaveRoom"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  RECONNECT_METADATA,
  createRoom,
  gameState,
  handleAssignRoles,
  handleEndGame as endGame,
  handleRestartGame,
  handleStartGame as startGame,
  handleSubmitModuleAction,
  hasRestoreableState,
  joinRoom,
  leaveRoom,
  reconnectRoom,
  restoreFromCache
} from './stores/gameStore'
import ConnectionOverlay from './components/ConnectionOverlay.vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import GameScreen from './components/GameScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import MenuScreen from './components/MenuScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import ToastNotification from './components/ToastNotification.vue'

const showConnectionOverlay = computed(() =>
  gameState.screen !== 'menu' &&
  ['connecting', 'reconnecting', 'error'].includes(gameState.connectionStatus)
)

async function handleCreateRoom(playerName) {
  await createRoom(playerName)
}

async function handleJoinRoom(payload) {
  await joinRoom(payload.playerName, payload.code)
}

async function handleRestoreRoom() {
  if (restoreFromCache()) {
    await reconnectRoom()
  }
}

function handleStartGame() {
  startGame()
}

function handleSwapRoles() {
  const players = gameState.room.players
  if (players.length !== 2) return
  const roleByPlayerId = {}
  players.forEach(p => {
    roleByPlayerId[p.id] = p.role === 'defuser' ? 'expert' : 'defuser'
  })
  handleAssignRoles(roleByPlayerId)
}

function handleModuleAction({ moduleId, action }) {
  handleSubmitModuleAction(moduleId, action)
}

function handleRestart() {
  handleRestartGame()
}

function handleEndGame() {
  endGame()
}

async function handleReconnect() {
  await reconnectRoom()
}

async function handleLeaveRoom() {
  await leaveRoom()
}
</script>
