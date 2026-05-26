<template>
  <div class="screen active">
    <div class="card">
      <div class="telegram-header" style="margin-bottom: 1.5rem;">
        <div class="telegram-icon">T</div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1rem; font-weight: 700;">TELEGRAPH</div>
          <div class="morse-decoration">- . .-.. . --. .-. .- .--.</div>
        </div>
        <div class="telegram-icon">M</div>
      </div>
      
      <h1>截码战</h1>
      <p class="subtitle">CODENAMES</p>
      
      <div class="morse-decoration" style="margin-bottom: 2rem;">
        -.-. --- -.. . -. .- -- . ...
      </div>

      <!-- 连接状态提示 -->
      <div v-if="connectionStatus !== 'disconnected' && connectionMessage" 
           class="connection-status" 
           :class="connectionStatus">
        {{ connectionMessage }}
      </div>

      <div class="input-group">
        <label>特工代号</label>
        <input 
          type="text" 
          v-model="playerName" 
          placeholder="输入你的代号"
          @keyup.enter="handleCreate"
          :disabled="isConnecting"
        />
      </div>

      <button class="btn btn-primary" @click="handleCreate" style="width: 100%; margin-bottom: 1rem;" :disabled="isConnecting">
        {{ isConnecting ? '连接中...' : '创建任务' }}
      </button>

      <div class="divider"><span>或</span></div>

      <div class="input-group">
        <label>任务编号</label>
        <input 
          type="text" 
          v-model="roomCode" 
          placeholder="输入任务编号"
          @keyup.enter="handleJoin"
          :disabled="isConnecting"
        />
      </div>

      <button class="btn btn-secondary" @click="handleJoin" style="width: 100%;" :disabled="isConnecting">
        {{ isConnecting ? '连接中...' : '加入任务' }}
      </button>
      
      <div class="morse-decoration" style="margin-top: 1.5rem;">
        .-- .- .-. / .. ... / .... . .-.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { createRoom, joinRoom, gameState } from '../stores/gameStore';
import { showToast } from './ToastNotification.vue';
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
    showToast('请输入任务编号', 'warning');
    return;
  }
  await joinRoom(name, code);
}
</script>

<style scoped>
.connection-status {
  padding: 0.8rem;
  margin-bottom: 1rem;
  text-align: center;
  font-family: var(--typewriter);
  font-size: 0.85rem;
  border: 2px solid;
}

.connection-status.connecting {
  background: rgba(46, 74, 98, 0.1);
  border-color: var(--ink-blue);
  color: var(--ink-blue);
}

.connection-status.connected {
  background: rgba(61, 92, 58, 0.1);
  border-color: var(--ink-green);
  color: var(--ink-green);
}

.connection-status.error {
  background: rgba(139, 38, 53, 0.1);
  border-color: var(--ink-red);
  color: var(--ink-red);
}

.connection-status.reconnecting {
  background: rgba(107, 68, 35, 0.1);
  border-color: var(--ink-brown);
  color: var(--ink-brown);
  animation: blink 1.5s ease-in-out infinite;
}
</style>