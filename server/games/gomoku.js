/**
 * gomoku（五子棋）服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。五子棋是回合制游戏，唯一的“权威计时”是回合落子限时：
 * adapter.tick 在当前回合超时未落子时判负，并返回 true 让 roomManager 广播。
 * 断线不暂停对局：对局中掉线标记离线，轮到离线方时计时自然判负；重连恢复在线。
 */
import * as engine from '../../games/gomoku/src/services/gameEngine.js';
import { baseRoom, clone } from '../projection.js';
import { action, field } from '../agentSchema.js';

const AGENT_GUIDE = {
  gameId: 'gomoku',
  name: '五子棋',
  path: '/games/gomoku/',
  summary: '双人对弈，黑棋先行，先把 5 颗棋子连成一线（横/竖/斜）者获胜。',
  rules: [
    'board 为 15×15 的二维数组（0 空、1 黑、2 白），行/列下标均为 0–14。',
    '只在自己的回合（room.currentTurn 与你的 role 相同）落子；每手限时 60 秒，超时判负。',
    'moveHistory 记录全部落子；winner / winningLine / endReason 表示终局原因。'
  ],
  actions: [
    action('START_GAME', '房主在两名玩家在线时开始。'),
    action('PLACE_STONE', '当前回合玩家落子。', { type: 'object', required: ['row', 'col'], properties: { row: field('integer', { minimum: 0, maximum: 14 }), col: field('integer', { minimum: 0, maximum: 14 }) }, additionalProperties: false }),
    action('RESIGN', '对局中认输，对方获胜。'),
    action('RESTART_GAME', '房主在结束后交换先后手重新开始。'),
    action('END_GAME', '房主提前结束对局。')
  ]
};

function agentActions(room, playerId) {
  const me = room.players.find(player => player.id === playerId);
  if (!me) return [];
  const isHost = room.hostId === playerId;
  const names = [];
  if (isHost && room.phase === 'waiting' && room.players.length === 2) names.push('START_GAME');
  if (room.phase === 'playing' && me.isOnline) {
    if (me.role === room.currentTurn) names.push('PLACE_STONE');
    names.push('RESIGN');
  }
  if (isHost && room.phase === 'playing') names.push('END_GAME');
  if (isHost && room.phase === 'ended') names.push('RESTART_GAME', 'END_GAME');
  return names.map(name => AGENT_GUIDE.actions.find(item => item.action === name)).filter(Boolean);
}

export default {
  gameId: 'gomoku',

  hostOnlyActions: ['START_GAME', 'RESTART_GAME', 'END_GAME'],

  agentGuide: AGENT_GUIDE,

  agentActions,

  // 五子棋没有隐藏信息：棋盘、回合与计时对双方公开
  project(room, playerId) {
    const view = baseRoom(room, playerId);
    Object.assign(view, clone({
      board: room.board,
      currentTurn: room.currentTurn,
      moveHistory: room.moveHistory,
      winner: room.winner,
      winningLine: room.winningLine,
      endReason: room.endReason,
      turnDeadline: room.turnDeadline
    }));
    return view;
  },

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
