/**
 * 房主消息处理 — 处理访客发来的各类 P2P 消息
 */
import p2p from './p2p';
import { createLogger } from './logger';
import { generateOpKey, isDuplicateOp, cleanupOps } from './useIdempotency';
import {
  GAME_PHASES,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess, submitTeamFinalVote,
  checkNeedTeamVoting, nextRound, resetGame,
  addPlayerToRoom, removePlayerFromRoom, canResumeGame, resumeGame
} from './gameEngine';

const log = createLogger('HostHandler');

const MSG = {
  JOIN_REQUEST: 'JOIN_REQUEST',
  START_GAME: 'START_GAME',
  SUBMIT_CLUES: 'SUBMIT_CLUES',
  SUBMIT_TEAM_GUESS: 'SUBMIT_TEAM_GUESS',
  SUBMIT_OPPONENT_GUESS: 'SUBMIT_OPPONENT_GUESS',
  SUBMIT_TEAM_VOTE: 'SUBMIT_TEAM_VOTE',
  NEXT_ROUND: 'NEXT_ROUND',
  ROOM_STATE: 'ROOM_STATE'
};

/**
 * 设置房主端的事件处理
 * @param {object} cachedRoom - 可变的房间状态引用
 * @param {function} broadcastState - 广播状态
 * @param {object} gameState - 游戏全局状态（用于设置连接状态等）
 * @param {function} setConnectionStatus - 设置连接状态
 */
export function setupHostHandlers(cachedRoom, broadcastState, gameState, setConnectionStatus) {
  p2p.onPlayerConnected = (conn) => {
    log.info('Player connected:', conn.peer);
    if (cachedRoom) {
      setTimeout(() => {
        p2p.sendTo(conn.peer, MSG.ROOM_STATE, { room: cachedRoom });
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer);
        if (otherPeers.length > 0) {
          p2p.sendTo(conn.peer, 'PEER_LIST', { peers: otherPeers });
        }
      }, 500);
    }
  };

  p2p.onPlayerDisconnected = (peerId) => {
    log.info('Player disconnected:', peerId);
    const playerToRemove = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToRemove && cachedRoom) {
      removePlayerFromRoom(cachedRoom, playerToRemove.id);
      broadcastState();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleHostMessage(data, peerId, cachedRoom, broadcastState, gameState);
  };

  p2p.onError = (err) => {
    log.error('Host error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Host detected dead peer', { peerId });
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push(playerToMark);
      }
      broadcastState();
    }
  };
}

function handleHostMessage(data, peerId, cachedRoom, broadcastState, gameState) {
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        log.info('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect }, cachedRoom?.code);
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        const existingPlayer = cachedRoom?.players.find(p => p.id === playerId);
        if (existingPlayer && !existingPlayer.isOnline) {
          existingPlayer.isOnline = true;
          existingPlayer._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }
          if (canResumeGame(cachedRoom)) {
            resumeGame(cachedRoom);
          }
          broadcastState();
          p2p.sendTo(peerId, 'JOIN_RESPONSE', { success: true, reconnected: true });
          return;
        }

        const result = addPlayerToRoom(cachedRoom, playerName, playerId);
        if (result.error) {
          p2p.sendTo(peerId, 'JOIN_RESPONSE', { success: false, error: result.error });
          return;
        }
        const player = cachedRoom.players.find(p => p.id === playerId);
        if (player) {
          player._peerId = originalPeerId || peerId;
        }
        broadcastState();

        const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
        otherPeers.forEach(otherPeerId => {
          p2p.sendTo(otherPeerId, 'CONNECT_TO_PEER', { peerId: originalPeerId || peerId });
        });
        break;
      } catch (err) {
        log.error('handleHostMessage:JOIN_REQUEST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.START_GAME: {
      try {
        if (data.payload.playerId !== cachedRoom.hostId) return;
        const startKey = generateOpKey(MSG.START_GAME, { playerId: data.payload.playerId }, cachedRoom?.code);
        if (isDuplicateOp(startKey)) {
          log.debug('Duplicate START_GAME ignored', { key: startKey });
          broadcastState();
          return;
        }
        startGame(cachedRoom);
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:START_GAME error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_CLUES: {
      try {
        const cluesKey = generateOpKey(MSG.SUBMIT_CLUES, { playerId: data.payload.playerId, clues: data.payload.clues }, cachedRoom?.code);
        if (isDuplicateOp(cluesKey)) {
          log.debug('Duplicate SUBMIT_CLUES ignored', { key: cluesKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交线索' });
          return;
        }
        const result = submitClues(cachedRoom, data.payload.playerId, data.payload.clues);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_CLUES error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_TEAM_GUESS: {
      try {
        const teamGuessKey = generateOpKey(MSG.SUBMIT_TEAM_GUESS, { playerId: data.payload.playerId, guess: data.payload.guess }, cachedRoom?.code);
        if (isDuplicateOp(teamGuessKey)) {
          log.debug('Duplicate SUBMIT_TEAM_GUESS ignored', { key: teamGuessKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交猜测' });
          return;
        }
        const result = submitTeamGuess(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        if (checkNeedTeamVoting(cachedRoom)) {
          cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_TEAM_GUESS error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_OPPONENT_GUESS: {
      try {
        const oppGuessKey = generateOpKey(MSG.SUBMIT_OPPONENT_GUESS, { playerId: data.payload.playerId, guess: data.payload.guess }, cachedRoom?.code);
        if (isDuplicateOp(oppGuessKey)) {
          log.debug('Duplicate SUBMIT_OPPONENT_GUESS ignored', { key: oppGuessKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交拦截' });
          return;
        }
        const result = submitOpponentGuess(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_OPPONENT_GUESS error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_TEAM_VOTE: {
      try {
        const voteKey = generateOpKey(MSG.SUBMIT_TEAM_VOTE, { playerId: data.payload.playerId, guess: data.payload.guess }, cachedRoom?.code);
        if (isDuplicateOp(voteKey)) {
          log.debug('Duplicate SUBMIT_TEAM_VOTE ignored', { key: voteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交投票' });
          return;
        }
        const result = submitTeamFinalVote(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_TEAM_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.NEXT_ROUND: {
      try {
        if (data.payload.playerId !== cachedRoom.hostId) return;
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: data.payload.playerId }, cachedRoom?.code);
        if (isDuplicateOp(nextRoundKey)) {
          log.debug('Duplicate NEXT_ROUND ignored', { key: nextRoundKey });
          broadcastState();
          return;
        }
        if (cachedRoom.status === GAME_PHASES.ENDED) {
          resetGame(cachedRoom);
        } else {
          nextRound(cachedRoom);
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:NEXT_ROUND error', { type: data?.type, peerId, error: err });
        break;
      }
    }
    }
  } catch (err) {
    log.error('handleHostMessage error', { type: data?.type, peerId, error: err });
  }
}
