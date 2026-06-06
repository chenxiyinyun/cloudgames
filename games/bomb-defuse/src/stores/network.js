import {
  addPlayerToRoom,
  removePlayerFromRoom,
  submitModuleAction
} from '../services/gameEngine'
import p2p from '../services/p2p'
import { createLogger } from '../services/logger'
import {
  MSG,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  deepClone,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp,
  cleanupOps,
  resetOps
} from '../services/online'
import { createDedupeHandler } from '../../../../src/shared/online/dedupeHandler'
import { createHostMigrationHandler } from '../../../../src/shared/online/useHostMigration'
import { gameState, getRoom, setConnectionStatus, setRoom, updateLocalState } from './state'
import { clearJoinTimeout, stopCountdownTimer, stopJoinRetry } from './timers'

const log = createLogger('BombDefuse:Network')

const sendJoinRequestBase = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
})

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom,
  updateLocalState
})

// 共享房主迁移处理器
export const hostMigrator = createHostMigrationHandler({
  gameId: 'bombdefuse',
  p2p,
  log
})

export function sendJoinRequest(playerId, playerName, isReconnect = false) {
  return sendJoinRequestBase(playerId, playerName, isReconnect)
}

export function broadcastState(options = {}) {
  const room = getRoom()
  if (!room) return null
  cleanupOps()
  return roomBroadcaster.broadcastState({
    forceFull: options.forceFull ?? false,
    error: options.error || null
  })
}

export function resetBroadcastState() {
  roomBroadcaster.resetBroadcastState()
}

const withDedupe = createDedupeHandler({
  generateOpKey,
  isDuplicateOp,
  p2p,
  broadcastState: () => { broadcastState() },
  log,
  getRoom,
  getRoomCode: () => getRoom()?.code,
  roomStateType: MSG.ROOM_STATE
})

export function sendModuleAction(moduleId, action) {
  return p2p.sendTo(p2p.getHostPeerId(gameState.roomCode), MSG.SUBMIT_MODULE_ACTION, {
    roomCode: gameState.roomCode,
    playerId: gameState.playerId,
    moduleId,
    action
  })
}

// ── Auto-Reconnect Engine ────────────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 8
let _reconnectAttempts = 0
let _autoReconnectTimer = null
let _autoReconnectInterval = null

function registerAutoReconnectHandlers() {
  p2p.onConnectionStateChange = ({ peerId, iceConnectionState: iceState }) => {
    const hostPeerId = `bombdefuse-${gameState.roomCode}`

    if (iceState === 'disconnected' || iceState === 'failed') {
      if ((peerId === hostPeerId || gameState.isHost) && !_autoReconnectTimer) {
        setConnectionStatus('reconnecting', '检测到连接断开，正在自动重连...')
        startAutoReconnect()
      }
    } else if (iceState === 'connected' || iceState === 'completed') {
      cancelAutoReconnect()
      if (gameState.connectionStatus === 'reconnecting') {
        setConnectionStatus('connected', '已连接')
      }
      _reconnectAttempts = 0
    }
  }

  if (_autoReconnectInterval) return
  _autoReconnectInterval = setInterval(() => {
    if (!gameState.roomCode) return
    const hostPeerId = `bombdefuse-${gameState.roomCode}`
    const state = p2p.getPeerConnectionState(hostPeerId)
    if (state?.iceConnectionState === 'failed' && !_autoReconnectTimer) {
      startAutoReconnect()
    }
  }, 3000)
}

async function startAutoReconnect() {
  if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setConnectionStatus('error', '连接失败，请检查网络后手动重连')
    cancelAutoReconnect()
    return
  }

  _reconnectAttempts++

  const baseDelay = Math.min(1000 * Math.pow(2, _reconnectAttempts - 1), 32000)
  const jitter = baseDelay * (0.75 + Math.random() * 0.5)

  _autoReconnectTimer = setTimeout(async () => {
    _autoReconnectTimer = null
    try {
      if (gameState.isHost) {
        const connectedPeers = p2p.getConnectedPeers()
        if (connectedPeers.length > 0) {
          cancelAutoReconnect()
          setConnectionStatus('connected', '已连接')
          _reconnectAttempts = 0
          return
        }
        startAutoReconnect()
      } else {
        const ok = await reconnectRoomInternal()
        if (!ok) {
          log.warn('Auto-reconnect attempt timed out', { attempt: _reconnectAttempts })
          startAutoReconnect()
        }
      }
    } catch (err) {
      log.warn('Auto-reconnect attempt failed', { attempt: _reconnectAttempts, error: err?.message })
      startAutoReconnect()
    }
  }, jitter)
}

function cancelAutoReconnect() {
  if (_autoReconnectTimer) {
    clearTimeout(_autoReconnectTimer)
    _autoReconnectTimer = null
  }
}

async function reconnectRoomInternal() {
  if (!gameState.roomCode || !gameState.playerName) return false

  p2p.softDisconnect()
  gameState.connected = false

  await p2p.joinRoom(gameState.roomCode, gameState.playerName)
  setupGuestHandlers()

  sendJoinRequest(gameState.playerId, gameState.playerName, true)

  return new Promise((resolve) => {
    let settled = false
    let timeout = null
    let checkInterval = null
    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(checkInterval)
      resolve(ok)
    }
    timeout = setTimeout(() => finish(false), 10000)
    checkInterval = setInterval(() => {
      if (gameState.connected) {
        finish(true)
      }
    }, 500)
  })
}

export function cleanupNetwork() {
  cancelAutoReconnect()
  if (_autoReconnectInterval) {
    clearInterval(_autoReconnectInterval)
    _autoReconnectInterval = null
  }
  _reconnectAttempts = 0
  hostMigrator.resetMigrationMutex()
  resetOps()
}

export const RECONNECT_METADATA = {
  get attempt() { return _reconnectAttempts; },
  MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
}

// ── Disconnected Player Cleanup ──────────────────────────────────────────────
const LOBBY_DISCONNECT_TIMEOUT_MS = 30 * 1000
const LOBBY_CLEANUP_INTERVAL_MS = 10 * 1000
let _offlinePlayerCleanupTimer = null

function markPlayerOffline(peerId) {
  const room = getRoom()
  const player = room?.players?.find(candidate => candidate._peerId === peerId)
  if (!player || !room) return

  player.isOnline = false
  if (!room.disconnectedPlayers) {
    room.disconnectedPlayers = []
  }
  const alreadyTracked = room.disconnectedPlayers.find(p => p.id === player.id)
  if (!alreadyTracked) {
    room.disconnectedPlayers.push({
      id: player.id,
      name: player.name,
      disconnectedAt: Date.now()
    })
  }

  // 大厅阶段：启动超时清理（30s 后真正移除，让新玩家能补位）
  if (room.phase === 'waiting' || room.status === 'waiting') {
    scheduleOfflinePlayerCleanup()
  }
}

function cleanupDisconnectedPlayers() {
  const room = getRoom()
  if (!room?.disconnectedPlayers?.length) return

  // 仅大厅阶段执行清理
  if (room.phase !== 'waiting' && room.status !== 'waiting') {
    clearOfflinePlayerCleanupTimer()
    return
  }

  const now = Date.now()
  const stale = room.disconnectedPlayers.filter(
    p => now - p.disconnectedAt > LOBBY_DISCONNECT_TIMEOUT_MS
  )

  if (stale.length === 0) return

  log.info('Removing stale disconnected players from lobby', { count: stale.length })

  stale.forEach(sp => {
    removePlayerFromRoom(room, sp.id)
  })

  if (room.disconnectedPlayers.length === 0) {
    clearOfflinePlayerCleanupTimer()
  }

  broadcastState()
}

function scheduleOfflinePlayerCleanup() {
  if (_offlinePlayerCleanupTimer) return
  _offlinePlayerCleanupTimer = setTimeout(() => {
    _offlinePlayerCleanupTimer = null
    cleanupDisconnectedPlayers()
    if (getRoom()?.disconnectedPlayers?.length > 0) {
      scheduleOfflinePlayerCleanup()
    }
  }, LOBBY_CLEANUP_INTERVAL_MS)
}

function clearOfflinePlayerCleanupTimer() {
  if (_offlinePlayerCleanupTimer) {
    clearTimeout(_offlinePlayerCleanupTimer)
    _offlinePlayerCleanupTimer = null
  }
}

// ── Host Handlers ────────────────────────────────────────────────────────────

export function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    log.info('Player connected:', { peer: conn.peer })
    if (getRoom()) {
      setTimeout(() => {
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer)
        if (otherPeers.length > 0) {
          p2p.sendTo(conn.peer, MSG.PEER_LIST, { peers: otherPeers })
        }
      }, 500)
    }
  }

  p2p.onPlayerDisconnected = (peerId) => {
    log.info('Player disconnected:', { peerId })
    markPlayerOffline(peerId)
    broadcastState()
  }

  p2p.onMessage = (data, peerId) => {
    handleHostMessage(data, peerId)
  }

  p2p.onError = (err) => {
    log.error('Host error:', { error: err })
    gameState.error = err.message
    setConnectionStatus('error', err.message)
  }

  p2p.startHeartbeat(10000)
  p2p.onDeadPeer = (peerId) => {
    log.warn('Host detected dead peer', { peerId })
    markPlayerOffline(peerId)
    broadcastState()
  }

  registerAutoReconnectHandlers()
}

// ── Guest Handlers ───────────────────────────────────────────────────────────

export function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    log.info('Guest disconnected from peer:', { peerId })

    const hostPeerId = `bombdefuse-${gameState.roomCode}`
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onPlayerDisconnected: migration already in progress, skipping')
        return
      }
      log.info('Host disconnected! Attempting migration...')
      _doHostMigrate()
    }
  }

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId)
  }

  p2p.onError = (err) => {
    log.error('Guest error:', { error: err })
    gameState.error = err.message
    setConnectionStatus('error', err.message)
  }

  p2p.startHeartbeat(10000)
  p2p.onDeadPeer = (peerId) => {
    log.warn('Guest detected dead peer', { peerId })
    const hostPeerId = `bombdefuse-${gameState.roomCode}`
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onDeadPeer: migration already in progress, skipping')
        return
      }
      log.warn('Host is dead, triggering migration')
      _doHostMigrate()
    }
  }

  registerAutoReconnectHandlers()
}

// 房主迁移 — 委托给共享迁移处理器
async function _doHostMigrate() {
  await hostMigrator.handleHostDisconnect(getRoom(), gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus,
    enableWaitBranch: false
  })
}

// ── Message Handlers ─────────────────────────────────────────────────────────

export function handleHostMessage(data, peerId) {
  const type = data?.type
  const payload = data?.payload || {}
  const room = getRoom()

  if (!room) return

  switch (type) {
    case MSG.JOIN_REQUEST:
      handleJoinRequest(payload, peerId)
      break
    case MSG.SUBMIT_MODULE_ACTION: {
      const sender = room.players.find(p => p._peerId === peerId)
      if (!sender || sender.id !== payload.playerId) {
        log.warn('Rejecting module action: playerId does not match sender peer', {
          peerId,
          claimedPlayerId: payload.playerId,
          actualPlayerId: sender?.id
        })
        return
      }
      withDedupe(MSG.SUBMIT_MODULE_ACTION, payload, peerId,
        () => handleRemoteModuleAction(payload),
        { dupeMessage: '请勿重复操作' }
      )
      break
    }
    case MSG.REQUEST_STATE:
      if (isDuplicateOp(type, payload, room.code)) return
      p2p.sendTo(peerId, MSG.ROOM_STATE, { room: deepClone(room), detail: getRoomStateDedupeDetail(room) })
      break
    default:
      log.debug('Unhandled host message', { type, peerId })
  }
}

export function handleGuestMessage(data) {
  const type = data?.type
  const payload = data?.payload || {}

  switch (type) {
    case MSG.JOIN_RESPONSE:
      if (!payload.success) {
        const message = payload.error || 'Join rejected.'
        stopJoinRetry()
        clearJoinTimeout()
        gameState.error = message
        gameState.connected = false
        gameState.connecting = false
        setConnectionStatus('error', message)
        return
      }
      stopJoinRetry()
      clearJoinTimeout()
      gameState.connected = true
      gameState.connecting = false
      gameState.error = null
      setConnectionStatus('connected', 'Mission joined.')
      setRoom(payload.room)
      updateLocalState(payload.room)
      break
    case MSG.ROOM_STATE:
      applyRoomStatePayload(payload)
      break
    case MSG.HOST_MIGRATION: {
      try {
        const { newHostId, newHostPeerId, room } = payload
        log.info('Host migration to:', { newHostId })

        if (newHostId === gameState.playerId) {
          break
        }

        hostMigrator.resetMigrationMutex()
        log.info('Host migration resolved by peer', { newHostId })

        setRoom(room)
        updateLocalState(getRoom())

        p2p.connectToPeer(newHostPeerId).then(() => {
          setConnectionStatus('connected', '已连接到新房主')
          gameState.connected = true
        }).catch((err) => {
          log.error('Failed to connect to new host:', { error: err })
        })
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { error: err })
      }
      break
    }
    case MSG.PEER_LIST: {
      try {
        const { peers } = payload
        if (peers && peers.length > 0) {
          peers.forEach(async (targetPeerId) => {
            try {
              await p2p.connectToPeer(targetPeerId)
            } catch (err) {
              log.error('Failed to connect to peer:', { peerId: targetPeerId, error: err })
            }
          })
        }
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { error: err })
      }
      break
    }
    case MSG.CONNECT_TO_PEER: {
      try {
        const { peerId: targetPeerId } = payload
        p2p.connectToPeer(targetPeerId).catch((err) => {
          log.error('Failed to connect to peer:', { peerId: targetPeerId, error: err })
        })
      } catch (err) {
        log.error('handleGuestMessage:CONNECT_TO_PEER error', { error: err })
      }
      break
    }
    default:
      log.debug('Unhandled guest message', { type })
  }
}

// ── Join Request Handler ─────────────────────────────────────────────────────

function handleJoinRequest(payload, peerId) {
  const room = getRoom()
  const originalPeerId = payload.originalPeerId || peerId

  // 重连场景：isReconnect=true 且 originalPeerId 匹配已有在线玩家
  if (payload.isReconnect && originalPeerId) {
    const existingByPeerId = room?.players.find(p => p._peerId === originalPeerId)
    if (existingByPeerId) {
      existingByPeerId.isOnline = true
      existingByPeerId.name = payload.playerName
      existingByPeerId._peerId = originalPeerId
      if (room.disconnectedPlayers) {
        room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== existingByPeerId.id)
      }
      broadcastState()
      p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
        success: true,
        room: deepClone(room)
      })
      return
    }
  }

  // 按 playerId 查找离线玩家（断线重连）
  const existingByPlayerId = room?.players.find(p => p.id === payload.playerId)

  if (existingByPlayerId && !existingByPlayerId.isOnline) {
    existingByPlayerId.isOnline = true
    existingByPlayerId._peerId = originalPeerId
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== payload.playerId)
    }
    broadcastState()
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: payload.playerId })
    return
  }

  if (existingByPlayerId && existingByPlayerId.isOnline) {
    // 同一 playerId 已在线
    if (payload.isReconnect) {
      // 重连：更新名字和 peerId
      existingByPlayerId.name = payload.playerName
      existingByPlayerId._peerId = originalPeerId
    }
    broadcastState({ forceFull: true })
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
      success: true,
      room: deepClone(room)
    })
    return
  }

  // playerId 未匹配，按 playerName 查找已有离线玩家
  const existingByName = room?.players.find(
    p => p.name === payload.playerName && !p.isOnline
  )

  if (existingByName) {
    existingByName.isOnline = true
    existingByName._peerId = originalPeerId
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== existingByName.id)
    }
    broadcastState()
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: existingByName.id })
    return
  }

  const existingOnlineByName = room?.players.find(
    p => p.name === payload.playerName && p.isOnline
  )
  if (existingOnlineByName) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '该名字的玩家已在线' })
    return
  }

  // 完全没有匹配 → 新玩家
  const result = addPlayerToRoom(room, payload.playerName, payload.playerId)

  if (result.error) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
      success: false,
      error: result.error
    })
    return
  }

  const player = room.players.find(candidate => candidate.id === payload.playerId)
  if (player) {
    player._peerId = originalPeerId
  }

  broadcastState()

  // 通知其他访客连接到新玩家
  const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId)
  otherPeers.forEach(otherPeerId => {
    p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId })
  })
}

// ── Module Action Handler ────────────────────────────────────────────────────

function handleRemoteModuleAction(payload) {
  const room = getRoom()
  const result = submitModuleAction(room, payload.playerId, payload.moduleId, payload.action)
  if (result.error) {
    return result
  }

  if (room.phase === 'exploded' || room.phase === 'solved') {
    stopCountdownTimer()
  }
  return {}
}

// ── Room State Application ───────────────────────────────────────────────────

function applyRoomStatePayload(payload) {
  if (payload.room) {
    const room = payload.room
    const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: getRoomStateDedupeDetail(room) })
    if (isDuplicateOp(roomStateKey)) {
      log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey })
      return
    }

    setRoom(room)
    updateLocalState(room)
    stopJoinRetry()

    if (payload.error) {
      gameState.error = payload.error
    }

    if (!gameState.connected) {
      gameState.connected = true
      if (gameState.connectionStatus === 'reconnecting') {
        setConnectionStatus('connected', '重连成功，状态已恢复')
      } else {
        setConnectionStatus('connected', '已连接')
      }
    }
  } else if (payload.delta) {
    const delta = payload.delta
    const currentRoom = getRoom()
    if (!currentRoom) {
      log.warn('Delta received but no cachedRoom')
      return
    }
    Object.keys(delta).forEach(key => {
      currentRoom[key] = delta[key]
    })
    updateLocalState(currentRoom)
  }
}
