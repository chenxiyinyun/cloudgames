import { reactive } from 'vue'
import { DEFAULT_DIFFICULTY, GAME_PHASES } from '../services/gameEngine'

/**
 * 瘦客户端状态（服务器权威模型）。
 *
 * 权威房间状态全部来自服务器的 STATE 下发：updateLocalState 把服务器房间镜像到
 * gameState.room，并据此派生 isHost / 屏幕。客户端不再本地推进游戏逻辑。
 */

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

// 最近一次服务器下发的权威房间（缓存/恢复用）。
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

function syncScreenToPhase(room) {
  if (room.phase === GAME_PHASES.PLAYING) {
    gameState.screen = 'game'
  } else if (
    room.phase === GAME_PHASES.SOLVED ||
    room.phase === GAME_PHASES.EXPLODED ||
    room.phase === GAME_PHASES.ENDED
  ) {
    gameState.screen = 'result'
  } else if (gameState.connected && gameState.screen !== 'game' && gameState.screen !== 'result') {
    gameState.screen = 'lobby'
  }
}
