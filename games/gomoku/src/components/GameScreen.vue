<template>
  <div class="screen active">
    <div class="game-container">
      <PlayersBar
        :black-player="blackPlayer"
        :white-player="whitePlayer"
        :is-black-turn="isBlackTurn"
        :is-white-turn="isWhiteTurn"
        :turn-text="turnText"
        :countdown-text="countdownText"
        :is-urgent="isUrgent"
        :move-count="moveCount"
      />

      <!-- 连接状态提示 -->
      <div
        v-if="connectionMessage && connectionStatus !== 'connected'"
        class="connection-status"
        :class="connectionStatus"
      >
        {{ connectionMessage }}
      </div>

      <!-- 断线提示和重连按钮 -->
      <div
        v-if="!isOnline"
        class="disconnect-alert"
      >
        <div class="disconnect-title">
          连接中断
        </div>
        <p class="disconnect-message">
          你与对局服务器失去联系，重连后可继续对弈
        </p>
        <button
          class="btn btn-primary"
          :disabled="isReconnecting"
          @click="handleReconnect"
        >
          <span>{{ isReconnecting ? '重新连接中...' : '重新连接' }}</span>
        </button>
      </div>

      <!-- 终局横幅：展示赛果并引导查看结算（棋盘保持可见，可看到获胜连线） -->
      <div
        v-if="isEnded"
        class="end-banner"
      >
        <span
          class="end-banner-title"
          :class="endBannerClass"
        >{{ endBannerTitle }}</span>
        <span class="end-banner-sub">{{ endBannerSub }}</span>
        <button
          class="btn btn-primary"
          @click="showResult"
        >
          <span>查看结算</span>
        </button>
      </div>

      <div class="game-main">
        <div class="board-wrap">
          <GomokuBoard
            :board="room.board"
            :can-place="canPlace"
            :my-role="gameState.role"
            :last-move="lastMove"
            :winning-line="room.winningLine || []"
            @place="onPlaceStone"
          />
        </div>

        <div class="side-panel">
          <div class="panel-actions">
            <button
              class="btn btn-danger"
              :disabled="!canResign"
              @click="onResignClick"
            >
              <span>{{ confirmingResign ? '确认认输？' : '认输' }}</span>
            </button>
            <button
              v-if="gameState.isHost"
              class="btn btn-secondary"
              @click="onEndGame"
            >
              <span>结束对局</span>
            </button>
            <button
              class="btn btn-secondary"
              @click="openRules"
            >
              <span>规则</span>
            </button>
          </div>

          <MoveHistoryPanel
            :moves="moveHistory"
            :players="players"
          />
        </div>
      </div>

      <RulesModal
        :visible="showRules"
        @close="closeRules"
      />
    </div>
  </div>
</template>

<script setup>
import { gameState } from '../stores/gameStore';
import { useGomokuView } from '../composables/useGomokuView';
import PlayersBar from './PlayersBar.vue';
import GomokuBoard from './GomokuBoard.vue';
import MoveHistoryPanel from './MoveHistoryPanel.vue';
import RulesModal from './RulesModal.vue';

const {
  room,
  players,
  blackPlayer,
  whitePlayer,
  moveHistory,
  moveCount,
  lastMove,
  isBlackTurn,
  isWhiteTurn,
  connectionStatus,
  connectionMessage,
  isOnline,
  canPlace,
  canResign,
  isUrgent,
  countdownText,
  turnText,
  isEnded,
  endBannerTitle,
  endBannerClass,
  endBannerSub,
  showRules,
  confirmingResign,
  isReconnecting,
  showResult,
  openRules,
  closeRules,
  onPlaceStone,
  onResignClick,
  onEndGame,
  handleReconnect
} = useGomokuView();
</script>

<style scoped>
.game-container {
  width: 100%;
  max-width: 1060px;
  margin: 0 auto;
}

/* ─── 主区域布局 ─── */
.game-main {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.board-wrap {
  flex: 1;
  min-width: 0;
  max-width: 640px;
}

/* ─── 侧栏 ─── */
.side-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.panel-actions .btn {
  width: 100%;
}

/* ─── 终局横幅 ─── */
.end-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--paper-bg);
  border: 3px solid var(--ink-black);
  padding: 0.9rem 1.2rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.end-banner-title {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.end-banner-title.win {
  color: var(--ink-green);
}

.end-banner-title.lose {
  color: var(--ink-red);
}

.end-banner-title.draw {
  color: var(--ink-blue);
}

.end-banner-sub {
  font-size: 0.9rem;
  color: var(--ink-brown);
}

/* ─── 断线提示 ─── */
.disconnect-alert {
  background: var(--paper-bg);
  border: 3px solid var(--ink-red);
  padding: 1.5rem;
  margin-bottom: 1.2rem;
  text-align: center;
}

.disconnect-title {
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--ink-red);
  margin-bottom: 0.6rem;
}

.disconnect-message {
  color: var(--ink-brown);
  margin-bottom: 1rem;
}

/* ─── 响应式 ─── */
@media (max-width: 900px) {
  .game-main {
    flex-direction: column;
    align-items: center;
  }

  .board-wrap {
    width: 100%;
    max-width: 560px;
  }

  .side-panel {
    width: 100%;
    max-width: 560px;
  }
}
</style>
