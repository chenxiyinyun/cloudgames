<template>
  <div :class="['screen', { active: gameState.screen === 'lobby' }]">
    <div class="card">
      <!-- Cat Header -->
      <div class="cat-header">
        <span class="cat-icon">🐱</span>
        <h1>喵喵猜词</h1>
        <button class="rules-btn" @click="showRules = true" title="游戏规则">
          📖
        </button>
      </div>
      <div class="subtitle">
        等待玩家加入...
      </div>

      <!-- Room Code -->
      <div class="room-code">
        {{ gameState.roomCode }}
      </div>

      <p style="text-align: center; margin-bottom: 16px; font-size: 14px; color: var(--cat-text-light);">
        分享房间号给其他小伙伴
      </p>

      <!-- Connection Status -->
      <div
        v-if="connectionMessage"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- Player List -->
      <div class="player-list">
        <div class="section-title">
          玩家列表（{{ onlinePlayerCount }}/6）
        </div>
        <div
          v-for="player in allPlayers"
          :key="player.id"
          class="player-row"
          :class="{
            you: player.id === gameState.playerId,
            offline: !player.isOnline
          }"
        >
          <span class="player-name">{{ player.name }}</span>
          <span
            v-if="player.id === gameState.playerId"
            class="badge badge-you"
          >你</span>
          <span
            v-if="player.isHost"
            class="badge badge-host"
          >房主</span>
          <span
            v-if="!player.isOnline"
            class="badge badge-offline"
          >离线</span>
        </div>
      </div>

      <!-- Waiting / Start -->
      <div
        v-if="gameState.isHost"
        class="waiting-text"
        style="margin-bottom: 12px;"
      >
        <template v-if="onlinePlayerCount < 3">
          等待更多玩家加入...（至少3人）
        </template>
        <template v-else>
          喵！准备就绪，可以开始游戏啦！
        </template>
      </div>
      <div
        v-else
        class="waiting-text"
        style="margin-bottom: 12px;"
      >
        等待房主开始游戏...
      </div>

      <!-- Action Buttons -->
      <div class="btn-group">
        <button
          v-if="gameState.isHost"
          class="btn btn-primary"
          :disabled="onlinePlayerCount < 3"
          @click="handleStart"
        >
          开始游戏
        </button>
        <button
          class="btn btn-danger"
          @click="handleLeave"
        >
          离开房间
        </button>
      </div>
    </div>

    <!-- ─── Game Rules Modal ─── -->
    <div
      v-if="showRules"
      class="rules-overlay"
      @click.self="showRules = false"
    >
      <div class="rules-modal">
        <button class="rules-close" @click="showRules = false">✕</button>
        <h2 class="rules-title">🐱 喵喵猜词</h2>
        <p class="rules-subtitle">游戏规则简介</p>

        <div class="rules-section">
          <h3>🎯 目标</h3>
          <p>先获得 <strong>{{ targetWinScore }} 分</strong> 的玩家获胜（人数越多目标越高）！</p>
        </div>

        <div class="rules-section">
          <h3>🔄 游戏流程</h3>
          <ol class="rules-list">
            <li>每轮有一位 <strong>讲故事者</strong>，其余玩家猜词</li>
            <li>讲故事者从手牌中选一张牌，写一个 <strong>1–20 字</strong> 的提示</li>
            <li>其他玩家从自己手牌中选一张<strong>最符合提示</strong>的牌提交</li>
            <li>所有牌混合展示，大家投票猜哪张是讲故事者的牌</li>
          </ol>
        </div>

        <div class="rules-section">
          <h3>📊 计分规则</h3>
          <ul class="rules-list">
            <li>猜对的玩家 <strong>+3 分</strong></li>
            <li>讲故事者：<strong>不是全部猜对也不是全猜错</strong>则 <strong>+3 分</strong></li>
            <li>如果所有人都猜对了 → 提示太直白，讲故事者 <strong>0 分</strong>，所有投票者 <strong>+2 分</strong></li>
            <li>如果全都猜错了 → 提示太难，讲故事者 <strong>0 分</strong>，所有投票者 <strong>+2 分</strong></li>
          </ul>
        </div>

        <div class="rules-section">
          <h3>💡 提示</h3>
          <ul class="rules-list">
            <li>提示不要太直白（容易被猜对），也不要太难（没人猜对）</li>
            <li>投票时选你<strong>认为最像讲故事者</strong>的那张牌</li>
          </ul>
        </div>

        <button class="btn btn-primary rules-got-it" @click="showRules = false">
          知道了！
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { gameState, handleStartGame, leaveRoom } from '../stores/gameStore'
import { getTargetScore } from '../services/gameEngine'

const showRules = ref(false)

const targetWinScore = computed(() => {
  if (!gameState.room || !gameState.room.players) return 30
  return getTargetScore(gameState.room)
})

const allPlayers = computed(() => gameState.room.players || [])

const onlinePlayers = computed(() => gameState.room.players?.filter(p => p.isOnline) || [])

const onlinePlayerCount = computed(() => onlinePlayers.value.length)

const connectionStatus = computed(() => gameState.connectionStatus)
const connectionMessage = computed(() => gameState.connectionMessage)

async function handleStart() {
  try {
    await handleStartGame()
  } catch {
    // Error handling would be via gameState.error or showToast
  }
}

async function handleLeave() {
  try {
    await leaveRoom()
  } catch {
    // Error handling
  }
}
</script>

<style scoped>
/* ─── Rules Modal ─── */

.rules-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.rules-modal {
  background: white;
  border: 3px solid var(--cat-border);
  border-radius: 20px;
  padding: 32px 28px;
  max-width: 460px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.rules-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--cat-text-light);
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.rules-close:hover {
  background: var(--cat-border);
  color: var(--cat-text);
}

.rules-title {
  font-family: var(--cat-font);
  font-size: 24px;
  color: var(--cat-accent);
  margin-bottom: 4px;
}

.rules-subtitle {
  font-size: 14px;
  color: var(--cat-text-light);
  margin-bottom: 20px;
}

.rules-section {
  margin-bottom: 16px;
}

.rules-section h3 {
  font-family: var(--cat-serif);
  font-size: 16px;
  font-weight: 700;
  color: var(--cat-text);
  margin-bottom: 6px;
}

.rules-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--cat-text);
}

.rules-list {
  margin: 0;
  padding-left: 20px;
}

.rules-list li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--cat-text);
  margin-bottom: 2px;
}

.rules-got-it {
  margin-top: 8px;
  width: 100%;
}

.rules-btn {
  background: none;
  border: 2px solid var(--cat-border);
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.25s;
  line-height: 1;
  margin-left: auto;
  flex-shrink: 0;
}

.rules-btn:hover {
  border-color: var(--cat-blue);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--cat-shadow);
}
</style>
