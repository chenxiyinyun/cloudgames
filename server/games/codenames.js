/**
 * codenames（截码战）服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。codenames 没有倒计时（阶段全由意图推进），所以不需要 tick。
 * 两个特殊点：
 *   1) 断线暂停/恢复：玩家掉线 → removePlayerFromRoom 在游戏中会把房间置为 PAUSED；
 *      重连（同 playerId 再 JOIN）→ addPlayer 里若全员在线则 resumeGame 恢复到原阶段。
 *   2) 两段投票：提交队伍猜测/拦截猜测后，若 checkNeedTeamVoting 为真则进入 TEAM_VOTING。
 */
import {
  GAME_PHASES,
  createInitialRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  resumeGame,
  canResumeGame,
  startGame,
  submitClues,
  submitTeamGuess,
  submitOpponentGuess,
  submitTeamFinalVote,
  submitOpponentFinalVote,
  checkNeedTeamVoting,
  nextRound,
  resetGame
} from '../../games/codenames/src/services/gameEngine.js';
import { baseRoom, clone } from '../projection.js';
import { action } from '../agentSchema.js';

const guess = { type: 'array', items: 'integer', minItems: 3, maxItems: 3, minimum: 1, maximum: 4 };

const AGENT_GUIDE = {
  gameId: 'codenames',
  name: '截码战',
  path: '/games/codenames/',
  summary: '四人两队，轮流给三项线索，队友按线索猜密码，另一队尝试拦截。',
  rules: [
    '关键词和当前密码只对当前情报官可见。',
    '每轮提交三个 1–4 的整数；以 availableActions 为准，不要猜其他队伍的未公开投票。',
    '房间需满四人才建议开始；Agent 不能自动成为真人。'
  ],
  actions: [
    action('START_GAME', '房主开始游戏，等待或分队阶段且满四人。'),
    action('SUBMIT_CLUES', '当前情报官提交恰好三条互不重复的线索。', { type: 'object', required: ['clues'], properties: { clues: { type: 'array', items: 'string', minItems: 3, maxItems: 3, maxLength: 40 } }, additionalProperties: false }),
    action('SUBMIT_TEAM_GUESS', '加密方非情报官提交三位队伍猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
    action('SUBMIT_OPPONENT_GUESS', '非加密方提交三位拦截猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
    action('SUBMIT_TEAM_VOTE', '需要统一队内猜测时提交最终三位猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
    action('SUBMIT_OPPONENT_VOTE', '需要统一拦截猜测时提交最终三位猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
    action('NEXT_ROUND', '房主在结算后推进下一轮或重新开始。')
  ]
};

function agentActions(room, playerId) {
  const me = room.players.find(player => player.id === playerId);
  if (!me) return [];
  const isHost = room.hostId === playerId;
  const names = [];
  if (isHost && ['waiting', 'assigning_teams'].includes(room.phase) && room.players.length === 4) names.push('START_GAME');
  if (room.phase === 'encrypting' && room.encryptor === playerId) names.push('SUBMIT_CLUES');
  if (room.phase === 'guessing' && room.encryptor !== playerId) names.push(me.team === room.encryptorTeam ? 'SUBMIT_TEAM_GUESS' : 'SUBMIT_OPPONENT_GUESS');
  if (room.phase === 'team_voting') names.push(me.team === room.encryptorTeam ? 'SUBMIT_TEAM_VOTE' : 'SUBMIT_OPPONENT_VOTE');
  if (isHost && (room.phase === 'result' || room.status === 'ended')) names.push('NEXT_ROUND');
  return names.map(name => AGENT_GUIDE.actions.find(item => item.action === name)).filter(Boolean);
}

function projectCodenames(room, playerId) {
  const view = baseRoom(room, playerId);
  const me = room.players.find(player => player.id === playerId);
  const isEncryptor = room.encryptor === playerId;
  Object.assign(view, clone({
    teams: room.teams,
    currentRound: room.currentRound,
    encryptor: room.encryptor,
    encryptorTeam: room.encryptorTeam,
    clues: room.clues,
    usedClues: room.usedClues,
    notes: room.notes,
    roundHistory: room.roundHistory,
    roundResult: room.roundResult,
    winner: room.winner,
    rotationIndex: room.rotationIndex
  }));
  view.whiteKeywords = isEncryptor && me?.team === 'white' ? clone(room.whiteKeywords) : [];
  view.blackKeywords = isEncryptor && me?.team === 'black' ? clone(room.blackKeywords) : [];
  view.currentCode = isEncryptor ? clone(room.currentCode) : [];
  const ownVotes = room.teamVotes?.[me?.team];
  view.teamVotes = {
    white: { player1Guess: null, player2Guess: null, finalGuess: null },
    black: { player1Guess: null, player2Guess: null, finalGuess: null }
  };
  if (me?.team && ownVotes) view.teamVotes[me.team] = clone(ownVotes);
  view.opponentVotes = me?.team && me.team !== room.encryptorTeam
    ? clone(room.opponentVotes)
    : { player1Guess: null, player2Guess: null, finalGuess: null };
  view.opponentGuess = me?.team && me.team !== room.encryptorTeam ? clone(room.opponentGuess) : null;
  return view;
}

export default {
  gameId: 'codenames',

  hostOnlyActions: ['START_GAME', 'NEXT_ROUND'],

  agentGuide: AGENT_GUIDE,

  agentActions,

  project: projectCodenames,

  createRoom({ hostId, hostName, roomCode }) {
    return createInitialRoom(hostId, hostName, roomCode);
  },

  addPlayer(room, { playerId, playerName }) {
    const result = addPlayerToRoom(room, playerName, playerId);
    // 断线重连且全员已回到线上 → 从 PAUSED 恢复到原阶段
    if (result?.reconnected && canResumeGame(room)) {
      resumeGame(room);
    }
    return result;
  },

  removePlayer(room, playerId) {
    // 游戏中掉线会把房间置为 PAUSED（引擎内处理）；大厅里直接移除
    return removePlayerFromRoom(room, playerId);
  },

  applyIntent(room, { action, playerId, payload = {}, now: _now }) {
    switch (action) {
      case 'START_GAME':
        return startGame(room);

      case 'SUBMIT_CLUES':
        return submitClues(room, playerId, payload.clues);

      case 'SUBMIT_TEAM_GUESS': {
        const result = submitTeamGuess(room, playerId, payload.guess);
        if (!result?.error && checkNeedTeamVoting(room)) {
          room.phase = GAME_PHASES.TEAM_VOTING;
        }
        return result;
      }

      case 'SUBMIT_OPPONENT_GUESS': {
        const result = submitOpponentGuess(room, playerId, payload.guess);
        if (!result?.error && checkNeedTeamVoting(room)) {
          room.phase = GAME_PHASES.TEAM_VOTING;
        }
        return result;
      }

      case 'SUBMIT_TEAM_VOTE':
        return submitTeamFinalVote(room, playerId, payload.guess);

      case 'SUBMIT_OPPONENT_VOTE':
        return submitOpponentFinalVote(room, playerId, payload.guess);

      case 'NEXT_ROUND':
        // 结束后再点 = 重开；否则进入下一轮
        return room.status === GAME_PHASES.ENDED ? resetGame(room) : nextRound(room);

      default:
        return { error: `未知意图：${action}` };
    }
  }
};
