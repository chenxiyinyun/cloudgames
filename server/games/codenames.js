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

export default {
  gameId: 'codenames',

  hostOnlyActions: ['START_GAME', 'NEXT_ROUND'],

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
