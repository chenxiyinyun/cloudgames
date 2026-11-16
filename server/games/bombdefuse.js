/**
 * bomb-defuse 服务器适配器。
 *
 * 直接复用客户端的纯函数游戏引擎（gameEngine.js 已在 node 环境下被测试覆盖，
 * 不含任何浏览器/Vue/联网层依赖），服务器作为权威跑同一套逻辑。
 * 新增其它游戏 = 再写一个这样的适配器即可。
 */
import * as engine from '../../games/bomb-defuse/src/services/gameEngine.js';
import { baseRoom, clone } from '../projection.js';
import { action, field, text } from '../agentSchema.js';
import { BOMBDEFUSE_AGENT_RULES } from '../../src/shared/agentGameGuides.js';

const AGENT_GUIDE = {
  gameId: 'bombdefuse',
  name: '双人拆弹',
  path: '/games/bomb-defuse/',
  summary: '两人合作。defuser 查看 bombView 并操作；expert 查看 manualView，负责指导。',
  rules: [
    '专家不能直接操作模块；拆弹员不会收到说明书，专家不会收到模块答案。',
    '操作放在 action 字段中，例如 cut_wire / press_key / press_symbols / enter_password / move。',
    '每次合法操作后的 actionLog 与模块状态可供双方共享信息。',
    ...BOMBDEFUSE_AGENT_RULES
  ],
  actions: [
    action('START_GAME', '房主在两名玩家在线时开始。'),
    action('SET_DIFFICULTY', '房主设置 rookie / normal / hard / hell。', { type: 'object', required: ['difficulty'], properties: { difficulty: field('string', { enum: ['rookie', 'normal', 'hard', 'hell'] }) }, additionalProperties: false }),
    action('SUBMIT_MODULE_ACTION', '拆弹员对指定模块执行操作。', { type: 'object', required: ['moduleId', 'action'], properties: { moduleId: text(60), action: { type: 'object', description: '按模块类型：{type:cut_wire,wireId}、{type:press_key,keyId}、{type:press_symbols,symbolIds:string[]}、{type:enter_password,word}、{type:move,direction:up|down|left|right}' } }, additionalProperties: false }),
    action('ASSIGN_ROLES', '房主分配 defuser / expert。', { type: 'object', required: ['roleByPlayerId'], properties: { roleByPlayerId: { type: 'object', additionalProperties: { enum: ['defuser', 'expert'] } } }, additionalProperties: false }),
    action('RESTART', '房主重新开始。'),
    action('END_GAME', '房主结束游戏。')
  ]
};

function agentActions(room, playerId) {
  const me = room.players.find(player => player.id === playerId);
  if (!me) return [];
  const isHost = room.hostId === playerId;
  const names = [];
  if (isHost && room.phase === 'waiting') names.push('START_GAME', 'SET_DIFFICULTY', 'ASSIGN_ROLES');
  if (room.phase === 'playing' && me.role === 'defuser') names.push('SUBMIT_MODULE_ACTION');
  if (isHost && ['solved', 'exploded', 'ended'].includes(room.phase)) names.push('RESTART', 'END_GAME');
  return names.map(name => AGENT_GUIDE.actions.find(item => item.action === name)).filter(Boolean);
}

function projectBombdefuse(room, playerId) {
  const view = baseRoom(room, playerId);
  const role = room.players.find(player => player.id === playerId)?.role;
  const source = room.gameState || {};
  view.gameState = {
    startedAt: source.startedAt,
    deadlineAt: source.deadlineAt,
    durationMs: source.durationMs,
    strikeLimit: source.strikeLimit,
    difficulty: source.difficulty,
    strikes: clone(source.strikes || []),
    serialNumber: source.serialNumber,
    batteries: source.batteries,
    indicators: clone(source.indicators || []),
    solvedModuleIds: clone(source.solvedModuleIds || []),
    actionLog: clone(source.actionLog || []),
    result: source.result,
    endedAt: source.endedAt
  };
  view.gameState.modules = (source.modules || []).map(module => {
    const publicModule = clone(module);
    delete publicModule.solution;
    const { manualView, bombView } = publicModule;
    delete publicModule.manualView;
    delete publicModule.bombView;
    if (role === 'expert') return { ...publicModule, manualView };
    return { ...publicModule, bombView };
  });
  return view;
}

export default {
  gameId: 'bombdefuse',

  // 房主专属意图：只有 room.hostId 能触发（roomManager 统一校验）
  hostOnlyActions: ['START_GAME', 'SET_DIFFICULTY', 'RESTART', 'ASSIGN_ROLES', 'END_GAME'],

  agentGuide: AGENT_GUIDE,

  agentActions,

  project: projectBombdefuse,

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
