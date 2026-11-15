<template>
  <div class="players-bar">
    <div
      class="player-card"
      :class="{ active: isBlackTurn, offline: blackPlayer && !blackPlayer.isOnline }"
    >
      <span class="stone-dot black" />
      <div class="player-meta">
        <div class="player-name">
          {{ blackPlayer?.name || '等待加入' }}
          <ParticipantTag
            v-if="blackPlayer"
            :type="blackPlayer.type"
            compact
          />
        </div>
        <div class="player-role">
          黑棋
        </div>
      </div>
      <span
        v-if="blackPlayer && !blackPlayer.isOnline"
        class="offline-badge"
      >断线</span>
    </div>

    <div class="status-center">
      <div class="turn-text">
        {{ turnText }}
      </div>
      <div
        class="countdown"
        :class="{ urgent: isUrgent }"
      >
        {{ countdownText }}
      </div>
      <div class="move-count">
        第 {{ moveCount }} 手
      </div>
    </div>

    <div
      class="player-card"
      :class="{ active: isWhiteTurn, offline: whitePlayer && !whitePlayer.isOnline }"
    >
      <span class="stone-dot white" />
      <div class="player-meta">
        <div class="player-name">
          {{ whitePlayer?.name || '等待加入' }}
          <ParticipantTag
            v-if="whitePlayer"
            :type="whitePlayer.type"
            compact
          />
        </div>
        <div class="player-role">
          白棋
        </div>
      </div>
      <span
        v-if="whitePlayer && !whitePlayer.isOnline"
        class="offline-badge"
      >断线</span>
    </div>
  </div>
</template>

<script setup>
import ParticipantTag from '../../../../src/shared/components/ParticipantTag.vue';

defineProps({
  blackPlayer: { type: Object, default: null },
  whitePlayer: { type: Object, default: null },
  isBlackTurn: { type: Boolean, default: false },
  isWhiteTurn: { type: Boolean, default: false },
  turnText: { type: String, default: '' },
  countdownText: { type: String, default: '--' },
  isUrgent: { type: Boolean, default: false },
  moveCount: { type: Number, default: 0 }
});
</script>

<style scoped>
.players-bar {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.player-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  padding: 0.8rem 1rem;
  transition: all 0.3s ease;
  min-width: 0;
}

.player-card.active {
  border-color: var(--ink-black);
  box-shadow: 0 0 0 3px rgba(44, 36, 22, 0.15);
}

.player-card.offline {
  opacity: 0.6;
}

.player-meta {
  min-width: 0;
}

.player-name {
  font-size: 0.95rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.player-role {
  font-size: 0.75rem;
  color: var(--ink-brown);
  margin-top: 0.2rem;
}

.status-center {
  min-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  padding: 0.8rem 1rem;
}

.turn-text {
  font-size: 0.95rem;
  font-weight: 700;
}

.countdown {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--ink-blue);
  font-variant-numeric: tabular-nums;
}

.countdown.urgent {
  color: var(--ink-red);
  animation: blink 1s ease-in-out infinite;
}

.move-count {
  font-size: 0.75rem;
  color: var(--ink-brown);
}

@media (max-width: 900px) {
  .players-bar {
    flex-wrap: wrap;
  }

  .player-card {
    flex: 1 1 40%;
  }

  .status-center {
    order: 3;
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
