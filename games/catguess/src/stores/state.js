// ── Reactive Game State（服务器权威 / WebSocket）────────────────────────────
// catguess store 接线：state + network + cache 由共享工厂 createGameStore 生成，
// 本文件只声明本游戏的房间镜像结构与屏幕推导。
// 权威状态全部来自服务器 STATE 下发；客户端不再本地推进游戏逻辑。

import { createGameStore } from '../../../../src/shared/store/createGameStore';
import { ref } from 'vue';

const agentInvite = ref(null);
import { showToast } from '../../../../src/shared/components/ToastNotification.vue';
import { GAME_PHASES } from '../services/gameEngine';
import { createLogger } from '../services/logger';

const store = createGameStore({
  gameId: 'catguess',
  logger: createLogger('Catguess:Network'),
  onAgentInvite: invite => { agentInvite.value = invite },
  onError: ({ message }) => {
    if (message) showToast(message, 'warning');
  },
  cacheKey: 'catguess_state_cache',
  stateFields: ['playerId', 'playerName', 'roomCode', 'isHost', 'screen', 'connectionStatus'],
  roomFields: ['players', 'phase', 'status', 'gameState', 'disconnectedPlayers', 'savedPhase', 'savedStorytellerId'],
  createEmptyRoom,
  applyRoom,
  syncScreenToPhase
});

export const {
  gameState,
  getRoom,
  setRoom,
  setConnectionStatus,
  updateLocalState,
  resetLocalState,
  RECONNECT_METADATA,
  connectCreate,
  connectJoin,
  reconnectNetwork,
  sendIntent,
  requestAgentInvite,
  leaveNetwork,
  cleanupNetwork,
  restoreFromCache,
  hasRestoreableState,
  clearCache,
  flushCache
} = store;

export { agentInvite };

// ── 本游戏特有部分 ──────────────────────────────────────────────────────────

function createEmptyRoom() {
  return {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  };
}

// 把服务器房间镜像进 state.room。
// 非 SCORING/ENDED 阶段隐藏 secret 标记，避免提前暴露谜底。
function applyRoom(state, room) {
  state.room = {
    players: (room.players || []).map(p => ({ ...p })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      round: room.gameState.round || 0,
      storytellerId: room.gameState.storytellerId || null,
      clue: room.gameState.clue || '',
      submittedCards: room.gameState.submittedCards ? [...room.gameState.submittedCards] : [],
      shuffledCards: sanitizeShuffledCardsForClient(room.gameState, room.phase),
      votes: room.gameState.votes ? [...room.gameState.votes] : [],
      roundScores: room.gameState.roundScores ? { ...room.gameState.roundScores } : {},
      scores: room.gameState.scores ? { ...room.gameState.scores } : {},
      roundHistory: room.gameState.roundHistory ? [...room.gameState.roundHistory] : [],
      winner: room.gameState.winner || null,
      secretCardId: room.gameState.secretCardId != null ? room.gameState.secretCardId : null
    } : createEmptyRoom().gameState,
    hostId: room.hostId || null,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
    savedPhase: room.savedPhase || null,
    savedStorytellerId: room.savedStorytellerId || null
  };
}

function sanitizeShuffledCardsForClient(gameStateObj, phase) {
  if (!gameStateObj.shuffledCards) return [];

  if (phase === GAME_PHASES.SCORING || phase === GAME_PHASES.ENDED) {
    return [...gameStateObj.shuffledCards];
  }

  return gameStateObj.shuffledCards.map(card => ({
    id: card.id,
    word: card.word,
    submitterId: card.submitterId
  }));
}

function syncScreenToPhase(state, room) {
  if (room.status === GAME_PHASES.PLAYING && state.screen === 'lobby') {
    state.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && state.screen !== 'result') {
    state.screen = 'result';
  }
}
