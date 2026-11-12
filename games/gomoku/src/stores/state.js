// ── Reactive Game State（服务器权威 / WebSocket）────────────────────────────
// gomoku store 接线：state + network + cache 由共享工厂 createGameStore 生成，
// 本文件只声明本游戏的房间镜像、玩家身份派生与屏幕推导。
// 五子棋没有隐藏信息：棋盘与回合对双方公开，无需按视角裁剪。

import { createGameStore } from '../../../../src/shared/store/createGameStore';
import { ref } from 'vue';

const agentInvite = ref(null);
import { showToast } from '../../../../src/shared/components/ToastNotification.vue';
import { GAME_PHASES, BOARD_SIZE, TURN_TIME_MS, createEmptyBoard } from '../services/gameEngine';
import { createLogger } from '../services/logger';

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const store = createGameStore({
  gameId: 'gomoku',
  logger: createLogger('Gomoku:Network'),
  onAgentInvite: invite => { agentInvite.value = invite },
  onError: ({ message }) => {
    if (message) showToast(message, 'warning');
  },
  cacheKey: 'gomoku_state_cache',
  stateFields: ['playerId', 'playerName', 'roomCode', 'isHost', 'role', 'screen', 'connectionStatus'],
  roomFields: [
    'players',
    'board',
    'currentTurn',
    'moveHistory',
    'winner',
    'winningLine',
    'endReason',
    'turnDeadline',
    'status',
    'phase',
    'disconnectedPlayers',
    'settings'
  ],
  createEmptyRoom,
  applyRoom,
  syncScreenToPhase,
  // gomoku 特有的玩家身份扩展字段
  extraState: {
    role: null
  },
  resetExtra(state) {
    state.role = null;
  }
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

// 房间本地状态初始值（gameState.room 与 cleanup 复用，避免重复定义漂移）
function createEmptyRoom() {
  return {
    players: [],
    board: createEmptyBoard(),
    currentTurn: null,
    moveHistory: [],
    winner: null,
    winningLine: null,
    endReason: null,
    turnDeadline: null,
    status: GAME_PHASES.WAITING,
    phase: GAME_PHASES.WAITING,
    disconnectedPlayers: [],
    settings: { boardSize: BOARD_SIZE, turnTimeMs: TURN_TIME_MS }
  };
}

function applyRoom(state, room) {
  // 玩家身份派生（黑/白）
  const player = room.players.find(p => p.id === state.playerId);
  state.role = player?.role || null;

  state.room = {
    players: room.players?.map(p => ({ ...p })) || [],
    board: room.board ? room.board.map(row => [...row]) : createEmptyBoard(),
    currentTurn: room.currentTurn ?? null,
    moveHistory: room.moveHistory ? deepClone(room.moveHistory) : [],
    winner: room.winner ?? null,
    winningLine: room.winningLine ? deepClone(room.winningLine) : null,
    endReason: room.endReason ?? null,
    turnDeadline: room.turnDeadline ?? null,
    status: room.status || GAME_PHASES.WAITING,
    phase: room.phase || GAME_PHASES.WAITING,
    disconnectedPlayers: room.disconnectedPlayers || [],
    settings: room.settings ? { ...room.settings } : { boardSize: BOARD_SIZE, turnTimeMs: TURN_TIME_MS }
  };
}

function syncScreenToPhase(state, room) {
  // 开局（大厅）与“再来一局”（结果屏）都切回对局屏
  if (room.status === GAME_PHASES.PLAYING && ['lobby', 'result'].includes(state.screen)) {
    state.screen = 'game';
  }
  // 终局不自动跳转结算屏：先在棋盘上展示获胜连线，由玩家点击“查看结算”进入。
}
