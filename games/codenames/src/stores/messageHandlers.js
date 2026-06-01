import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  GAME_PHASES,
  addPlayerToRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess,
  submitOpponentFinalVote, submitTeamFinalVote,
  checkNeedTeamVoting, nextRound, resetGame,
  resumeGame, canResumeGame
} from '../services/gameEngine';
import {
  MSG,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp
} from '../services/online';
import { showToast } from '../components/ToastNotification.vue';
import { gameState, getRoom, setRoom, updateLocalState, setConnectionStatus } from './roomState';
import { stopJoinRetry } from './timers';
// 注意：与 connection.js 形成 import 环，但仅在函数体内（调用时）引用，ES module 可容忍。
import { broadcastState, cleanup, hostMigrator } from './connection';

const log = createLogger('GameStore');

export function handleHostMessage(data, peerId) {
  const cachedRoom = getRoom();
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        // Idempotency: skip duplicate join requests
        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect });
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        // 检查是否是断线重连
        const existingPlayer = cachedRoom?.players.find(p => p.id === playerId);
        if (existingPlayer && !existingPlayer.isOnline) {
          // 断线重连
          existingPlayer.isOnline = true;
          existingPlayer._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }

          // 检查是否可以恢复游戏
          if (canResumeGame(cachedRoom)) {
            resumeGame(cachedRoom);
          }

          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true });
          return;
        }

        const result = addPlayerToRoom(cachedRoom, playerName, playerId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error });
          return;
        }
        const player = cachedRoom.players.find(p => p.id === playerId);
        if (player) {
          player._peerId = originalPeerId || peerId;
        }
        broadcastState();

        // 通知其他访客连接到新玩家
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
        otherPeers.forEach(otherPeerId => {
          p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId || peerId });
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
        // Idempotency: skip duplicate start game
        const startKey = generateOpKey(MSG.START_GAME, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
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
        // Idempotency: skip duplicate clue submission
        const cluesKey = generateOpKey(MSG.SUBMIT_CLUES, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, clues: data.payload.clues });
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
        // Idempotency: skip duplicate team guess
        const teamGuessKey = generateOpKey(MSG.SUBMIT_TEAM_GUESS, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
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
        // 检查是否需要进入投票阶段
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
        // Idempotency: skip duplicate opponent guess
        const oppGuessKey = generateOpKey(MSG.SUBMIT_OPPONENT_GUESS, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
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
        if (checkNeedTeamVoting(cachedRoom)) {
          cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_OPPONENT_GUESS error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_OPPONENT_VOTE: {
      try {
        const oppVoteKey = generateOpKey(MSG.SUBMIT_OPPONENT_VOTE, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
        if (isDuplicateOp(oppVoteKey)) {
          log.debug('Duplicate SUBMIT_OPPONENT_VOTE ignored', { key: oppVoteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交投票' });
          return;
        }
        const result = submitOpponentFinalVote(cachedRoom, data.payload.playerId, data.payload.guess);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_OPPONENT_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_TEAM_VOTE: {
      try {
        // Idempotency: skip duplicate team vote
        const voteKey = generateOpKey(MSG.SUBMIT_TEAM_VOTE, { playerId: data.payload.playerId, roomCode: cachedRoom?.code, guess: data.payload.guess });
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
        // Idempotency: skip duplicate next round
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
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

export function handleGuestMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.ROOM_STATE: {
      try {
        if (data.payload.room) {
          // Idempotency: skip duplicate room state updates
          const room = data.payload.room;
          const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: getRoomStateDedupeDetail(room) });
          if (isDuplicateOp(roomStateKey)) {
            log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
            break;
          }
          setRoom(data.payload.room);
          updateLocalState(getRoom());
          // 房主已响应，停止加入重发循环与超时兜底
          stopJoinRetry();
          if (data.payload.error) {
            showToast(data.payload.error, 'warning');
          }
          if (!gameState.connected) {
            gameState.connected = true;
            setConnectionStatus('connected', '已连接');
            gameState.screen = 'lobby';
          }
        } else if (data.payload.delta) {
          // Merge delta into local cachedRoom
          const delta = data.payload.delta;
          const room = getRoom();
          if (!room) {
            log.warn('Delta received but no cachedRoom', { peerId });
            break;
          }
          Object.keys(delta).forEach(key => {
            room[key] = delta[key];
          });
          updateLocalState(room);
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:ROOM_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.JOIN_RESPONSE: {
      try {
        if (data.payload.success === false) {
          stopJoinRetry();
          gameState.error = data.payload.error || '加入房间失败';
          setConnectionStatus('error', data.payload.error || '加入房间失败');
          cleanup();
          gameState.screen = 'menu';
        } else if (data.payload.reconnected) {
          stopJoinRetry();
          gameState.connected = true;
          setConnectionStatus('connected', '重连成功');
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:JOIN_RESPONSE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.PEER_LIST: {
      try {
        // 收到 peer 列表，尝试连接到其他访客
        const { peers } = data.payload;
        console.log('Received peer list:', peers);
        if (peers && peers.length > 0) {
          peers.forEach(async (targetPeerId) => {
            try {
              await p2p.connectToPeer(targetPeerId);
              console.log('Connected to peer:', targetPeerId);
            } catch (err) {
              console.error('Failed to connect to peer:', targetPeerId, err);
            }
          });
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.HOST_MIGRATION: {
      try {
        // 房主迁移通知
        const { newHostId, newHostPeerId, room } = data.payload;
        console.log('Host migration to:', newHostId);

        if (newHostId === gameState.playerId) {
          // 我已经是新房主了，不需要处理
          break;
        }

        // Migration resolved by peer — clear the mutex
        hostMigrator.resetMigrationMutex();
        log.info('Host migration resolved by peer', { newHostId });

        // 更新房间状态
        setRoom(room);
        updateLocalState(getRoom());

        // 连接到新房主（异步处理，不阻塞消息处理）
        p2p.connectToPeer(newHostPeerId).then(() => {
          setConnectionStatus('connected', '已连接到新房主');
          gameState.connected = true;
        }).catch((err) => {
          console.error('Failed to connect to new host:', err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.CONNECT_TO_PEER: {
      try {
        // 被要求连接到指定 peer
        const { peerId: targetPeerId } = data.payload;
        p2p.connectToPeer(targetPeerId).catch((err) => {
          console.error('Failed to connect to peer:', targetPeerId, err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:CONNECT_TO_PEER error', { type: data?.type, peerId, error: err });
        break;
      }
    }
  }
  } catch (err) {
    log.error('handleGuestMessage error', { type: data?.type, peerId, error: err });
  }
}
