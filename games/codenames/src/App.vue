<template>
  <div id="app">
    <ToastNotification />
    <!-- 断线恢复提示弹窗 -->
    <div
      v-if="showReconnectDialog"
      class="reconnect-overlay"
    >
      <div class="reconnect-dialog">
        <div
          class="telegram-header"
          style="margin-bottom: 1rem;"
        >
          <div class="telegram-icon">
            !
          </div>
          <div>
            <div
              style="font-family: var(--typewriter); font-size: 0.9rem; font-weight: 700;"
            >
              CONNECTION LOST
            </div>
            <div class="morse-decoration">
              -.-. --- -. -. . -.-. - .. --- -. / .-.. --- ... -
            </div>
          </div>
          <div class="telegram-icon">
            !
          </div>
        </div>
        <h3 style="text-align: center; margin-bottom: 1rem;">
          连接中断
        </h3>
        <p style="text-align: center; margin-bottom: 1.5rem; font-family: var(--typewriter); font-size: 0.85rem;">
          检测到之前的游戏会话，是否重新连接？
        </p>
        <div class="reconnect-info">
          <div class="info-row">
            <span class="info-label">任务编号:</span>
            <span class="info-value">{{ cachedRoomCode }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">特工代号:</span>
            <span class="info-value">{{ cachedPlayerName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">身份:</span>
            <span class="info-value">{{ cachedIsHost ? '队长' : '队员' }}</span>
          </div>
        </div>
        <div
          class="btn-group"
          style="margin-top: 1.5rem;"
        >
          <button
            class="btn btn-primary"
            :disabled="isReconnecting"
            @click="handleReconnect"
          >
            {{ isReconnecting ? '连接中...' : '重新连接' }}
          </button>
          <button
            class="btn btn-secondary"
            :disabled="isReconnecting"
            @click="handleNewGame"
          >
            新游戏
          </button>
        </div>
      </div>
    </div>

    <MenuScreen v-if="gameState.screen === 'menu' && !showReconnectDialog" />
    <LobbyScreen v-else-if="gameState.screen === 'lobby'" />
    <GameScreen v-else-if="gameState.screen === 'game'" />
    <ResultScreen v-else-if="gameState.screen === 'result'" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import MenuScreen from './components/MenuScreen.vue';
import LobbyScreen from './components/LobbyScreen.vue';
import GameScreen from './components/GameScreen.vue';
import ResultScreen from './components/ResultScreen.vue';
import { gameState, restoreFromCache, reconnectRoom, hasRestoreableState } from './stores/gameStore';
import { createLogger } from './services/logger';
import ToastNotification, { showToast } from './components/ToastNotification.vue';

const log = createLogger('App')

const showReconnectDialog = ref(false);
const isReconnecting = ref(false);
const cachedRoomCode = ref('');
const cachedPlayerName = ref('');
const cachedIsHost = ref(false);

const onWindowError = (event) => {
  log.error('Unhandled JS error:', event.error)
  gameState.error = event.error instanceof Error ? event.error.message : String(event.error)
  return false
}

const onUnhandledRejection = (event) => {
  log.error('Unhandled promise rejection:', event.reason)
  gameState.error = event.reason instanceof Error ? event.reason.message : String(event.reason)
}

window.addEventListener('error', onWindowError)
window.addEventListener('unhandledrejection', onUnhandledRejection)

onMounted(() => {
  // 检查是否有可恢复的状态
  if (hasRestoreableState()) {
    // 先恢复状态到内存，但不自动连接
    const cache = JSON.parse(localStorage.getItem('codenames_state_cache'));
    if (cache && cache.state) {
      cachedRoomCode.value = cache.state.roomCode || '';
      cachedPlayerName.value = cache.state.playerName || '';
      cachedIsHost.value = cache.state.isHost || false;
      showReconnectDialog.value = true;
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('error', onWindowError)
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
})

async function handleReconnect() {
  isReconnecting.value = true;

  // 恢复状态
  restoreFromCache();

  // 尝试重连
  const success = await reconnectRoom();

  if (success) {
    showReconnectDialog.value = false;
  } else {
    showToast('重连失败，请检查网络或创建新游戏', 'error');
  }

  isReconnecting.value = false;
}

function handleNewGame() {
  // 清除缓存，开始新游戏
  localStorage.removeItem('codenames_state_cache');
  showReconnectDialog.value = false;
  gameState.screen = 'menu';
}
</script>

<style>
.reconnect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.reconnect-dialog {
  background: var(--paper-bg);
  border: 3px solid var(--ink-black);
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.2);
}

.reconnect-info {
  border: 2px solid var(--telegram-border);
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-family: var(--typewriter);
  font-size: 0.8rem;
  color: var(--ink-brown);
}

.info-value {
  font-family: var(--typewriter);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink-black);
}

.btn-group {
  display: flex;
  gap: 1rem;
}

.btn-group .btn {
  flex: 1;
}
</style>
