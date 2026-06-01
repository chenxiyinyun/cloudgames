import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../../../../src/shared/online';

export const GAME_ID = 'codenames';

export const MSG = createMessageTypes({
  START_GAME: 'START_GAME',
  SUBMIT_CLUES: 'SUBMIT_CLUES',
  SUBMIT_TEAM_GUESS: 'SUBMIT_TEAM_GUESS',
  SUBMIT_OPPONENT_GUESS: 'SUBMIT_OPPONENT_GUESS',
  SUBMIT_OPPONENT_VOTE: 'SUBMIT_OPPONENT_VOTE',
  SUBMIT_TEAM_VOTE: 'SUBMIT_TEAM_VOTE',
  NEXT_ROUND: 'NEXT_ROUND',
  RESUME_GAME: 'RESUME_GAME'
});

function makeCodenamesOpKey(type, payload = {}, roomCode = '') {
  const rc = payload.roomCode || roomCode || '';
  const playerId = payload.playerId || '';

  switch (type) {
    case MSG.SUBMIT_CLUES:
      return `${type}_${rc}_${playerId}_${(payload.clues || []).join(',')}`;
    case MSG.SUBMIT_TEAM_GUESS:
    case MSG.SUBMIT_OPPONENT_GUESS:
    case MSG.SUBMIT_TEAM_VOTE:
    case MSG.SUBMIT_OPPONENT_VOTE:
      return `${type}_${rc}_${playerId}_${(payload.guess || []).join(',')}`;
    case MSG.START_GAME:
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

const deduper = createOperationDeduper({ makeKey: makeCodenamesOpKey });

export const generateOpKey = deduper.generateOpKey;
export const isDuplicateOp = deduper.isDuplicateOp;
export const cleanupOps = deduper.cleanupOps;
export const resetOps = deduper.resetOps;
export { deepClone };

export function getRoomStateDedupeDetail(room) {
  // 细粒度去重 detail：同一 round+phase 内，玩家上下线、队伍变化、
  // 线索/投票进度变化都必须产生不同的 key，否则有效状态更新会被误丢。
  const playerState = (room.players || [])
    .map(player => [
      player.id,
      player.isOnline === false ? '0' : '1',
      player.team || ''
    ].join(':'))
    .join(',');

  const finalVotes = [
    room.teamVotes?.white?.finalGuess ? 'w' : '',
    room.teamVotes?.black?.finalGuess ? 'b' : '',
    room.opponentVotes?.finalGuess ? 'o' : ''
  ].join('');

  return [
    room.currentRound || 0,
    room.phase || '',
    room.status || '',
    room.winner || '',
    playerState,
    room.clues?.length || 0,
    finalVotes,
    room.disconnectedPlayers?.length || 0
  ].join('_');
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
      round: room.currentRound,
      phase: room.phase
    })
  });
}
