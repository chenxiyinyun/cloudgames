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
import { createNetworkLayer } from '../../../../src/shared/online/createNetworkLayer'
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

// ── Create Network Layer (shared) ────────────────────────────────────────────

const net = createNetworkLayer({
  gameId: 'bombdefuse',
  p2p,
  log,
  getRoom,
  setRoom,
  updateLocalState,
  setConnectionStatus,
  gameState,
  roomBroadcaster,
  sendJoinRequestBase,
  generateOpKey,
  isDuplicateOp,
  cleanupOps,
  resetOps,
  getRoomStateDedupeDetail,
  MSG,
  deepClone,
  removePlayerFromRoom,
  isLobbyPhase: (room) => room?.phase === 'waiting' || room?.status === 'waiting',

  handleJoinRequest: (payload, peerId) => {
    handleJoinRequest(payload, peerId)
  },

  handleHostBusinessMessage: (type, payload, peerId, ctx) => {
    if (type === MSG.SUBMIT_MODULE_ACTION) {
      const sender = ctx.room.players.find(p => p._peerId === peerId)
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
    }
  },

  onGuestJoinRejected: () => {
    stopJoinRetry()
    clearJoinTimeout()
    // 默认行为（error/connectionStatus）已由 createNetworkLayer 处理
  },

  onGuestJoinAccepted: () => {
    // 默认行为（connected/error/room 设置）已由 createNetworkLayer 处理
  },

  onGuestConnected: () => {
    gameState.screen = 'lobby'
  },

  cleanupExtra: () => {
    roomBroadcaster.resetBroadcastState()
  }
})

// ── Re-exports from network layer ────────────────────────────────────────────

export const setupHostHandlers = net.setupHostHandlers
export const setupGuestHandlers = net.setupGuestHandlers
export const hostMigrator = net.hostMigrator
export const RECONNECT_METADATA = net.RECONNECT_METADATA

// 消息分发 — 委托给共享层
export const handleHostMessage = net.dispatchHostMessage
export const handleGuestMessage = net.dispatchGuestMessage

export function broadcastState(options = {}) {
  return net.broadcastState(options)
}

export function resetBroadcastState() {
  net.resetBroadcastState()
}

export function cleanupNetwork() {
  net.cleanupNetwork()
}

export function sendJoinRequest(playerId, playerName, isReconnect = false) {
  return sendJoinRequestBase(playerId, playerName, isReconnect)
}

export function sendModuleAction(moduleId, action) {
  return p2p.sendTo(p2p.getHostPeerId(gameState.roomCode), MSG.SUBMIT_MODULE_ACTION, {
    roomCode: gameState.roomCode,
    playerId: gameState.playerId,
    moduleId,
    action
  })
}

// ── Game-specific: Join Request Handler ──────────────────────────────────────

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
    if (payload.isReconnect) {
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

  const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId)
  otherPeers.forEach(otherPeerId => {
    p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId })
  })
}

// ── Game-specific: Module Action Handler ─────────────────────────────────────

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
