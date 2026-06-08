import { reactive } from 'vue'
import { DEFAULT_MAP_SIZE, GAME_PHASES } from '../services/gameEngine'
import p2p from '../services/p2p'

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
  diagnostics: {
    mode: 'unknown',
    signaling: null,
    hasTurnRelay: false,
    turnRelay: null,
    lastModeChange: null,
    peers: {}
  },
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
    settings: room.settings ? { ...room.settings } : { mapSize: DEFAULT_MAP_SIZE },
    players: (room.players || []).map(player => ({ ...player })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      mapSize: room.gameState.mapSize || DEFAULT_MAP_SIZE,
      seed: room.gameState.seed || null,
      width: room.gameState.width || 1000,
      height: room.gameState.height || 640,
      territories: room.gameState.territories ? room.gameState.territories.map(t => ({ ...t })) : [],
      edges: room.gameState.edges ? room.gameState.edges.map(e => ({ ...e })) : [],
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

export function getDiagnostics() {
  try {
    return p2p.getConnectionDiagnostics()
  } catch {
    return gameState.diagnostics
  }
}

try {
  Object.assign(gameState.diagnostics, p2p.getConnectionDiagnostics())
} catch {
  // diagnostics are optional during tests/build
}

p2p.onModeChange = payload => {
  gameState.diagnostics.lastModeChange = payload
  gameState.diagnostics.mode = payload.mode || gameState.diagnostics.mode
  if (payload.reason && gameState.connectionStatus !== 'connected') {
    gameState.connectionMessage = payload.reason
  }
}

function createEmptyRoomMirror() {
  return {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    hostId: null,
    settings: { mapSize: DEFAULT_MAP_SIZE },
    gameState: {
      mapSize: DEFAULT_MAP_SIZE,
      seed: null,
      width: 1000,
      height: 640,
      territories: [],
      edges: [],
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
