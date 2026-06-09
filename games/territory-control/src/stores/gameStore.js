import {
  createInitialRoom,
  dispatchUnits,
  endGame,
  generatePlayerId,
  restartGame,
  setMapSize,
  setTheme,
  startGame
} from '../services/gameEngine'
import p2p from '../services/p2p'
import { sanitizeDispatch, sanitizeMapSize, sanitizePlayerName, sanitizeRoomCode, sanitizeTheme } from '../services/sanitize'
import { clearCache, flushCache, hasRestoreableState, restoreFromCache } from './cache'
import { gameState, getRoom, resetLocalState, setConnectionStatus, setRoom, updateLocalState } from './state'
import {
  RECONNECT_METADATA,
  broadcastState,
  cleanupNetwork,
  resetBroadcastState,
  sendDispatchAction,
  sendJoinRequest,
  setupGuestHandlers,
  setupHostHandlers
} from './network'
import {
  resetAllTimers,
  startJoinRetryInterval,
  startJoinTimeout,
  startOfflineNeutralizeTimer,
  startProductionTimer,
  stopJoinRetry,
  stopProductionTimer
} from './timers'

export async function createRoom(name) {
  gameState.error = null
  setConnectionStatus('disconnected', '')

  const { value: playerName, error } = sanitizePlayerName(name)
  if (error) {
    gameState.error = error
    return false
  }

  gameState.connecting = true
  setConnectionStatus('connecting', 'Creating field...')
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
    setConnectionStatus('connected', 'Field created.')
    return true
  } catch (createError) {
    gameState.error = createError.message || 'Failed to create room.'
    gameState.connecting = false
    cleanup()
    return false
  }
}

export async function joinRoom(name, code) {
  gameState.error = null
  setConnectionStatus('disconnected', '')

  const { value: playerName, error: nameError } = sanitizePlayerName(name)
  const { value: roomCode, error: codeError } = sanitizeRoomCode(code)
  if (nameError || codeError) {
    gameState.error = nameError || codeError
    return false
  }

  gameState.connecting = true
  setConnectionStatus('connecting', 'Joining field...')

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
    gameState.error = joinError.message || 'Failed to join room.'
    gameState.connecting = false
    cleanup()
    return false
  }
}

export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    gameState.error = 'Missing cached room details.'
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
      if (getRoom()?.phase === 'playing') {
        startProductionTimer(() => broadcastState())
        startOfflineNeutralizeTimer(() => broadcastState())
      }
      gameState.connected = true
      gameState.connecting = false
      setConnectionStatus('connected', 'Reconnected.')
      return true
    }

    await p2p.joinRoom(gameState.roomCode, gameState.playerName)
    setupGuestHandlers()
    sendJoinRequest(gameState.playerId, gameState.playerName, true)
    startJoinRetryInterval(() => {
      if (gameState.connected) {
        stopJoinRetry()
        return
      }
      sendJoinRequest(gameState.playerId, gameState.playerName, true)
    })
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

export function handleSetMapSize(mapSize) {
  const room = getRoom()
  if (!gameState.isHost || !room) return false
  const { value, error } = sanitizeMapSize(mapSize)
  if (error) {
    gameState.error = error
    return false
  }
  const result = setMapSize(room, value)
  if (result.error) {
    gameState.error = result.error
    return false
  }
  updateLocalState(room)
  broadcastState()
  return true
}

export function handleSetTheme(theme) {
  const room = getRoom()
  if (!gameState.isHost || !room) return false
  const { value, error } = sanitizeTheme(theme)
  if (error) {
    gameState.error = error
    return false
  }
  const result = setTheme(room, value)
  if (result.error) {
    gameState.error = result.error
    return false
  }
  updateLocalState(room)
  broadcastState()
  return true
}

export function handleStartGame() {
  if (!gameState.isHost) return false
  const result = startGame(getRoom())
  if (result.error) {
    gameState.error = result.error
    return false
  }
  startProductionTimer(() => broadcastState())
  startOfflineNeutralizeTimer(() => broadcastState())
  resetBroadcastState()
  broadcastState({ forceFull: true })
  return true
}

export function handleDispatch(rawPayload) {
  const { value, error } = sanitizeDispatch(rawPayload)
  if (error) {
    gameState.error = error
    return false
  }

  if (!gameState.isHost) {
    sendDispatchAction(value.sourceId, value.targetId, value.ratio, value.seq)
    return true
  }

  const room = getRoom()
  const result = dispatchUnits(room, gameState.playerId, value.sourceId, value.targetId, value.ratio)
  if (result.error) {
    gameState.error = result.error
    return false
  }
  if (room.phase === 'ended') {
    stopProductionTimer()
  }
  broadcastState()
  return true
}

export function handleRestartGame() {
  if (!gameState.isHost) return false
  restartGame(getRoom())
  stopProductionTimer()
  resetBroadcastState()
  broadcastState({ forceFull: true })
  return true
}

export function handleEndGame() {
  if (!gameState.isHost) return false
  endGame(getRoom(), null)
  stopProductionTimer()
  broadcastState()
  return true
}

export function cleanup({ forceStatusReset = false } = {}) {
  flushCache()
  resetAllTimers()
  resetBroadcastState()
  cleanupNetwork()
  p2p.stopHeartbeat()
  // disconnect 之前先把所有事件回调清成 noop,避免 conn.close() 同步触发
  // onPlayerDisconnected → markOffline → broadcastState 试图 sendTo 已关 conn → 残留 retry queue
  p2p.clearEventHandlers()
  p2p.disconnect()
  resetLocalState()
  clearCache()
  if (forceStatusReset) {
    setConnectionStatus('disconnected', '')
  }
}

export { gameState, restoreFromCache, hasRestoreableState, RECONNECT_METADATA }
