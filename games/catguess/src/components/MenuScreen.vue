<template>
  <div :class="['screen', { active: gameState.screen === 'menu' }]">
    <div class="card">
      <!-- Cat Header -->
      <div class="cat-header">
        <span class="cat-icon">🐱</span>
        <h1>喵喵猜词</h1>
        <div class="subtitle">
          喵语 Dixit
        </div>
      </div>

      <!-- Connection Status -->
      <div
        v-if="connectionStatus !== 'disconnected' && connectionMessage"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- Player Name -->
      <div class="input-group">
        <label>你的喵名</label>
        <input
          v-model="playerName"
          type="text"
          placeholder="输入你的喵名..."
          :disabled="gameState.connecting"
          @keyup.enter="handleCreate"
        >
      </div>

      <!-- Create Room -->
      <button
        class="btn btn-primary"
        style="width: 100%; margin-bottom: 20px;"
        :disabled="!playerName.trim() || gameState.connecting"
        @click="handleCreate"
      >
        {{ gameState.connecting ? '连接中...' : '创建房间（当房主）' }}
      </button>

      <!-- Divider -->
      <div class="divider">
        <span>或者</span>
      </div>

      <!-- Room Code Input -->
      <div class="input-group">
        <label>房间号</label>
        <input
          v-model="roomCode"
          type="text"
          placeholder="输入6位房间号"
          maxlength="6"
          :disabled="gameState.connecting"
          @input="roomCode = $event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)"
          @keyup.enter="handleJoin"
        >
      </div>

      <!-- Join Room -->
      <button
        class="btn btn-secondary"
        style="width: 100%;"
        :disabled="!playerName.trim() || !roomCode || roomCode.length !== 6 || gameState.connecting"
        @click="handleJoin"
      >
        {{ gameState.connecting ? '连接中...' : '加入房间' }}
      </button>

      <!-- Reconnect Section -->
      <div
        v-if="hasRestoreableState()"
        style="margin-top: 20px; text-align: center;"
      >
        <div class="divider">
          <span>或者</span>
        </div>
        <button
          class="btn btn-success btn-sm"
          style="width: 100%;"
          :disabled="gameState.connecting"
          @click="handleRestore"
        >
          {{ gameState.connecting ? '连接中...' : '重新连接' }}
        </button>
      </div>

      <!-- 诊断条：菜单页底部，点开看完整 -->
      <DiagnosticsPanel
        :diagnostics="gameState.diagnostics"
        variant="compact"
        style="margin-top: 16px;"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { gameState, createRoom, joinRoom, restoreFromCache, reconnectRoom, hasRestoreableState } from '../stores/gameStore'
import { showToast } from './ToastNotification.vue'
import { sanitizePlayerName, sanitizeRoomCode } from '../services/sanitize'
import DiagnosticsPanel from './DiagnosticsPanel.vue'

const playerName = ref(gameState.playerName || '')
const roomCode = ref('')

const connectionStatus = computed(() => gameState.connectionStatus)
const connectionMessage = computed(() => gameState.connectionMessage)

async function handleCreate() {
  const { value: name, error } = sanitizePlayerName(playerName.value)
  if (error) {
    showToast(error, 'warning')
    return
  }
  if (!name) {
    showToast('请输入你的喵名', 'warning')
    return
  }
  try {
    await createRoom(name)
  } catch (err) {
    showToast(err.message || '创建房间失败', 'error')
  }
}

async function handleJoin() {
  const { value: name, error: nameError } = sanitizePlayerName(playerName.value)
  if (nameError) {
    showToast(nameError, 'warning')
    return
  }
  if (!name) {
    showToast('请输入你的喵名', 'warning')
    return
  }
  const { value: code, error: codeError } = sanitizeRoomCode(roomCode.value)
  if (codeError) {
    showToast(codeError, 'warning')
    return
  }
  if (!code) {
    showToast('请输入房间号', 'warning')
    return
  }
  try {
    await joinRoom(name, code)
  } catch (err) {
    showToast(err.message || '加入房间失败', 'error')
  }
}

async function handleRestore() {
  // 先把缓存里的房间/玩家信息恢复到内存，再真正重建 P2P 连接。
  // 只调 restoreFromCache 会让界面"假活着"——状态有了但没有任何连接。
  if (!restoreFromCache()) {
    showToast('没有可恢复的对局', 'warning')
    return
  }
  const ok = await reconnectRoom()
  if (!ok) {
    showToast('重连失败，请检查网络或重新加入房间', 'error')
    // 回到菜单，让用户可以重试或重新加入
    gameState.screen = 'menu'
  }
}
</script>
