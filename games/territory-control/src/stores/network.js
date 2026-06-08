import {
  addPlayerToRoom,
  dispatchUnits,
  removePlayerFromRoom
} from '../services/gameEngine'
import p2p from '../services/p2p'
import { createLogger } from '../services/logger'
import {
  MSG,
  cleanupOps,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  deepClone,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp,
  resetOps
} from '../services/online'
import { createDedupeHandler } from '../../../../src/shared/online/dedupeHandler'
import { createNetworkLayer } from '../../../../src/shared/online/createNetworkLayer'
import { GAME_PHASES } from '../services/gameEngine'
import { gameState, getRoom, setConnectionStatus, setRoom, updateLocalState } from './state'
import { clearJoinTimeout, startProductionTimer, stopJoinRetry, stopProductionTimer } from './timers'

const log = createLogger('Territory:Network')

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

const net = createNetworkLayer({
  gameId: 'territory',
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
  isLobbyPhase: room => room?.phase === GAME_PHASES.WAITING || room?.status === GAME_PHASES.WAITING,

  hostMigratorOptions: {
    onBecomeHost: () => {
      if (getRoom()?.phase === GAME_PHASES.PLAYING) {
        startProductionTimer(() => broadcastState())
      }
    },
    // 迁移时把当前 peer 销毁并以 host 身份重新注册,
    // 确保信令上能查到 ${gameId}-${roomCode},新玩家加入才能成功
    rebuildHostPeer: async () => {
      await p2p.recreateAsHost(gameState.roomCode, gameState.playerName)
    }
  },

  handleJoinRequest: (payload, peerId) => {
    handleJoinRequest(payload, peerId)
  },

  handleHostBusinessMessage: (type, payload, peerId, ctx) => {
    if (type === MSG.DISPATCH_UNITS) {
      const sender = ctx.room.players.find(p => p._peerId === peerId)
      if (!sender || sender.id !== payload.playerId) {
        log.warn('Rejecting dispatch: playerId does not match sender peer', {
          peerId,
          claimedPlayerId: payload.playerId,
          actualPlayerId: sender?.id
        })
        return
      }
      withDedupe(MSG.DISPATCH_UNITS, payload, peerId,
        () => handleRemoteDispatch(payload),
        { dupeMessage: '请勿重复派遣' }
      )
    }
  },

  onGuestJoinRejected: () => {
    stopJoinRetry()
    clearJoinTimeout()
  },

  onGuestJoinAccepted: payload => {
    stopJoinRetry()
    clearJoinTimeout()
    if (payload.reconnected && payload.originalPlayerId && payload.originalPlayerId !== gameState.playerId) {
      gameState.playerId = payload.originalPlayerId
    }
  },

  onGuestConnected: () => {
    gameState.screen = 'lobby'
  },

  onRoomStateReceived: payload => {
    if (payload.error) {
      gameState.error = payload.error
    }
  },

  cleanupExtra: () => {
    roomBroadcaster.resetBroadcastState()
  }
})

export const setupHostHandlers = net.setupHostHandlers
export const setupGuestHandlers = net.setupGuestHandlers
export const hostMigrator = net.hostMigrator
export const RECONNECT_METADATA = net.RECONNECT_METADATA
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

export function sendDispatchAction(sourceId, targetId, ratio, seq) {
  return p2p.sendTo(p2p.getHostPeerId(gameState.roomCode), MSG.DISPATCH_UNITS, {
    roomCode: gameState.roomCode,
    playerId: gameState.playerId,
    sourceId,
    targetId,
    ratio,
    seq
  })
}

function handleJoinRequest(payload, peerId) {
  const room = getRoom()
  const originalPeerId = payload.originalPeerId || peerId

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
      p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, room: deepClone(room) })
      return
    }
  }

  const existingByPlayerId = room?.players.find(p => p.id === payload.playerId)

  if (existingByPlayerId && !existingByPlayerId.isOnline) {
    existingByPlayerId.isOnline = true
    existingByPlayerId._peerId = originalPeerId
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== payload.playerId)
    }
    broadcastState()
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
      success: true,
      reconnected: true,
      originalPlayerId: payload.playerId,
      room: deepClone(room)
    })
    return
  }

  if (existingByPlayerId && existingByPlayerId.isOnline) {
    if (payload.isReconnect) {
      existingByPlayerId.name = payload.playerName
      existingByPlayerId._peerId = originalPeerId
    }
    broadcastState({ forceFull: true })
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, room: deepClone(room) })
    return
  }

  const existingByName = room?.players.find(p => p.name === payload.playerName && !p.isOnline)
  if (existingByName) {
    existingByName.isOnline = true
    existingByName._peerId = originalPeerId
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== existingByName.id)
    }
    broadcastState()
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
      success: true,
      reconnected: true,
      originalPlayerId: existingByName.id,
      room: deepClone(room)
    })
    return
  }

  const existingOnlineByName = room?.players.find(p => p.name === payload.playerName && p.isOnline)
  if (existingOnlineByName) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '该名字的玩家已在线' })
    return
  }

  if (room?.phase !== GAME_PHASES.WAITING) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '战局已经开始，无法加入' })
    return
  }

  const result = addPlayerToRoom(room, payload.playerName, payload.playerId)
  if (result.error) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error })
    return
  }

  const player = room.players.find(candidate => candidate.id === payload.playerId)
  if (player) {
    player._peerId = originalPeerId
  }

  broadcastState()
  p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, room: deepClone(room) })

  const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId)
  otherPeers.forEach(otherPeerId => {
    p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId })
  })
}

function handleRemoteDispatch(payload) {
  const room = getRoom()
  const result = dispatchUnits(room, payload.playerId, payload.sourceId, payload.targetId, payload.ratio)
  if (result.error) return result
  if (room.phase === GAME_PHASES.ENDED) {
    stopProductionTimer()
  }
  return {}
}
