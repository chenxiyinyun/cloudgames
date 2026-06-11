import { generatePlayerId } from '../services/gameEngine'
import { sanitizeDispatch, sanitizeMapSize, sanitizePlayerName, sanitizeRoomCode, sanitizeTheme } from '../services/sanitize'
import { clearCache, flushCache, hasRestoreableState, restoreFromCache } from './cache'
import { gameState, resetLocalState, setConnectionStatus } from './state'
import {
  RECONNECT_METADATA,
  cleanupNetwork,
  connectCreate,
  connectJoin,
  sendIntent
} from './network'

/**
 * territory-control 游戏 store（服务器权威 / 瘦客户端）。
 *
 * 所有操作退化为向服务器发意图；生产/移动/离线中和/胜负全部由服务器 tick 权威推进，
 * 客户端只渲染服务器 STATE 下发的镜像，不再本地推进游戏逻辑。
 */

export function createRoom(name) {
  gameState.error = null
  setConnectionStatus('disconnected', '')

  const { value: playerName, error } = sanitizePlayerName(name)
  if (error) {
    gameState.error = error
    return false
  }

  const playerId = generatePlayerId()
  gameState.playerId = playerId
  gameState.playerName = playerName
  gameState.isHost = true // 乐观；以 JOINED 返回的 room.hostId 为准

  connectCreate(playerId, playerName)
  return true
}

export function joinRoom(name, code) {
  gameState.error = null
  setConnectionStatus('disconnected', '')

  const { value: playerName, error: nameError } = sanitizePlayerName(name)
  const { value: roomCode, error: codeError } = sanitizeRoomCode(code)
  if (nameError || codeError) {
    gameState.error = nameError || codeError
    return false
  }

  const playerId = generatePlayerId()
  gameState.playerId = playerId
  gameState.playerName = playerName
  gameState.roomCode = roomCode
  gameState.isHost = false

  connectJoin(roomCode, playerId, playerName)
  return true
}

export function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerId || !gameState.playerName) {
    gameState.error = 'Missing cached room details.'
    return false
  }
  connectJoin(gameState.roomCode, gameState.playerId, gameState.playerName)
  return true
}

export function leaveRoom() {
  cleanup({ forceStatusReset: true })
}

export function handleSetMapSize(mapSize) {
  if (!gameState.isHost) return false
  const { value, error } = sanitizeMapSize(mapSize)
  if (error) {
    gameState.error = error
    return false
  }
  return sendIntent('SET_MAP_SIZE', { mapSize: value })
}

export function handleSetTheme(theme) {
  if (!gameState.isHost) return false
  const { value, error } = sanitizeTheme(theme)
  if (error) {
    gameState.error = error
    return false
  }
  return sendIntent('SET_THEME', { theme: value })
}

export function handleStartGame() {
  if (!gameState.isHost) return false
  return sendIntent('START_GAME')
}

export function handleDispatch(rawPayload) {
  const { value, error } = sanitizeDispatch(rawPayload)
  if (error) {
    gameState.error = error
    return false
  }
  // 不再需要 seq 去重：单条有序 WS + 服务器权威
  return sendIntent('DISPATCH_UNITS', {
    sourceId: value.sourceId,
    targetId: value.targetId,
    ratio: value.ratio
  })
}

export function handleRestartGame() {
  if (!gameState.isHost) return false
  return sendIntent('RESTART_GAME')
}

export function handleEndGame() {
  if (!gameState.isHost) return false
  return sendIntent('END_GAME')
}

export function cleanup({ forceStatusReset = false } = {}) {
  flushCache()
  cleanupNetwork()
  resetLocalState()
  clearCache()
  if (forceStatusReset) {
    setConnectionStatus('disconnected', '')
  }
}

export { gameState, restoreFromCache, hasRestoreableState, RECONNECT_METADATA }
