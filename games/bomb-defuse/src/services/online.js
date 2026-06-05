import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../../../../src/shared/online'

export const GAME_ID = 'bombdefuse'

export const MSG = createMessageTypes({
  START_GAME: 'START_GAME',
  ASSIGN_ROLE: 'ASSIGN_ROLE',
  SUBMIT_MODULE_ACTION: 'SUBMIT_MODULE_ACTION',
  TICK_TIMER: 'TICK_TIMER',
  END_GAME: 'END_GAME',
  RESTART_GAME: 'RESTART_GAME',
  REQUEST_STATE: 'REQUEST_STATE'
})

function makeBombDefuseOpKey(type, payload = {}, roomCode = '') {
  const rc = payload.roomCode || roomCode || ''
  const playerId = payload.playerId || ''

  switch (type) {
    case MSG.SUBMIT_MODULE_ACTION:
      return `${type}_${rc}_${playerId}_${payload.moduleId}_${JSON.stringify(payload.action || {})}`
    case MSG.START_GAME:
    case MSG.ASSIGN_ROLE:
    case MSG.END_GAME:
    case MSG.RESTART_GAME:
    case MSG.REQUEST_STATE:
      return `${type}_${rc}_${playerId}_${payload.at || ''}`
    case MSG.JOIN_REQUEST:
      return `${type}_${rc}_${playerId}_${payload.isReconnect ? 'reconnect' : 'new'}`
    case MSG.ROOM_STATE:
      return `${type}_${rc}_${payload.detail || ''}`
    default:
      return `${type}_${rc}_${playerId}`
  }
}

const deduper = createOperationDeduper({ makeKey: makeBombDefuseOpKey })

export const generateOpKey = deduper.generateOpKey
export const isDuplicateOp = deduper.isDuplicateOp
export const cleanupOps = deduper.cleanupOps
export const resetOps = deduper.resetOps
export { deepClone }

export function getRoomStateDedupeDetail(room) {
  const gs = room.gameState || {}
  return `${room.phase || ''}_${gs.strikes?.length || 0}_${gs.solvedModuleIds?.length || 0}_${room.updatedAt || 0}`
}

export function createJoinRequestSenderForGame({ p2p, getRoomCode, logger }) {
  return createJoinRequestSender({
    p2p,
    gameId: GAME_ID,
    getRoomCode,
    logger,
    joinRequestType: MSG.JOIN_REQUEST
  })
}

export function createRoomBroadcasterForGame({ p2p, getRoom, updateLocalState }) {
  return createRoomBroadcaster({
    p2p,
    getRoom,
    updateLocalState,
    roomStateType: MSG.ROOM_STATE,
    getDeltaMeta: room => ({
      phase: room.phase,
      status: room.status
    })
  })
}
