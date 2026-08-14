import { createGameStore } from '../../../../src/shared/store/createGameStore'
import { DEFAULT_MAP_SIZE, DEFAULT_THEME, GAME_PHASES } from '../services/gameEngine'
import { createLogger } from '../services/logger'

/**
 * territory-control store 接线（服务器权威 / 瘦客户端）。
 *
 * state + network + cache 由共享工厂 createGameStore 生成，本文件只声明
 * 本游戏的房间镜像结构与屏幕推导。生产/移动/离线中和等"持续推进"由服务器
 * tick 驱动并通过 STATE 全量下发，客户端不再跑任何生产定时器。
 */
const store = createGameStore({
  gameId: 'territory',
  logger: createLogger('Territory:Network'),
  cacheKey: 'territory_state_cache',
  stateFields: ['playerId', 'playerName', 'roomCode', 'isHost', 'screen', 'connectionStatus'],
  roomFields: ['players', 'phase', 'status', 'hostId', 'settings', 'gameState', 'disconnectedPlayers'],
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
    settings: { mapSize: DEFAULT_MAP_SIZE, theme: DEFAULT_THEME },
    gameState: {
      mapSize: DEFAULT_MAP_SIZE,
      theme: DEFAULT_THEME,
      seed: null,
      width: 1000,
      height: 640,
      territories: [],
      edges: [],
      items: [],
      movingTroops: [],
      weather: null,
      weatherRotationAt: 0,
      playerBuffs: {},
      nextItemRespawnAt: 0,
      recentEvents: [],
      productionTick: 0,
      startedAt: null,
      lastTickAt: null,
      winnerId: null,
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
    settings: room.settings ? { ...room.settings } : { mapSize: DEFAULT_MAP_SIZE, theme: DEFAULT_THEME },
    players: (room.players || []).map(player => ({ ...player })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      mapSize: room.gameState.mapSize || DEFAULT_MAP_SIZE,
      theme: room.gameState.theme || DEFAULT_THEME,
      seed: room.gameState.seed || null,
      width: room.gameState.width || 1000,
      height: room.gameState.height || 640,
      territories: room.gameState.territories ? room.gameState.territories.map(t => ({ ...t })) : [],
      edges: room.gameState.edges ? room.gameState.edges.map(e => ({ ...e })) : [],
      items: room.gameState.items ? room.gameState.items.map(t => ({ ...t })) : [],
      // 派兵队列必须同步到镜像,否则 GameScreen 看不到 movingTroop 动画。
      // productionTick 同步过去,避免后续 diff 误判 gameState 整体变化。
      movingTroops: room.gameState.movingTroops ? room.gameState.movingTroops.map(t => ({ ...t })) : [],
      weather: room.gameState.weather ? { ...room.gameState.weather } : null,
      weatherRotationAt: room.gameState.weatherRotationAt || 0,
      playerBuffs: room.gameState.playerBuffs
        ? Object.fromEntries(Object.entries(room.gameState.playerBuffs).map(([k, v]) => [k, v.map(b => ({ ...b }))]))
        : {},
      nextItemRespawnAt: room.gameState.nextItemRespawnAt || 0,
      recentEvents: room.gameState.recentEvents ? room.gameState.recentEvents.map(e => ({ ...e })) : [],
      productionTick: room.gameState.productionTick || 0,
      startedAt: room.gameState.startedAt || null,
      lastTickAt: room.gameState.lastTickAt || null,
      winnerId: room.gameState.winnerId || null,
      endedAt: room.gameState.endedAt || null
    } : createEmptyRoom().gameState,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : []
  }
}

function syncScreenToPhase(state, room) {
  if (room.phase === GAME_PHASES.PLAYING) {
    state.screen = 'game'
  } else if (room.phase === GAME_PHASES.ENDED) {
    state.screen = 'result'
  } else if (state.connected) {
    // WAITING 阶段,只要已连上就锁在 lobby
    // 包含 host restart 后从 result 跳回 lobby 的场景
    if (state.screen === 'result' || (state.screen !== 'game' && state.screen !== 'lobby')) {
      state.screen = 'lobby'
    }
  }
}
