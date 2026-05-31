<template>
  <div :class="['screen', { active: gameState.screen === 'game' || gameState.screen === 'result' }]">
    <div class="game-container">
      <!-- Game Header -->
      <div class="game-header">
        <div class="round-info">
          🐱 第 {{ gameState.room.gameState.round }} 轮
        </div>
        <div class="score-info">
          <template
            v-for="(p, i) in topPlayers"
            :key="p.id"
          >
            <span v-if="i > 0"> · </span>
            <span>{{ p.name }}: {{ totalScore(p.id) }}</span>
          </template>
        </div>
      </div>

      <!-- Phase Label -->
      <div class="phase-label">
        {{ phaseLabel }}
      </div>

      <!-- Decorative Timer Bar -->
      <div class="timer-bar">
        <div class="timer-fill" />
      </div>

      <!-- ─── Phase: Storyteller Picking ─── -->
      <div
        v-if="phase === 'storyteller_picking'"
        class="storyteller-section"
      >
        <div class="role-badge">
          🐱 {{ isStoryteller ? '你是讲故事者' : '等待讲故事者...' }}
        </div>

        <template v-if="isStoryteller">
          <p class="instruction">
            👆 选一张牌并写一个提示（1–20 字）
          </p>

          <div class="hand-grid">
            <div
              v-for="(word, index) in (me?.hand || [])"
              :key="index"
              :class="['hand-card', { selected: selectedCardIndex === index }]"
              @click="selectedCardIndex = index"
            >
              <div class="word-text">
                {{ word }}
              </div>
              <div class="card-index">
                #{{ index + 1 }}
              </div>
            </div>
          </div>

          <div class="clue-input-area">
            <label>✏️ 你的提示</label>
            <textarea
              v-model="clueText"
              placeholder="写一个 1–20 字的提示…"
              maxlength="20"
              rows="2"
              @input="onClueInput"
            />
            <div class="char-count">
              {{ clueText.length }}/20
            </div>
          </div>

          <button
            class="btn btn-primary"
            :disabled="selectedCardIndex === -1 || !clueText.trim()"
            @click="submitStorySelection"
          >
            ✅ 确认选择
          </button>
        </template>

        <template v-else>
          <p class="waiting-text">
            🐱 讲故事者正在构思中<span class="waiting-dots" />
          </p>
        </template>
      </div>

      <!-- ─── Phase: Others Picking ─── -->
      <div
        v-else-if="phase === 'others_picking'"
        class="storyteller-section"
      >
        <div class="role-badge">
          {{ isStoryteller ? '🐱 你是讲故事者' : '🐱 猜词时间' }}
        </div>

        <div class="clue-bubble">
          <strong>{{ storytellerName }} 的提示：</strong>
          <span class="clue-text">「{{ gameState.room.gameState.clue }}」</span>
        </div>

        <template v-if="!isStoryteller">
          <template v-if="!hasSubmitted">
            <p class="instruction">
              👆 选一张最符合提示的牌
            </p>

            <div class="hand-grid">
              <div
                v-for="(word, index) in (me?.hand || [])"
                :key="index"
                :class="['hand-card', { selected: selectedCardIndex === index }]"
                @click="selectedCardIndex = index"
              >
                <div class="word-text">
                  {{ word }}
                </div>
                <div class="card-index">
                  #{{ index + 1 }}
                </div>
              </div>
            </div>

            <button
              class="btn btn-primary"
              :disabled="selectedCardIndex === -1"
              @click="submitCard"
            >
              📤 提交选择
            </button>
          </template>

          <div
            v-else
            class="submitted-badge"
          >
            ✓ 已提交
          </div>
        </template>

        <template v-else>
          <p class="waiting-text">
            等待其他玩家选牌<span class="waiting-dots" />
          </p>
        </template>
      </div>

      <!-- ─── Phase: Revealing / Voting ─── -->
      <div
        v-else-if="phase === 'revealing'"
        class="storyteller-section"
      >
        <div class="role-badge">
          🐱 投票阶段
        </div>

        <div class="clue-bubble">
          <strong>提示：</strong>
          <span class="clue-text">「{{ gameState.room.gameState.clue }}」</span>
        </div>

        <template v-if="!isStoryteller">
          <p
            v-if="!hasVoted"
            class="instruction"
          >
            👆 选出讲故事者的牌
          </p>

          <div class="reveal-grid">
            <div
              v-for="card in gameState.room.gameState.shuffledCards"
              :key="card.id"
              :class="['reveal-card', { selected: votedCardId === card.id }]"
              @click="selectVoteCard(card.id)"
            >
              <div class="card-letter">
                {{ getCardLetter(card.id) }}
              </div>
              <div class="word-text">
                {{ card.word }}
              </div>
            </div>
          </div>

          <div
            v-if="!hasVoted"
            class="btn-group"
            style="justify-content: center;"
          >
            <button
              class="btn btn-primary"
              :disabled="votedCardId === -1"
              @click="submitVote"
            >
              🗳️ 确认投票
            </button>
          </div>
          <div
            v-else
            class="submitted-badge"
          >
            ✓ 已投票
          </div>
        </template>

        <template v-else>
          <p class="waiting-text">
            等待其他玩家投票<span class="waiting-dots" />
          </p>
          <div class="reveal-grid">
            <div
              v-for="card in gameState.room.gameState.shuffledCards"
              :key="card.id"
              class="reveal-card"
            >
              <div class="card-letter">
                {{ getCardLetter(card.id) }}
              </div>
              <div class="word-text">
                {{ card.word }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ─── Phase: Scoring ─── -->
      <div
        v-else-if="phase === 'scoring'"
        class="storyteller-section"
      >
        <div class="role-badge">
          🐱 计分阶段
        </div>

        <div class="result-panel">
          <p class="instruction">
            <strong>{{ storytellerName }} 的提示：</strong>
            <span class="clue-text">「{{ gameState.room.gameState.clue }}」</span>
          </p>

          <div class="correct-count-badge">
            {{ correctCount }} / {{ totalVoters }} 人猜对了
            <template v-if="correctCount === totalVoters">
              （提示太直白啦 😿）
            </template>
            <template v-else-if="correctCount === 0">
              （提示太难了 😼）
            </template>
            <template v-else>
              （恰到好处 🎯）
            </template>
          </div>

          <div class="reveal-grid">
            <div
              v-for="card in gameState.room.gameState.shuffledCards"
              :key="card.id"
              :class="['reveal-card', {
                'is-secret': card.isSecret,
                selected: myVotedCardId === card.id
              }]"
            >
              <div class="card-letter">
                {{ getCardLetter(card.id) }}
              </div>
              <div class="word-text">
                {{ card.word }}
              </div>
              <div class="submitter-label">
                {{ getPlayerName(card.submitterId) }}
              </div>
              <div class="vote-count">
                {{ getVoteCount(card.id) }} 票
              </div>
              <div
                v-if="myVotedCardId === card.id"
                class="my-vote-tag"
              >
                {{ card.isSecret ? '✓ 猜对了' : '✗ 猜错了' }}
              </div>
            </div>
          </div>

          <div class="divider">
            <span>本局得分</span>
          </div>

          <div
            v-for="player in gameState.room.players"
            :key="player.id"
            class="round-result-row"
          >
            <span class="cat-emoji">
              {{ player.id === gameState.room.gameState.storytellerId ? '📖' : '🐱' }}
            </span>
            <span class="player-label">
              {{ player.name }}{{ player.id === gameState.playerId ? ' (你)' : '' }}
            </span>
            <span :class="['score-change', { zero: roundScore(player.id) === 0 }]">
              {{ roundScore(player.id) > 0 ? '+' + roundScore(player.id) : roundScore(player.id) }}
            </span>
          </div>

          <div class="divider">
            <span>总积分</span>
          </div>

          <table class="score-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>玩家</th>
                <th>本局</th>
                <th>总计</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
              >
                <td :class="['rank', rankClass(idx)]">
                  {{ idx + 1 }}
                </td>
                <td>{{ player.name }}{{ player.id === gameState.playerId ? ' (你)' : '' }}</td>
                <td :class="['score-change', { zero: roundScore(player.id) === 0 }]">
                  {{ roundScoreStr(player.id) }}
                </td>
                <td>{{ totalScore(player.id) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="btn-group">
            <button
              v-if="isHost"
              class="btn btn-success"
              @click="goNextRound"
            >
              ➡️ 下一轮
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Phase: Ended ─── -->
      <div
        v-else-if="phase === 'ended'"
        class="storyteller-section"
      >
        <div class="result-panel">
          <div class="result-title win">
            🏆 {{ winnerName }} 获胜!
          </div>

          <div class="divider">
            <span>最终排名</span>
          </div>

          <table class="score-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>玩家</th>
                <th>总计</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
              >
                <td :class="['rank', rankClass(idx)]">
                  {{ idx + 1 }}
                </td>
                <td>{{ player.name }}{{ player.id === gameState.playerId ? ' (你)' : '' }}</td>
                <td>{{ totalScore(player.id) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="btn-group">
            <button
              v-if="isHost"
              class="btn btn-success"
              @click="goNextRound"
            >
              🔄 再来一局
            </button>
            <button
              class="btn btn-secondary"
              @click="leaveRoom"
            >
              🚪 退出
            </button>
          </div>
        </div>
      </div>

      <!-- Leave Button (always visible outside ended phase) -->
      <div
        v-if="phase !== 'ended'"
        class="leave-section"
      >
        <button
          class="btn btn-secondary btn-sm"
          @click="leaveRoom"
        >
          🚪 退出
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  gameState,
  handleSubmitStorySelection,
  handleSubmitCard,
  handleSubmitVote,
  handleNextRound,
  leaveRoom,
  GAME_PHASES
} from '../stores/gameStore'
import { showToast } from './ToastNotification.vue'

// ─── Reactive State ───

/** Index of the currently selected hand card (-1 = none) */
const selectedCardIndex = ref(-1)

/** Storyteller's clue text */
const clueText = ref('')

/** Index of the card voted for during revealing (-1 = none) */
const votedCardId = ref(-1)

// ─── Computed Properties ───

const me = computed(() => {
  if (!gameState.room) return null
  return gameState.room.players.find(p => p.id === gameState.playerId) || null
})

const isStoryteller = computed(() =>
  gameState.room.gameState.storytellerId === gameState.playerId
)

const isHost = computed(() =>
  gameState.room.hostId === gameState.playerId
)

const phase = computed(() => gameState.room.phase)

const phaseLabel = computed(() => {
  switch (phase.value) {
    case GAME_PHASES.STORYTELLER_PICKING: return '📝 讲故事者选牌'
    case GAME_PHASES.OTHERS_PICKING:      return '🤔 猜词阶段'
    case GAME_PHASES.REVEALING:           return '🗳️ 投票阶段'
    case GAME_PHASES.SCORING:             return '📊 计分阶段'
    case GAME_PHASES.ENDED:               return '🏆 游戏结束'
    default:                              return ''
  }
})

/** Non-storyteller: has already submitted a card this round */
const hasSubmitted = computed(() => {
  if (isStoryteller.value) return false
  return gameState.room.gameState.submittedCards.some(
    sc => sc.playerId === gameState.playerId
  )
})

/** Non-storyteller: has already voted this round */
const hasVoted = computed(() => {
  if (isStoryteller.value) return false
  return gameState.room.gameState.votes.some(
    v => v.voterId === gameState.playerId
  )
})

/** The card I voted for (derived from game state, for scoring display) */
const myVotedCardId = computed(() => {
  const vote = gameState.room.gameState.votes.find(
    v => v.voterId === gameState.playerId
  )
  return vote ? vote.votedCardId : -1
})

/** Name of the storyteller for the current round */
const storytellerName = computed(() => {
  const stId = gameState.room.gameState.storytellerId
  const st = gameState.room.players.find(p => p.id === stId)
  return st ? st.name : '未知'
})

/** Name of the winner (ended phase) */
const winnerName = computed(() => {
  const wid = gameState.room.gameState.winner
  if (!wid) return ''
  const w = gameState.room.players.find(p => p.id === wid)
  return w ? w.name : '未知'
})

/** Top 2 players by cumulative score (for score-info in header) */
const topPlayers = computed(() => {
  return [...gameState.room.players]
    .filter(p => p.isOnline)
    .sort((a, b) => (gameState.room.gameState.scores[b.id] || 0) - (gameState.room.gameState.scores[a.id] || 0))
    .slice(0, 2)
})

/** All online players sorted by total score descending */
const sortedPlayers = computed(() => {
  return [...gameState.room.players]
    .filter(p => p.isOnline)
    .sort((a, b) => {
      const sa = gameState.room.gameState.scores[a.id] || 0
      const sb = gameState.room.gameState.scores[b.id] || 0
      if (sa !== sb) return sb - sa
      return a.order - b.order
    })
})

/** Number of votes that correctly identified the secret card */
const correctCount = computed(() => {
  const secret = gameState.room.gameState.shuffledCards.find(c => c.isSecret)
  if (!secret) return 0
  return gameState.room.gameState.votes.filter(v => v.votedCardId === secret.id).length
})

/** Total number of voters this round */
const totalVoters = computed(() => {
  return gameState.room.gameState.votes.length
})

// ─── Helper Functions ───

const roundScore = (playerId) => gameState.room.gameState.roundScores[playerId] || 0
const totalScore = (playerId) => gameState.room.gameState.scores[playerId] || 0

const roundScoreStr = (playerId) => {
  const s = roundScore(playerId)
  return s > 0 ? '+' + s : String(s)
}

const rankClass = (idx) => {
  if (idx === 0) return 'gold'
  if (idx === 1) return 'silver'
  if (idx === 2) return 'bronze'
  return ''
}

const getCardLetter = (id) => String.fromCharCode(65 + id)

const getPlayerName = (playerId) => {
  const p = gameState.room.players.find(x => x.id === playerId)
  return p ? p.name : '未知'
}

const getVoteCount = (cardId) => {
  return gameState.room.gameState.votes.filter(v => v.votedCardId === cardId).length
}

// ─── Event Handlers ───

/** Strip newlines from clue textarea */
const onClueInput = () => {
  clueText.value = clueText.value.replace(/\n/g, '')
}

/** Select a card to vote for (no toggle — always sets, never deselects) */
const selectVoteCard = (cardId) => {
  if (hasVoted.value) return
  votedCardId.value = cardId
}

/** Submit storyteller's card selection + clue */
const submitStorySelection = async () => {
  if (selectedCardIndex.value === -1) {
    showToast('请先选择一张牌', 'error')
    return
  }
  const trimmed = clueText.value.trim()
  if (!trimmed) {
    showToast('请写一个提示', 'error')
    return
  }
  if (trimmed.length < 1 || trimmed.length > 20) {
    showToast('提示长度需在 1–20 字之间', 'error')
    return
  }
  try {
    await handleSubmitStorySelection(selectedCardIndex.value, trimmed)
    // Phase will change to others_picking on success; watcher resets local state
  } catch (err) {
    showToast(err?.message || '提交失败，请重试', 'error')
  }
}

/** Submit a non-storyteller player's card selection */
const submitCard = async () => {
  if (selectedCardIndex.value === -1) {
    showToast('请先选择一张牌', 'error')
    return
  }
  try {
    await handleSubmitCard(selectedCardIndex.value)
    // hasSubmitted computed will reflect the new state
  } catch (err) {
    showToast(err?.message || '提交失败，请重试', 'error')
  }
}

/** Submit vote during revealing phase */
const submitVote = async () => {
  if (votedCardId.value === -1) {
    showToast('请先选择一张牌', 'error')
    return
  }
  try {
    await handleSubmitVote(votedCardId.value)
    // hasVoted computed will reflect the new state
  } catch (err) {
    showToast(err?.message || '投票失败，请重试', 'error')
  }
}

/** Advance to the next round (host only) */
const goNextRound = async () => {
  try {
    await handleNextRound()
  } catch (err) {
    showToast(err?.message || '操作失败，请重试', 'error')
  }
}

// ─── Watch: Reset local state on phase change ───

watch(phase, () => {
  selectedCardIndex.value = -1
  clueText.value = ''
  votedCardId.value = -1
})
</script>

<style scoped>
.clue-bubble {
  background: var(--cat-accent-light);
  border: 2px solid var(--cat-accent);
  border-radius: 16px;
  padding: 14px 18px;
  margin: 16px 0;
  text-align: center;
  font-size: 16px;
  color: var(--cat-text);
}

.clue-bubble .clue-text {
  font-family: var(--cat-serif);
  font-weight: 700;
  color: var(--cat-accent);
  font-size: 18px;
}

.char-count {
  text-align: right;
  font-size: 12px;
  color: var(--cat-text-light);
  margin-top: 4px;
}

.correct-count-badge {
  display: inline-block;
  padding: 6px 16px;
  background: var(--cat-green);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0;
}

.submitter-label {
  font-size: 11px;
  color: var(--cat-text-light);
  margin-top: 6px;
}

.my-vote-tag {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--cat-blue);
  color: white;
  white-space: nowrap;
}

.reveal-card.selected .my-vote-tag {
  background: var(--cat-blue);
}

.leave-section {
  text-align: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--cat-border);
}

@media (max-width: 600px) {
  .clue-bubble {
    font-size: 14px;
    padding: 10px 14px;
  }
  .clue-bubble .clue-text {
    font-size: 16px;
  }
}
</style>
