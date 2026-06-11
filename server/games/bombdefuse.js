/**
 * bomb-defuse 服务器适配器。
 *
 * 直接复用客户端的纯函数游戏引擎（gameEngine.js 已在 node 环境下被测试覆盖，
 * 不含任何浏览器/Vue/联网层依赖），服务器作为权威跑同一套逻辑。
 * 新增其它游戏 = 再写一个这样的适配器即可。
 */
import * as engine from '../../games/bomb-defuse/src/services/gameEngine.js';

export default {
  gameId: 'bombdefuse',

  // 房主专属意图：只有 room.hostId 能触发（roomManager 统一校验）
  hostOnlyActions: ['START_GAME', 'SET_DIFFICULTY', 'RESTART', 'ASSIGN_ROLES', 'END_GAME'],

  createRoom({ hostId, hostName, roomCode }) {
    return engine.createInitialRoom(hostId, hostName, roomCode);
  },

  addPlayer(room, { playerId, playerName }) {
    return engine.addPlayerToRoom(room, playerName, playerId);
  },

  removePlayer(room, playerId) {
    return engine.removePlayerFromRoom(room, playerId);
  },

  applyIntent(room, { action, playerId, payload = {}, now: _now }) {
    switch (action) {
      case 'START_GAME':
        return engine.startGame(room);
      case 'SET_DIFFICULTY':
        return engine.setRoomDifficulty(room, payload.difficulty);
      case 'SUBMIT_MODULE_ACTION':
        return engine.submitModuleAction(room, playerId, payload.moduleId, payload.action);
      case 'RESTART':
        return engine.restartGame(room);
      case 'ASSIGN_ROLES':
        return engine.assignRoles(room, payload.roleByPlayerId);
      case 'END_GAME': {
        room.status = engine.GAME_PHASES.ENDED;
        room.phase = engine.GAME_PHASES.ENDED;
        room.gameState.result = 'ended';
        room.updatedAt = Date.now();
        return { room };
      }
      default:
        return { error: `未知意图：${action}` };
    }
  },

  // 服务器权威计时：每个 tick 检查倒计时/胜负。返回的 phase 变化由 roomManager 决定是否广播。
  tick(room, now) {
    if (room.phase === engine.GAME_PHASES.PLAYING) {
      engine.checkEndCondition(room, now);
    }
  }
};
