import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../../../../src/shared/online';

export const GAME_ID = 'catguess';

export const MSG = createMessageTypes({
  SUBMIT_STORY: 'SUBMIT_STORY',
  SUBMIT_CARD: 'SUBMIT_CARD',
  SUBMIT_VOTE: 'SUBMIT_VOTE',
  NEXT_ROUND: 'NEXT_ROUND'
});

function makeCatguessOpKey(type, payload = {}, roomCode = '') {
  const rc = payload.roomCode || roomCode || '';
  const playerId = payload.playerId || '';

  switch (type) {
    case MSG.SUBMIT_STORY:
      return `${type}_${rc}_${playerId}_${payload.cardIndex}_${payload.clue}`;
    case MSG.SUBMIT_CARD:
      return `${type}_${rc}_${playerId}_${payload.cardIndex}`;
    case MSG.SUBMIT_VOTE:
      return `${type}_${rc}_${playerId}_${payload.votedCardId}`;
    case MSG.NEXT_ROUND:
      return `${type}_${rc}_${playerId}`;
    case MSG.JOIN_REQUEST:
      return `${type}_${rc}_${playerId}_${payload.isReconnect ? 'reconnect' : 'new'}`;
    case MSG.ROOM_STATE:
      return `${type}_${rc}_${payload.detail || ''}`;
    default:
      return `${type}_${rc}_${playerId}`;
  }
}

const deduper = createOperationDeduper({ makeKey: makeCatguessOpKey });

export const generateOpKey = deduper.generateOpKey;
export const isDuplicateOp = deduper.isDuplicateOp;
export const cleanupOps = deduper.cleanupOps;
export const resetOps = deduper.resetOps;
export { deepClone };

export function getRoomStateDedupeDetail(room) {
  return `${room.gameState?.round}_${room.phase}`;
}

export function createJoinRequestSenderForGame({ p2p, getRoomCode, logger }) {
  return createJoinRequestSender({
    p2p,
    gameId: GAME_ID,
    getRoomCode,
    logger,
    joinRequestType: MSG.JOIN_REQUEST
  });
}

export function createRoomBroadcasterForGame({ p2p, getRoom, updateLocalState }) {
  return createRoomBroadcaster({
    p2p,
    getRoom,
    updateLocalState,
    roomStateType: MSG.ROOM_STATE,
    getDeltaMeta: room => ({
      round: room.gameState?.round,
      phase: room.phase
    })
  });
}
