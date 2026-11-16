/**
 * territory-control 服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。territory 的特殊点是有"持续推进"的权威计时：
 * 领土每 2 个 tick +1 兵、移动兵团按时到达结算、长时间离线玩家被中和。
 * 这些原来跑在 host 客户端的定时器里，现在统一由服务器 tick 驱动，并通过
 * adapter.tick 返回 true 让 roomManager 每个 tick 广播全量状态。
 */
import * as engine from '../../games/territory-control/src/services/gameEngine.js';
import { baseRoom, clone } from '../projection.js';
import { action, field, text } from '../agentSchema.js';
import { TERRITORY_AGENT_RULES } from '../../src/shared/agentGameGuides.js';

const AGENT_GUIDE = {
  gameId: 'territory',
  name: '区域争夺',
  path: '/games/territory-control/',
  summary: '2–4 人即时策略，从自己领地派兵，经连通路线占领地图。',
  rules: [
    'gameState.territories 提供 id、ownerId、units、坐标；edges 提供连通关系。',
    '只能由自己的领地派兵，ratio 为 0.25 / 0.5 / 0.75；每个 tick 地图都会变化。',
    ...TERRITORY_AGENT_RULES
  ],
  actions: [
    action('START_GAME', '房主在 2–4 名玩家在线时开始。'),
    action('SET_MAP_SIZE', '房主设置 small / medium / large。', { type: 'object', required: ['mapSize'], properties: { mapSize: field('string', { enum: ['small', 'medium', 'large'] }) }, additionalProperties: false }),
    action('SET_THEME', '房主设置 default / catpaw。', { type: 'object', required: ['theme'], properties: { theme: field('string', { enum: ['default', 'catpaw'] }) }, additionalProperties: false }),
    action('DISPATCH_UNITS', '从自己领地派兵到可达领地。', { type: 'object', required: ['sourceId', 'targetId', 'ratio'], properties: { sourceId: text(60), targetId: text(60), ratio: field('number', { enum: [0.25, 0.5, 0.75] }) }, additionalProperties: false }),
    action('RESTART_GAME', '房主重新开始。'),
    action('END_GAME', '房主结束游戏。')
  ]
};

function agentActions(room, playerId) {
  const me = room.players.find(player => player.id === playerId);
  if (!me) return [];
  const isHost = room.hostId === playerId;
  const names = [];
  if (isHost && room.phase === 'waiting') names.push('START_GAME', 'SET_MAP_SIZE', 'SET_THEME');
  if (room.phase === 'playing' && me.isOnline && !me.isEliminated) names.push('DISPATCH_UNITS');
  if (isHost && room.phase === 'ended') names.push('RESTART_GAME', 'END_GAME');
  return names.map(name => AGENT_GUIDE.actions.find(item => item.action === name)).filter(Boolean);
}

export default {
  gameId: 'territory',

  hostOnlyActions: ['SET_MAP_SIZE', 'SET_THEME', 'START_GAME', 'RESTART_GAME', 'END_GAME'],

  agentGuide: AGENT_GUIDE,

  agentActions,

  // 区域争夺没有隐藏信息：gameState 整体下发
  project(room, playerId) {
    const view = baseRoom(room, playerId);
    view.gameState = clone(room.gameState);
    return view;
  },

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

  applyIntent(room, { action, playerId, payload = {}, now }) {
    switch (action) {
      case 'SET_MAP_SIZE':
        return engine.setMapSize(room, payload.mapSize);
      case 'SET_THEME':
        return engine.setTheme(room, payload.theme);
      case 'START_GAME':
        return engine.startGame(room);
      case 'DISPATCH_UNITS':
        return engine.dispatchUnits(room, playerId, payload.sourceId, payload.targetId, payload.ratio, now);
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
