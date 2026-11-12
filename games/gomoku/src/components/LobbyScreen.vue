<template>
  <div class="screen active">
    <div class="card">
      <div class="lobby-header">
        <span class="header-stone black" />
        <div>
          <div class="header-title">
            WAITING ROOM
          </div>
          <div class="header-subtitle">
            对 局 准 备 中
          </div>
        </div>
        <span class="header-stone white" />
      </div>

      <div class="title-row">
        <h2>对局房间</h2>
        <button
          class="rules-btn"
          title="游戏规则"
          @click="showRules = true"
        >
          📖 规则
        </button>
      </div>

      <div class="room-code">
        {{ gameState.roomCode }}
      </div>

      <p class="room-tip">
        把房间号分享给对手，即可开始对弈
      </p>

      <!-- 连接状态提示 -->
      <div
        v-if="connectionMessage"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- 在线人数显示 -->
      <div class="player-count">
        <span class="count-badge">{{ onlinePlayerCount }}/2</span>
        <span class="count-label">棋手在线</span>
      </div>

      <!-- 玩家列表 -->
      <div class="players-list">
        <div class="section-title">
          对局成员
        </div>
        <div
          v-for="(player, index) in allPlayers"
          :key="player.id"
          class="player-row"
          :class="{
            you: player.id === gameState.playerId,
            offline: !player.isOnline,
            host: player.isHost
          }"
        >
          <span class="player-number">
            {{ index + 1 }}
          </span>
          <span class="player-name">{{ player.name }}</span>
          <ParticipantTag :type="player.type" />
          <span
            v-if="player.id === gameState.playerId"
            class="you-badge"
          >你</span>
          <span
            v-if="player.isHost"
            class="host-badge"
          >房主</span>
          <span
            v-if="!player.isOnline"
            class="offline-badge"
          >断线</span>
          <span
            v-if="player.isOnline"
            class="status-online"
          >在线</span>
          <span
            v-else
            class="status-offline"
          >离线</span>
        </div>
        <div
          v-if="allPlayers.length < 2"
          class="empty-slot"
        >
          <span class="stone-dot placeholder" />
          等待对手加入...
        </div>
      </div>

      <AgentAccessPanel
        ref="agentPanel"
        game-id="gomoku"
        :room-code="gameState.roomCode"
        :is-host="gameState.isHost"
        :connected="gameState.connected"
        :invite="agentInvite"
        :expanded="agentOpen"
        @toggle="agentOpen = $event"
        @request-invite="requestAgentInvite"
      />

      <div class="waiting-text">
        <template v-if="!gameState.isHost">
          等待房主开始对局...
        </template>
        <template v-else-if="gameState.room.players.length < 2">
          等待对手加入... ({{ gameState.room.players.length }}/2)
        </template>
        <template v-else>
          准备就绪！点击开始对局
        </template>
      </div>

      <div
        class="btn-group"
        style="margin-top: 1.5rem;"
      >
        <button
          class="btn btn-primary"
          :disabled="!gameState.isHost || gameState.room.players.length < 2"
          @click="handleStart"
        >
          <span>开始对局</span>
        </button>
        <button
          class="btn btn-danger"
          @click="handleLeave"
        >
          <span>离开</span>
        </button>
      </div>

      <!-- ─── Game Rules Modal ─── -->
      <div
        v-if="showRules"
        class="rules-overlay"
        @click.self="showRules = false"
      >
        <div class="rules-modal">
          <button
            class="rules-close"
            @click="showRules = false"
          >
            ✕
          </button>
          <h2 class="rules-title">
            ⚫ 五子棋
          </h2>
          <p class="rules-subtitle">
            游戏规则简介
          </p>

          <div class="rules-section">
            <h3>🎯 目标</h3>
            <p>在 15×15 的棋盘上，先将 <strong>5 颗棋子</strong>连成一线（横、竖、斜均可）者获胜。</p>
          </div>

          <div class="rules-section">
            <h3>⚫⚪ 先后手</h3>
            <p>房主执 <strong>黑棋</strong>先行，对手执 <strong>白棋</strong>。每局结束后再来一局会自动交换先后手。</p>
          </div>

          <div class="rules-section">
            <h3>⏱ 回合计时</h3>
            <p>每手限时 <strong>60 秒</strong>。超时未落子判负，对手直接获胜。</p>
          </div>

          <div class="rules-section">
            <h3>🏳 认输与结束</h3>
            <p>对局中可随时认输；房主也可以提前结束对局。棋盘下满仍无人获胜则为平局。</p>
          </div>

          <button
            class="btn btn-primary rules-got-it"
            @click="showRules = false"
          >
            <span>知道了！</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { gameState, handleStartGame, leaveRoom } from '../stores/gameStore';
import { agentInvite, requestAgentInvite } from '../stores/state'
import ParticipantTag from '../../../../src/shared/components/ParticipantTag.vue';
import AgentAccessPanel from '../../../../src/shared/components/AgentAccessPanel.vue';

const agentPanel = ref(null)
const agentOpen = ref(false)
const showRules = ref(false)
watch(agentInvite, invite => { if (invite) agentPanel.value?.onInvite(invite) });

const allPlayers = computed(() => {
  return gameState.room.players || [];
});

const onlinePlayerCount = computed(() => {
  return gameState.room.players?.filter(p => p.isOnline).length || 0;
});

const connectionStatus = computed(() => gameState.connectionStatus);
const connectionMessage = computed(() => gameState.connectionMessage);

async function handleStart() {
  handleStartGame();
}

async function handleLeave() {
  await leaveRoom();
}
</script>

<style scoped>
.lobby-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-stone {
  width: 30px;
  height: 30px;
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
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-align: center;
}

.header-subtitle {
  font-size: 0.7rem;
  color: var(--ink-brown);
  letter-spacing: 0.2em;
  text-align: center;
}

.room-tip {
  text-align: center;
  margin-bottom: 1rem;
  color: var(--ink-brown);
  font-size: 0.9rem;
}

.player-count {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.03);
  border: 2px solid var(--telegram-border);
}

.count-badge {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--ink-black);
}

.count-label {
  font-size: 0.85rem;
  color: var(--ink-brown);
}

.players-list {
  margin-bottom: 1.5rem;
  border: 2px solid var(--telegram-border);
  padding: 1rem;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-brown);
  margin-bottom: 0.8rem;
  letter-spacing: 0.1em;
}

.player-number {
  width: 24px;
  height: 24px;
  background: var(--ink-black);
  color: var(--paper-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.empty-slot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.6rem;
  color: rgba(44, 36, 22, 0.45);
  font-size: 0.9rem;
}

.stone-dot.placeholder {
  background: transparent;
  border: 2px dashed rgba(44, 36, 22, 0.3);
  box-shadow: none;
}

.waiting-text {
  text-align: center;
  color: var(--ink-brown);
  margin-top: 1rem;
  animation: blink 1.5s ease-in-out infinite;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.title-row h2 {
  margin: 0;
}

.rules-btn {
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 12px;
  color: var(--ink-black);
  transition: all 0.2s;
  flex-shrink: 0;
}

.rules-btn:hover {
  background: var(--ink-black);
  color: var(--paper-bg);
  border-color: var(--ink-black);
}

/* ─── Rules Modal ─── */
.rules-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.rules-modal {
  background: var(--paper-bg);
  border: 3px solid var(--telegram-border);
  padding: 32px 28px;
  max-width: 480px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.rules-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: 2px solid var(--telegram-border);
  font-size: 16px;
  cursor: pointer;
  color: var(--ink-brown);
  padding: 2px 8px;
  transition: all 0.2s;
}

.rules-close:hover {
  background: var(--ink-red);
  color: var(--paper-bg);
  border-color: var(--ink-red);
}

.rules-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--ink-black);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.rules-subtitle {
  font-size: 13px;
  color: var(--ink-brown);
  margin-bottom: 20px;
}

.rules-section {
  margin-bottom: 16px;
}

.rules-section h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-black);
  margin-bottom: 6px;
}

.rules-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-black);
}

.rules-got-it {
  margin-top: 8px;
  width: 100%;
}
</style>
