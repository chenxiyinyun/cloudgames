import { reactive } from 'vue'
import { DEFAULT_MAP_SIZE, DEFAULT_THEME, GAME_PHASES } from '../services/gameEngine'

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  isHost: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected',
  connectionMessage: '',
  room: createEmptyRoomMirror()
})

let cachedRoom = null

export function getRoom() {
  return cachedRoom
}

export function setRoom(room) {
  cachedRoom = room
}

export function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status
  gameState.connectionMessage = message
}

export function updateLocalState(room) {
  if (!room) return
  gameState.roomCode = room.code
  gameState.isHost = room.hostId === gameState.playerId
  gameState.room = {
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
      // 派兵队列必须同步到镜像,否则 GameScreen 看不到 movingTroop 动画。
      // productionTick 同步过去,避免后续 diff 误判 gameState 整体变化。
      movingTroops: room.gameState.movingTroops ? room.gameState.movingTroops.map(t => ({ ...t })) : [],
      productionTick: room.gameState.productionTick || 0,
      startedAt: room.gameState.startedAt || null,
      lastTickAt: room.gameState.lastTickAt || null,
      winnerId: room.gameState.winnerId || null,
      endedAt: room.gameState.endedAt || null
    } : createEmptyRoomMirror().gameState,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : []
  }
  syncScreenToPhase(room)
}

export function resetLocalState() {
  cachedRoom = null
  gameState.screen = 'menu'
  gameState.playerId = null
  gameState.playerName = ''
  gameState.isHost = false
  gameState.roomCode = null
  gameState.connected = false
  gameState.connecting = false
  gameState.error = null
  gameState.connectionStatus = 'disconnected'
  gameState.connectionMessage = ''
  gameState.room = createEmptyRoomMirror()
}

function createEmptyRoomMirror() {
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
      movingTroops: [],
      productionTick: 0,
      startedAt: null,
      lastTickAt: null,
      winnerId: null,
      endedAt: null
    },
    disconnectedPlayers: []
  }
}

function syncScreenToPhase(room) {
  if (room.phase === GAME_PHASES.PLAYING) {
    gameState.screen = 'game'
  } else if (room.phase === GAME_PHASES.ENDED) {
    gameState.screen = 'result'
  } else if (gameState.connected) {
    // WAITING 阶段,只要已连上就锁在 lobby
    // 包含 host restart 后从 result 跳回 lobby 的场景
    if (gameState.screen === 'result' || (gameState.screen !== 'game' && gameState.screen !== 'lobby')) {
      gameState.screen = 'lobby'
    }
  }
}
