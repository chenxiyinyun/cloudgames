/**
 * territory-control 服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。territory 的特殊点是有"持续推进"的权威计时：
 * 领土每 2 个 tick +1 兵、移动兵团按时到达结算、长时间离线玩家被中和。
 * 这些原来跑在 host 客户端的定时器里，现在统一由服务器 tick 驱动，并通过
 * adapter.tick 返回 true 让 roomManager 每个 tick 广播全量状态。
 */
import * as engine from '../../games/territory-control/src/services/gameEngine.js';

export default {
  gameId: 'territory',

  hostOnlyActions: ['SET_MAP_SIZE', 'SET_THEME', 'START_GAME', 'RESTART_GAME', 'END_GAME'],

  createRoom({ hostId, hostName, roomCode }) {
    return engine.createInitialRoom(hostId, hostName, roomCode);
  },

  addPlayer(room, { playerId, playerName }) {
    return engine.addPlayerToRoom(room, playerName, playerId);
  },

  removePlayer(room, playerId) {
    // 进行中标记离线（停产、60s 后中和），大厅里直接移除并重排座位/房主
    return engine.removePlayerFromRoom(room, playerId);
  },

  applyIntent(room, { action, playerId, payload = {} }) {
    switch (action) {
      case 'SET_MAP_SIZE':
        return engine.setMapSize(room, payload.mapSize);
      case 'SET_THEME':
        return engine.setTheme(room, payload.theme);
      case 'START_GAME':
        return engine.startGame(room);
      case 'DISPATCH_UNITS':
        return engine.dispatchUnits(room, playerId, payload.sourceId, payload.targetId, payload.ratio);
      case 'RESTART_GAME':
        return engine.restartGame(room);
      case 'END_GAME':
        return engine.endGame(room);
      default:
        return { error: `未知意图：${action}` };
    }
  },

  // 权威推进：生产 + 移动兵团到达 + 离线中和 + 胜负判定。进行中每 tick 都广播。
  tick(room, now) {
    if (room.phase !== engine.GAME_PHASES.PLAYING) return false;
    engine.tickProduction(room, now);          // 内含 tickMovingTroops + checkVictory
    engine.neutralizeLongOfflinePlayers(room, now);
    return true;
  }
};
