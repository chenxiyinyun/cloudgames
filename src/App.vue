<template>
  <div id="app">
    <MenuScreen v-if="gameState.screen === 'menu'" />
    <LobbyScreen v-else-if="gameState.screen === 'lobby'" />
    <GameScreen v-else-if="gameState.screen === 'game'" />
    <ResultScreen v-else-if="gameState.screen === 'result'" />
  </div>
</template>

<script setup>
import MenuScreen from './components/MenuScreen.vue';
import LobbyScreen from './components/LobbyScreen.vue';
import GameScreen from './components/GameScreen.vue';
import ResultScreen from './components/ResultScreen.vue';
import { gameState } from './stores/gameStore';
</script>

<style>
#app {
  min-height: 100vh;
}
</style>
