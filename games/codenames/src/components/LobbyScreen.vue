<template>
  <div class="screen active">
    <div class="card">
      <div
        class="telegram-header"
        style="margin-bottom: 1.5rem;"
      >
        <div class="telegram-icon">
          T
        </div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1rem; font-weight: 700;">
            BRIEFING ROOM
          </div>
          <div class="morse-decoration">
            -... .-. .. . ..-. .. -. --.
          </div>
        </div>
        <div class="telegram-icon">
          R
        </div>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h2 style="margin: 0;">作战室</h2>
        <button class="rules-btn" @click="showRules = true" title="游戏规则">
          📖
        </button>
      </div>
      
      <div class="room-code">
        {{ gameState.roomCode }}
      </div>
      
      <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter); font-size: 0.9rem;">
        分享任务编号给其他特工
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
        <span class="count-badge">{{ onlinePlayerCount }}/4</span>
        <span class="count-label">特工在线</span>
      </div>

      <!-- 所有玩家列表（不按队伍分组） -->
      <div class="all-players-list">
        <div class="section-title">
          任务成员
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
          <div class="player-number">
            {{ index + 1 }}
          </div>
          <div class="player-info">
            <span class="player-name">{{ player.name }}</span>
            <span
              v-if="player.id === gameState.playerId"
              class="you-badge"
            >你</span>
            <span
              v-if="player.isHost"
              class="host-badge"
            >队长</span>
            <span
              v-if="!player.isOnline"
              class="offline-badge"
            >断线</span>
          </div>
          <div class="player-status">
            <span
              v-if="player.isOnline"
              class="status-online"
            >在线</span>
            <span
              v-else
              class="status-offline"
            >离线</span>
          </div>
        </div>
      </div>

      <div class="players-grid">
        <div class="team-card white">
          <div class="team-title">
            白队
          </div>
          <div
            v-if="getTeamPlayers('white').length === 0"
            style="color: rgba(0,0,0,0.3); text-align: center; padding: 1rem; font-family: var(--typewriter);"
          >
            等待特工加入...
          </div>
          <div
            v-for="player in getTeamPlayers('white')"
            :key="player.id"
            class="player-item"
            :class="{ you: player.id === gameState.playerId, offline: !player.isOnline }"
          >
            <span class="player-name">{{ player.name }}</span>
            <span
              v-if="!player.isOnline"
              class="offline-badge"
            >断线</span>
          </div>
        </div>

        <div class="team-card black">
          <div class="team-title">
            黑队
          </div>
          <div
            v-if="getTeamPlayers('black').length === 0"
            style="color: rgba(0,0,0,0.3); text-align: center; padding: 1rem; font-family: var(--typewriter);"
          >
            等待特工加入...
          </div>
          <div
            v-for="player in getTeamPlayers('black')"
            :key="player.id"
            class="player-item"
            :class="{ you: player.id === gameState.playerId, offline: !player.isOnline }"
          >
            <span class="player-name">{{ player.name }}</span>
            <span
              v-if="!player.isOnline"
              class="offline-badge"
            >断线</span>
          </div>
        </div>
      </div>

      <div class="waiting-text">
        <template v-if="!gameState.isHost">
          等待队长开始任务...
        </template>
        <template v-else-if="gameState.room.players.length < 4">
          等待其他特工加入... ({{ gameState.room.players.length }}/4)
        </template>
        <template v-else>
          准备就绪！点击开始任务
        </template>
      </div>

      <div
        class="btn-group"
        style="margin-top: 1.5rem;"
      >
        <button 
          class="btn btn-primary" 
          :disabled="!gameState.isHost || gameState.room.players.length < 4"
          @click="handleStart"
        >
          开始任务
        </button>
        <button
          class="btn btn-danger"
          @click="handleLeave"
        >
          撤离
        </button>
      </div>
      
      <div
        class="morse-decoration"
        style="margin-top: 1.5rem;"
      >
        .-- .- .. - .. -. --. / ..-. --- .-. / --- .--. . .-. .- - .. --- -. ...
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
        <h2 class="rules-title">📡 截码战</h2>
        <p class="rules-subtitle">游戏规则简介</p>

        <div class="rules-section">
          <h3>🎯 目标</h3>
          <p>先获得 <strong>3 分</strong> 的队伍获胜。</p>
        </div>

        <div class="rules-section">
          <h3>👥 队伍</h3>
          <p>4 名玩家分为 <strong>白队</strong> 和 <strong>黑队</strong>，每队 2 人。每回合每队各有一名 <strong>情报官</strong>（加密方）和一名 <strong>特工</strong>（解码方），密码轮换。</p>
        </div>

        <div class="rules-section">
          <h3>🔄 回合流程</h3>
          <ol class="rules-list">
            <li><strong>加密阶段：</strong>情报官看到 4 位数字密码，给出 <strong>3 个线索</strong> 帮助队友破译</li>
            <li><strong>解码阶段：</strong>队友根据线索猜密码；对方同时尝试 <strong>拦截</strong> 密码</li>
            <li><strong>结算阶段：</strong>公布结果，双方根据解码/拦截情况得分</li>
          </ol>
        </div>

        <div class="rules-section">
          <h3>📊 计分规则</h3>
          <ul class="rules-list">
            <li>密码全部猜对 → 解码方 <strong>+1 分</strong></li>
            <li>拦截方同样猜对 → 拦截方 <strong>+1 分</strong></li>
            <li>拦截方猜对且解码方未猜对 → 拦截方 <strong>+2 分</strong></li>
          </ul>
        </div>

        <div class="rules-section">
          <h3>📝 线索规则</h3>
          <ul class="rules-list">
            <li>线索不能包含数字、拼音、谐音或字数暗示</li>
            <li>尽量给出有区分度的线索，让队友能锁定正确数字</li>
            <li>对方也在监听你的线索，注意保密性！</li>
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
import { ref, computed } from 'vue';
import { gameState, handleStartGame, leaveRoom } from '../stores/gameStore';

const showRules = ref(false)

function getTeamPlayers(team) {
  if (!gameState.room.players) return [];
  return gameState.room.players.filter(p => p.team === team);
}

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
  font-family: var(--typewriter);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink-black);
}

.count-label {
  font-family: var(--typewriter);
  font-size: 0.8rem;
  color: var(--ink-brown);
}

.all-players-list {
  margin-bottom: 1.5rem;
  border: 2px solid var(--telegram-border);
  padding: 1rem;
}

.section-title {
  font-family: var(--typewriter);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-brown);
  margin-bottom: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.player-row:last-child {
  border-bottom: none;
}

.player-row.you {
  background: rgba(46, 74, 98, 0.1);
}

.player-row.offline {
  opacity: 0.6;
}

.player-number {
  width: 24px;
  height: 24px;
  background: var(--ink-black);
  color: var(--paper-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--typewriter);
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.player-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-name {
  font-family: var(--typewriter);
  font-size: 0.9rem;
}

.you-badge, .host-badge, .offline-badge {
  font-family: var(--typewriter);
  font-size: 0.6rem;
  padding: 0.15rem 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.you-badge {
  background: var(--ink-blue);
  color: var(--paper-bg);
}

.host-badge {
  background: var(--ink-black);
  color: var(--paper-bg);
}

.offline-badge {
  background: var(--ink-red);
  color: var(--paper-bg);
}

.player-status {
  font-family: var(--typewriter);
  font-size: 0.7rem;
}

.status-online {
  color: var(--ink-green);
}

.status-offline {
  color: var(--ink-red);
}

.player-item.offline {
  opacity: 0.6;
}

.player-item.offline .player-name {
  text-decoration: line-through;
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
  font-family: var(--typewriter);
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
  font-family: var(--typewriter);
  font-size: 22px;
  font-weight: 700;
  color: var(--ink-black);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.rules-subtitle {
  font-family: var(--typewriter);
  font-size: 13px;
  color: var(--ink-brown);
  margin-bottom: 20px;
}

.rules-section {
  margin-bottom: 16px;
}

.rules-section h3 {
  font-family: var(--typewriter);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-black);
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}

.rules-section p {
  font-family: var(--typewriter);
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-black);
}

.rules-list {
  margin: 0;
  padding-left: 20px;
}

.rules-list li {
  font-family: var(--typewriter);
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-black);
  margin-bottom: 2px;
}

.rules-got-it {
  margin-top: 8px;
  width: 100%;
}

.rules-btn {
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  font-family: var(--typewriter);
  font-size: 16px;
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
</style>