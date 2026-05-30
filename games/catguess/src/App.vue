<template>
  <div id="catguess-app">
    <MenuScreen v-if="gameState.screen === 'menu'" />
    <LobbyScreen v-else-if="gameState.screen === 'lobby'" />
    <GameScreen v-else-if="gameState.screen === 'game' || gameState.screen === 'result'" />
    <ToastNotification />
  </div>
</template>

<script setup>
import { gameState } from './stores/gameStore'
import MenuScreen from './components/MenuScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ToastNotification from './components/ToastNotification.vue'
</script>
