import {
  GAME_PHASES,
  createInitialRoom,
  generatePlayerId,
  restartGame,
  startGame,
  submitModuleAction
} from '../services/gameEngine'
import p2p from '../services/p2p'
import { MSG } from '../services/online'
import { sanitizeModuleAction, sanitizePlayerName, sanitizeRoomCode } from '../services/sanitize'
import { clearCache, flushCache, hasRestoreableState, restoreFromCache } from './cache'
import { gameState, getRoom, resetLocalState, setConnectionStatus, setRoom, updateLocalState } from './state'
import {
  broadcastState,
  resetBroadcastState,
  sendJoinRequest,
  sendModuleAction,
  setupGuestHandlers,
  setupHostHandlers
} from './network'
import {
  RECONNECT_METADATA,
  resetAllTimers,
  startCountdownTimer,
  startJoinRetryInterval,
  startJoinTimeout,
  stopCountdownTimer,
  stopJoinRetry
} from './timers'

export async function createRoom(name) {
  const { value: playerName, error } = sanitizePlayerName(name)
  if (error) gameState.error = error

  gameState.connecting = true
  setConnectionStatus('connecting', 'Creating mission...')
  const playerId = generatePlayerId()
  const roomCode = p2p.generateRoomCode()

  gameState.playerId = playerId
  gameState.playerName = playerName
  gameState.roomCode = roomCode
  gameState.isHost = true

  const room = createInitialRoom(playerId, playerName, roomCode)
  const hostPlayer = room.players.find(player => player.id === playerId)
  if (hostPlayer) hostPlayer._peerId = p2p.getHostPeerId(roomCode)
  setRoom(room)

  try {
    await p2p.createHost(roomCode, playerName)
    setupHostHandlers()
    updateLocalState(room)
    gameState.connected = true
    gameState.connecting = false
    gameState.screen = 'lobby'
    setConnectionStatus('connected', 'Mission created.')
    return true
  } catch (createError) {
    gameState.error = createError.message || 'Failed to create mission.'
    gameState.connecting = false
    cleanup()
    return false
  }
}

export async function joinRoom(name, code) {
  const { value: playerName, error: nameError } = sanitizePlayerName(name)
  const { value: roomCode, error: codeError } = sanitizeRoomCode(code)
  if (nameError || codeError) {
    gameState.error = nameError || codeError
    return false
  }

  gameState.connecting = true
  setConnectionStatus('connecting', 'Joining mission...')

  const playerId = generatePlayerId()
  gameState.playerId = playerId
  gameState.playerName = playerName
  gameState.roomCode = roomCode
  gameState.isHost = false

  try {
    await p2p.joinRoom(roomCode, playerName)
    setupGuestHandlers()
    sendJoinRequest(playerId, playerName)
    startJoinRetryInterval(() => {
      if (gameState.connected) {
        stopJoinRetry()
        return
      }
      sendJoinRequest(playerId, playerName)
    })
    startJoinTimeout(() => {
      if (!gameState.connected) {
        gameState.error = 'Join timed out.'
        setConnectionStatus('error', 'Join timed out.')
        stopJoinRetry()
        gameState.connecting = false
      }
    })
    gameState.connecting = false
    return true
  } catch (joinError) {
    gameState.error = joinError.message || 'Failed to join mission.'
    gameState.connecting = false
    cleanup()
    return false
  }
}

export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    gameState.error = 'Missing cached mission details.'
    return false
  }

  gameState.connecting = true
  gameState.connected = false
  setConnectionStatus('reconnecting', 'Reconnecting...')

  try {
    p2p.softDisconnect()
    if (gameState.isHost) {
      await p2p.createHost(gameState.roomCode, gameState.playerName)
      setupHostHandlers()
      gameState.connected = true
      gameState.connecting = false
      setConnectionStatus('connected', 'Reconnected.')
      return true
    }

    await p2p.joinRoom(gameState.roomCode, gameState.playerName)
    setupGuestHandlers()
    sendJoinRequest(gameState.playerId, gameState.playerName, true)
    gameState.connecting = false
    return true
  } catch (error) {
    gameState.error = error.message || 'Reconnect failed.'
    gameState.connecting = false
    setConnectionStatus('error', gameState.error)
    return false
  }
}

export async function leaveRoom() {
  cleanup({ forceStatusReset: true })
}

export function handleStartGame(options = {}) {
  if (!gameState.isHost) return false
  const result = startGame(getRoom(), options)
  if (result.error) {
    gameState.error = result.error
    return false
  }
  startCountdownTimer(() => broadcastState())
  broadcastState()
  p2p.broadcast(MSG.START_GAME, { playerId: gameState.playerId, options })
  return true
}

export function handleAssignRoles(roleByPlayerId) {
  const room = getRoom()
  if (!gameState.isHost || !room) return false
  room.players.forEach(player => {
    player.role = roleByPlayerId[player.id] || player.role
  })
  room.updatedAt = Date.now()
  updateLocalState(room)
  broadcastState()
  p2p.broadcast(MSG.ASSIGN_ROLE, { playerId: gameState.playerId, roleByPlayerId })
  return true
}

export function handleSubmitModuleAction(moduleId, rawAction) {
  const { value: action, error } = sanitizeModuleAction(rawAction)
  if (error) {
    gameState.error = error
    return false
  }

  if (!gameState.isHost) {
    sendModuleAction(moduleId, action)
    return true
  }

  const room = getRoom()
  const result = submitModuleAction(room, gameState.playerId, moduleId, action)
  if (result.error) {
    gameState.error = result.error
    return false
  }
  if (room.phase === GAME_PHASES.SOLVED || room.phase === GAME_PHASES.EXPLODED) {
    stopCountdownTimer()
  }
  broadcastState()
  return true
}

export function handleRestartGame() {
  if (!gameState.isHost) return false
  restartGame(getRoom())
  stopCountdownTimer()
  resetBroadcastState()
  broadcastState()
  p2p.broadcast(MSG.RESTART_GAME, { playerId: gameState.playerId, at: Date.now() })
  return true
}

export function handleEndGame() {
  if (!gameState.isHost) return false
  const room = getRoom()
  room.status = GAME_PHASES.ENDED
  room.phase = GAME_PHASES.ENDED
  room.gameState.result = 'ended'
  room.updatedAt = Date.now()
  stopCountdownTimer()
  broadcastState()
  p2p.broadcast(MSG.END_GAME, { playerId: gameState.playerId, at: Date.now() })
  return true
}

export function cleanup({ forceStatusReset = false } = {}) {
  flushCache()
  p2p.stopHeartbeat()
  p2p.disconnect()
  resetAllTimers()
  resetBroadcastState()
  resetLocalState()
  clearCache()
  if (forceStatusReset) {
    setConnectionStatus('disconnected', '')
  }
}

export { gameState, restoreFromCache, hasRestoreableState, RECONNECT_METADATA }
