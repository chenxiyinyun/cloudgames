<template>
  <div id="catguess-app">
    <MenuScreen v-if="gameState.screen === 'menu'" />
    <LobbyScreen v-else-if="gameState.screen === 'lobby'" />
    <GameScreen v-else-if="gameState.screen === 'game' || gameState.screen === 'result'" />
    <ToastNotification />
    <ConnectionOverlay
      v-if="showConnectionOverlay"
      :status="gameState.connectionStatus"
      :message="gameState.connectionMessage"
      :attempt="reconnectAttempt"
      :max-attempts="MAX_RECONNECT_ATTEMPTS"
      :diagnostics="gameState.diagnostics"
      @retry="handleManualReconnect"
      @leave="handleForceLeave"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { gameState, reconnectRoom, leaveRoom, RECONNECT_METADATA } from './stores/gameStore'
import MenuScreen from './components/MenuScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ToastNotification from './components/ToastNotification.vue'
import ConnectionOverlay from './components/ConnectionOverlay.vue'

const MAX_RECONNECT_ATTEMPTS = RECONNECT_METADATA.MAX_ATTEMPTS
const reconnectAttempt = computed(() => RECONNECT_METADATA.attempt)
const showConnectionOverlay = computed(() =>
  gameState.screen !== 'menu' && gameState.connectionStatus !== 'connected'
)

async function handleManualReconnect() {
  try {
    await reconnectRoom()
  } catch {
    // Error already shown via toast
  }
}

async function handleForceLeave() {
  await leaveRoom()
}
</script>
