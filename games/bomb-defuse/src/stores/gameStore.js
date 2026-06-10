import { generatePlayerId } from '../services/gameEngine'
import { sanitizeModuleAction, sanitizePlayerName, sanitizeRoomCode } from '../services/sanitize'
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
 * bomb-defuse 游戏 store（服务器权威 / 瘦客户端）。
 *
 * 所有"操作"都退化为向服务器发意图（INTENT），权威结果由服务器 STATE 下发后
 * 经 network → state 应用。本地不再跑游戏逻辑、不再做主机迁移与加入重试。
 * 房主权限由服务器强制校验，这里的 isHost 判断仅用于即时收起按钮，不是安全边界。
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
    gameState.error = 'Missing cached mission details.'
    return false
  }
  // 同 playerId 重新 JOIN，服务器即视为重连（保留座位与房主身份）
  connectJoin(gameState.roomCode, gameState.playerId, gameState.playerName)
  return true
}

export function leaveRoom() {
  cleanup({ forceStatusReset: true })
}

export function handleStartGame() {
  if (!gameState.isHost) return false
  return sendIntent('START_GAME')
}

export function handleSetDifficulty(difficulty) {
  if (!gameState.isHost) return false
  return sendIntent('SET_DIFFICULTY', { difficulty })
}

export function handleAssignRoles(roleByPlayerId) {
  if (!gameState.isHost) return false
  return sendIntent('ASSIGN_ROLES', { roleByPlayerId })
}

export function handleSubmitModuleAction(moduleId, rawAction) {
  const { value: action, error } = sanitizeModuleAction(rawAction)
  if (error) {
    gameState.error = error
    return false
  }
  return sendIntent('SUBMIT_MODULE_ACTION', { moduleId, action })
}

export function handleRestartGame() {
  if (!gameState.isHost) return false
  return sendIntent('RESTART')
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
