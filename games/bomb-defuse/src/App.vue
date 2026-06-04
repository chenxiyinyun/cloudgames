<template>
  <div id="bomb-defuse-app">
    <MenuScreen
      v-if="screen === 'menu'"
      @create-room="handleCreateRoom"
      @join-room="handleJoinRoom"
    />
    <LobbyScreen
      v-else-if="screen === 'lobby'"
      :room-code="roomCode"
      :players="players"
      :is-host="isHost"
      @start-game="handleStartGame"
      @leave-room="handleLeaveRoom"
    />
    <GameScreen
      v-else-if="screen === 'game'"
      :room-code="roomCode"
      :players="players"
      :current-role="currentRole"
      @solve="handleSolve"
      @explode="handleExplode"
      @leave-room="handleLeaveRoom"
    />
    <ResultScreen
      v-else
      :result="result"
      :room-code="roomCode"
      @restart="handleRestart"
      @back-to-menu="handleLeaveRoom"
    />
    <ToastNotification :message="toastMessage" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import MenuScreen from './components/MenuScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import ToastNotification from './components/ToastNotification.vue'

const screen = ref('menu')
const roomCode = ref('')
const isHost = ref(false)
const result = ref('solved')
const toastMessage = ref('')
const players = ref([])

const currentRole = computed(() => {
  const currentPlayer = players.value.find(player => player.isCurrent)
  return currentPlayer?.role || 'defuser'
})

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

function showToast(message) {
  toastMessage.value = message
  window.setTimeout(() => {
    if (toastMessage.value === message) {
      toastMessage.value = ''
    }
  }, 2200)
}

function handleCreateRoom(playerName) {
  const name = playerName.trim() || '拆弹员'
  roomCode.value = createRoomCode()
  isHost.value = true
  players.value = [
    { id: 'local-host', name, role: 'defuser', isHost: true, isOnline: true, isCurrent: true },
    { id: 'waiting-expert', name: '等待专家加入', role: 'expert', isHost: false, isOnline: false, isCurrent: false }
  ]
  screen.value = 'lobby'
  showToast('任务房间已创建')
}

function handleJoinRoom({ playerName, code }) {
  const name = playerName.trim() || '说明书专家'
  roomCode.value = code.trim().toUpperCase() || createRoomCode()
  isHost.value = false
  players.value = [
    { id: 'remote-host', name: '房主', role: 'defuser', isHost: true, isOnline: true, isCurrent: false },
    { id: 'local-guest', name, role: 'expert', isHost: false, isOnline: true, isCurrent: true }
  ]
  screen.value = 'lobby'
  showToast('已加入任务房间')
}

function handleStartGame() {
  players.value = players.value.map(player => ({
    ...player,
    isOnline: true,
    name: player.name === '等待专家加入' ? '说明书专家' : player.name
  }))
  screen.value = 'game'
}

function handleSolve() {
  result.value = 'solved'
  screen.value = 'result'
}

function handleExplode() {
  result.value = 'exploded'
  screen.value = 'result'
}

function handleRestart() {
  screen.value = 'lobby'
}

function handleLeaveRoom() {
  screen.value = 'menu'
  roomCode.value = ''
  players.value = []
  isHost.value = false
}
</script>
