import { createGameStore } from '../../../../src/shared/store/createGameStore'
import { DEFAULT_DIFFICULTY, GAME_PHASES } from '../services/gameEngine'
import { createLogger } from '../services/logger'

/**
 * bomb-defuse store 接线（服务器权威 / 瘦客户端）。
 *
 * state + network + cache 由共享工厂 createGameStore 生成，本文件只声明
 * 本游戏的房间镜像结构与屏幕推导。权威房间状态全部来自服务器的 STATE 下发。
 */
const store = createGameStore({
  gameId: 'bombdefuse',
  logger: createLogger('BombDefuse:Network'),
  cacheKey: 'bombdefuse_state_cache',
  stateFields: ['playerId', 'playerName', 'roomCode', 'isHost', 'screen', 'connectionStatus'],
  roomFields: ['players', 'phase', 'status', 'hostId', 'gameState', 'disconnectedPlayers'],
  createEmptyRoom,
  applyRoom,
  syncScreenToPhase
})

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
  leaveNetwork,
  cleanupNetwork,
  restoreFromCache,
  hasRestoreableState,
  clearCache,
  flushCache
} = store

// ── 本游戏特有部分 ──────────────────────────────────────────────────────────

function createEmptyRoom() {
  return {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    hostId: null,
    settings: { difficulty: DEFAULT_DIFFICULTY },
    gameState: {
      seed: null,
      startedAt: null,
      deadlineAt: null,
      durationMs: 300000,
      strikeLimit: 3,
      difficulty: DEFAULT_DIFFICULTY,
      strikes: [],
      serialNumber: '',
      batteries: 0,
      indicators: [],
      modules: [],
      solvedModuleIds: [],
      actionLog: [],
      result: null,
      endedAt: null
    },
    disconnectedPlayers: []
  }
}

function applyRoom(state, room) {
  state.room = {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    settings: room.settings ? { ...room.settings } : { difficulty: DEFAULT_DIFFICULTY },
    players: (room.players || []).map(player => ({ ...player })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      seed: room.gameState.seed || null,
      startedAt: room.gameState.startedAt || null,
      deadlineAt: room.gameState.deadlineAt || null,
      durationMs: room.gameState.durationMs || 300000,
      strikeLimit: room.gameState.strikeLimit || 3,
      difficulty: room.gameState.difficulty || DEFAULT_DIFFICULTY,
      strikes: room.gameState.strikes ? [...room.gameState.strikes] : [],
      serialNumber: room.gameState.serialNumber || '',
      batteries: room.gameState.batteries || 0,
      indicators: room.gameState.indicators ? [...room.gameState.indicators] : [],
      modules: room.gameState.modules ? room.gameState.modules.map(module => ({ ...module })) : [],
      solvedModuleIds: room.gameState.solvedModuleIds ? [...room.gameState.solvedModuleIds] : [],
      actionLog: room.gameState.actionLog ? [...room.gameState.actionLog] : [],
      result: room.gameState.result || null,
      endedAt: room.gameState.endedAt || null
    } : createEmptyRoom().gameState,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : []
  }
}

function syncScreenToPhase(state, room) {
  if (room.phase === GAME_PHASES.PLAYING) {
    state.screen = 'game'
  } else if (
    room.phase === GAME_PHASES.SOLVED ||
    room.phase === GAME_PHASES.EXPLODED ||
    room.phase === GAME_PHASES.ENDED
  ) {
    state.screen = 'result'
  } else if (state.connected && state.screen !== 'game' && state.screen !== 'result') {
    state.screen = 'lobby'
  }
}
