import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../../../../src/shared/online'

export const GAME_ID = 'territory'

export const MSG = createMessageTypes({
  START_GAME: 'START_GAME',
  SET_MAP_SIZE: 'SET_MAP_SIZE',
  DISPATCH_UNITS: 'DISPATCH_UNITS',
  RESTART_GAME: 'RESTART_GAME',
  END_GAME: 'END_GAME'
})

function makeTerritoryOpKey(type, payload = {}, roomCode = '') {
  const rc = payload.roomCode || roomCode || ''
  const playerId = payload.playerId || ''
  switch (type) {
    case MSG.DISPATCH_UNITS:
      return `${type}_${rc}_${playerId}_${payload.sourceId}_${payload.targetId}_${payload.ratio}_${payload.seq || ''}`
    case MSG.SET_MAP_SIZE:
      return `${type}_${rc}_${payload.mapSize || ''}_${payload.at || ''}`
    case MSG.START_GAME:
    case MSG.RESTART_GAME:
    case MSG.END_GAME:
      return `${type}_${rc}_${playerId}_${payload.at || ''}`
    case MSG.JOIN_REQUEST:
      return `${type}_${rc}_${playerId}_${payload.isReconnect ? 'reconnect' : 'new'}`
    case MSG.ROOM_STATE:
      return `${type}_${rc}_${payload.detail || ''}`
    default:
      return `${type}_${rc}_${playerId}`
  }
}

const deduper = createOperationDeduper({ makeKey: makeTerritoryOpKey })

export const generateOpKey = deduper.generateOpKey
export const isDuplicateOp = deduper.isDuplicateOp
export const cleanupOps = deduper.cleanupOps
export const resetOps = deduper.resetOps
export { deepClone }

export function getRoomStateDedupeDetail(room) {
  const gs = room.gameState || {}
  const mt = gs.movingTroops?.map(t => `${t.id}:${t.playerId}:${t.amount}:${t.currentStep}`).join(',') || ''
  return `${room.phase || ''}_${gs.winnerId || ''}_${gs.territories?.map(t => `${t.id}:${t.ownerId || 'n'}:${t.units}`).join('|') || ''}_mt:${mt}`
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
