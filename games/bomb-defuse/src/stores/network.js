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
  getRoomStateDedupeDetail,
  isDuplicateOp
} from '../services/online'
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

export function sendJoinRequest(playerId, playerName, isReconnect = false) {
  return sendJoinRequestBase(playerId, playerName, isReconnect)
}

export function broadcastState(options = {}) {
  const room = getRoom()
  if (!room) return null
  return roomBroadcaster.broadcastState({
    forceFull: options.forceFull ?? true,
    error: options.error || null
  })
}

export function resetBroadcastState() {
  roomBroadcaster.resetBroadcastState()
}

export function sendModuleAction(moduleId, action) {
  return p2p.broadcast(MSG.SUBMIT_MODULE_ACTION, {
    roomCode: gameState.roomCode,
    playerId: gameState.playerId,
    moduleId,
    action
  })
}

export function setupHostHandlers() {
  p2p.onMessage = handleHostMessage
  p2p.onPlayerDisconnected = peerId => {
    const room = getRoom()
    const player = room?.players?.find(candidate => candidate._peerId === peerId)
    if (!room || !player) return
    removePlayerFromRoom(room, player.id)
    broadcastState()
  }
}

export function setupGuestHandlers() {
  p2p.onMessage = handleGuestMessage
}

export function handleHostMessage(data, peerId) {
  const type = data?.type
  const payload = data?.payload || {}
  const room = getRoom()

  if (!room) return

  switch (type) {
    case MSG.JOIN_REQUEST:
      handleJoinRequest(payload, peerId)
      break
    case MSG.SUBMIT_MODULE_ACTION:
      if (isDuplicateOp(type, payload, room.code)) return
      handleRemoteModuleAction(payload)
      break
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
      setConnectionStatus('connected', 'Mission joined.')
      setRoom(payload.room)
      updateLocalState(payload.room)
      break
    case MSG.ROOM_STATE:
      applyRoomStatePayload(payload)
      break
    default:
      log.debug('Unhandled guest message', { type })
  }
}

function handleJoinRequest(payload, peerId) {
  const room = getRoom()
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
    player._peerId = payload.originalPeerId || peerId
  }

  p2p.sendTo(peerId, MSG.JOIN_RESPONSE, {
    success: true,
    room: deepClone(room)
  })
  broadcastState()
}

function handleRemoteModuleAction(payload) {
  const room = getRoom()
  const result = submitModuleAction(room, payload.playerId, payload.moduleId, payload.action)
  if (result.error) {
    broadcastState({ error: result.error })
    return
  }

  if (room.phase === 'exploded' || room.phase === 'solved') {
    stopCountdownTimer()
  }
  broadcastState()
}

function applyRoomStatePayload(payload) {
  const currentRoom = getRoom()
  const nextRoom = payload.room
    ? payload.room
    : { ...currentRoom, ...payload.delta }

  setRoom(nextRoom)
  updateLocalState(nextRoom)
}
