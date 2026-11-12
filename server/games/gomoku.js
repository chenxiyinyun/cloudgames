/**
 * gomoku（五子棋）服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。五子棋是回合制游戏，唯一的“权威计时”是回合落子限时：
 * adapter.tick 在当前回合超时未落子时判负，并返回 true 让 roomManager 广播。
 * 断线不暂停对局：对局中掉线标记离线，轮到离线方时计时自然判负；重连恢复在线。
 */
import * as engine from '../../games/gomoku/src/services/gameEngine.js';

export default {
  gameId: 'gomoku',

  hostOnlyActions: ['START_GAME', 'RESTART_GAME', 'END_GAME'],

  createRoom({ hostId, hostName, roomCode }) {
    return engine.createInitialRoom(hostId, hostName, roomCode);
  },

  addPlayer(room, { playerId, playerName }) {
    return engine.addPlayerToRoom(room, playerName, playerId);
  },

  removePlayer(room, playerId) {
    return engine.removePlayerFromRoom(room, playerId);
  },

  applyIntent(room, { action, playerId, payload = {}, now }) {
    switch (action) {
      case 'START_GAME':
        return engine.startGame(room, now);

      case 'PLACE_STONE':
        return engine.placeStone(room, playerId, payload.row, payload.col, now);

      case 'RESIGN':
        return engine.resign(room, playerId);

      case 'END_GAME':
        return engine.endGame(room);

      case 'RESTART_GAME':
        return engine.restartGame(room, now);

      default:
        return { error: `未知意图：${action}` };
    }
  },

  // 权威推进：回合落子限时。超时判负并返回 true 触发广播。
  tick(room, now) {
    return engine.tickTurnDeadline(room, now);
  }
};
