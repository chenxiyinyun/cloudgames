<template>
  <div class="screen active">
    <div class="card">
      <div class="menu-header">
        <span class="header-stone black" />
        <div>
          <div class="header-title">
            GOMOKU
          </div>
          <div class="header-subtitle">
            五 子 连 珠 · 双 人 对 弈
          </div>
        </div>
        <span class="header-stone white" />
      </div>

      <h1>五子棋</h1>
      <p class="subtitle">
        FIVE IN A ROW
      </p>

      <!-- 连接状态提示 -->
      <div
        v-if="connectionStatus !== 'disconnected' && connectionMessage"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <div class="input-group">
        <label>棋士代号</label>
        <input
          v-model="playerName"
          type="text"
          placeholder="输入你的代号"
          :disabled="isConnecting"
          @keyup.enter="handleCreate"
        >
      </div>

      <button
        class="btn btn-primary"
        style="width: 100%; margin-bottom: 1rem;"
        :disabled="isConnecting"
        @click="handleCreate"
      >
        <span>{{ isConnecting ? '连接中...' : '创建房间' }}</span>
      </button>

      <div class="divider">
        <span>或</span>
      </div>

      <div class="input-group">
        <label>房间号</label>
        <input
          v-model="roomCode"
          type="text"
          placeholder="输入房间号"
          :disabled="isConnecting"
          @keyup.enter="handleJoin"
        >
      </div>

      <button
        class="btn btn-secondary"
        style="width: 100%;"
        :disabled="isConnecting"
        @click="handleJoin"
      >
        <span>{{ isConnecting ? '连接中...' : '加入对局' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { createRoom, joinRoom, gameState } from '../stores/gameStore';
import { showToast } from '../../../../src/shared/components/ToastNotification.vue';
import { sanitizePlayerName, sanitizeRoomCode } from '../services/sanitize';

const playerName = ref('');
const roomCode = ref('');

const isConnecting = computed(() => gameState.connecting);
const connectionStatus = computed(() => gameState.connectionStatus);
const connectionMessage = computed(() => gameState.connectionMessage);

async function handleCreate() {
  const { value: name, error } = sanitizePlayerName(playerName.value);
  if (error) {
    showToast(error, 'warning');
    return;
  }
  if (!name) {
    showToast('请输入你的代号', 'warning');
    return;
  }
  await createRoom(name);
}

async function handleJoin() {
  const { value: name, error: nameError } = sanitizePlayerName(playerName.value);
  if (nameError) {
    showToast(nameError, 'warning');
    return;
  }
  if (!name) {
    showToast('请输入你的代号', 'warning');
    return;
  }
  const { value: code, error: codeError } = sanitizeRoomCode(roomCode.value);
  if (codeError) {
    showToast(codeError, 'warning');
    return;
  }
  if (!code) {
    showToast('请输入房间号', 'warning');
    return;
  }
  await joinRoom(name, code);
}
</script>

<style scoped>
.menu-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-stone {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.header-stone.black {
  background: radial-gradient(circle at 35% 30%, #555, #181818 70%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}

.header-stone.white {
  background: radial-gradient(circle at 35% 30%, #fff, #d8d4c8 75%);
  border: 1px solid #b8b4a8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.header-title {
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.25em;
  text-align: center;
}

.header-subtitle {
  font-size: 0.7rem;
  color: var(--ink-brown);
  letter-spacing: 0.2em;
  text-align: center;
}
</style>
