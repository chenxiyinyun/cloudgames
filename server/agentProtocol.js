import { GOMOKU_AGENT_RULES } from '../src/shared/agentPlaybook.js';
import { GAME_AGENT_PLAYBOOKS } from '../src/shared/agentGameGuides.js';

export const AGENT_API_VERSION = '1';
const text = (max = 20) => ({ type: 'string', maxLength: max });
const guess = { type: 'array', items: 'integer', minItems: 3, maxItems: 3, minimum: 1, maximum: 4 };
const empty = { type: 'object', properties: {}, additionalProperties: false };
const action = (id, description, payload = empty) => ({ action: id, description, payloadSchema: payload });
const field = (type, extra = {}) => ({ type, ...extra });

export const GAME_AGENT_GUIDES = {
  codenames: {
    gameId: 'codenames', name: '截码战', path: '/games/codenames/',
    summary: '四人两队，轮流给三项线索，队友按线索猜密码，另一队尝试拦截。',
    rules: ['关键词和当前密码只对当前情报官可见。', '每轮提交三个 1–4 的整数；以 availableActions 为准，不要猜其他队伍的未公开投票。', '房间需满四人才建议开始；Agent 不能自动成为真人。'],
    actions: [
      action('START_GAME', '房主开始游戏，等待或分队阶段且满四人。'),
      action('SUBMIT_CLUES', '当前情报官提交恰好三条互不重复的线索。', { type: 'object', required: ['clues'], properties: { clues: { type: 'array', items: 'string', minItems: 3, maxItems: 3, maxLength: 40 } }, additionalProperties: false }),
      action('SUBMIT_TEAM_GUESS', '加密方非情报官提交三位队伍猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
      action('SUBMIT_OPPONENT_GUESS', '非加密方提交三位拦截猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
      action('SUBMIT_TEAM_VOTE', '需要统一队内猜测时提交最终三位猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
      action('SUBMIT_OPPONENT_VOTE', '需要统一拦截猜测时提交最终三位猜测。', { type: 'object', required: ['guess'], properties: { guess }, additionalProperties: false }),
      action('NEXT_ROUND', '房主在结算后推进下一轮或重新开始。')
    ]
  },
  catguess: {
    gameId: 'catguess', name: '喵喵猜词', path: '/games/catguess/',
    summary: '3–6 人轮流出题、选牌与投票。自己的手牌只在 players 中自己的记录里。',
    rules: ['说书人选择手牌下标并写 1–20 字提示；其他玩家选择手牌下标，随后给公开卡牌 id 投票。', 'scoring 前不会泄露答案、他人手牌或他人投票。', '计时阶段会自动推进，收到状态后及时行动。'],
    actions: [
      action('START_GAME', '房主在至少三人在线时开始。'),
      action('SUBMIT_STORY', '说书人提交手牌下标和提示。', { type: 'object', required: ['cardIndex', 'clue'], properties: { cardIndex: field('integer', { minimum: 0 }), clue: text(20) }, additionalProperties: false }),
      action('SUBMIT_CARD', '非说书人提交手牌下标。', { type: 'object', required: ['cardIndex'], properties: { cardIndex: field('integer', { minimum: 0 }) }, additionalProperties: false }),
      action('SUBMIT_VOTE', '非说书人给 shuffledCards 中的 id 投票。', { type: 'object', required: ['votedCardId'], properties: { votedCardId: field('integer', { minimum: 0 }) }, additionalProperties: false }),
      action('NEXT_ROUND', '房主在计分或结束后推进。'),
      action('END_GAME', '房主结束游戏。')
    ]
  },
  bombdefuse: {
    gameId: 'bombdefuse', name: '双人拆弹', path: '/games/bomb-defuse/',
    summary: '两人合作。defuser 查看 bombView 并操作；expert 查看 manualView，负责指导。',
    rules: ['专家不能直接操作模块；拆弹员不会收到说明书，专家不会收到模块答案。', '操作放在 action 字段中，例如 cut_wire / press_key / select_symbols / enter_password / move。', '每次合法操作后的 actionLog 与模块状态可供双方共享信息。'],
    actions: [
      action('START_GAME', '房主在两名玩家在线时开始。'),
      action('SET_DIFFICULTY', '房主设置 rookie / normal / hard / hell。', { type: 'object', required: ['difficulty'], properties: { difficulty: field('string', { enum: ['rookie', 'normal', 'hard', 'hell'] }) }, additionalProperties: false }),
      action('SUBMIT_MODULE_ACTION', '拆弹员对指定模块执行操作。', { type: 'object', required: ['moduleId', 'action'], properties: { moduleId: text(60), action: { type: 'object', description: '按模块类型：{type:cut_wire,wireId}、{type:press_key,keyId}、{type:press_symbols,symbolIds:string[]}、{type:enter_password,word}、{type:move,direction:up|down|left|right}' } }, additionalProperties: false }),
      action('ASSIGN_ROLES', '房主分配 defuser / expert。', { type: 'object', required: ['roleByPlayerId'], properties: { roleByPlayerId: { type: 'object', additionalProperties: { enum: ['defuser', 'expert'] } } }, additionalProperties: false }),
      action('RESTART', '房主重新开始。'),
      action('END_GAME', '房主结束游戏。')
    ]
  },
  territory: {
    gameId: 'territory', name: '区域争夺', path: '/games/territory-control/',
    summary: '2–4 人即时策略，从自己领地派兵，经连通路线占领地图。',
    rules: ['gameState.territories 提供 id、ownerId、units、坐标；edges 提供连通关系。', '只能由自己的领地派兵，ratio 为 0.25 / 0.5 / 0.75；每个 tick 地图都会变化。'],
    actions: [
      action('START_GAME', '房主在 2–4 名玩家在线时开始。'),
      action('SET_MAP_SIZE', '房主设置 small / medium / large。', { type: 'object', required: ['mapSize'], properties: { mapSize: field('string', { enum: ['small', 'medium', 'large'] }) }, additionalProperties: false }),
      action('SET_THEME', '房主设置 default / catpaw。', { type: 'object', required: ['theme'], properties: { theme: field('string', { enum: ['default', 'catpaw'] }) }, additionalProperties: false }),
      action('DISPATCH_UNITS', '从自己领地派兵到可达领地。', { type: 'object', required: ['sourceId', 'targetId', 'ratio'], properties: { sourceId: text(60), targetId: text(60), ratio: field('number', { enum: [0.25, 0.5, 0.75] }) }, additionalProperties: false }),
      action('RESTART_GAME', '房主重新开始。'),
      action('END_GAME', '房主结束游戏。')
    ]
  },
  gomoku: {
    gameId: 'gomoku', name: '五子棋', path: '/games/gomoku/',
    summary: '双人对弈，黑棋先行，先把 5 颗棋子连成一线（横/竖/斜）者获胜。',
    rules: ['board 为 15×15 的二维数组（0 空、1 黑、2 白），行/列下标均为 0–14。', '只在自己的回合（room.currentTurn 与你的 role 相同）落子；每手限时 60 秒，超时判负。', 'moveHistory 记录全部落子；winner / winningLine / endReason 表示终局原因。'],
    actions: [
      action('START_GAME', '房主在两名玩家在线时开始。'),
      action('PLACE_STONE', '当前回合玩家落子。', { type: 'object', required: ['row', 'col'], properties: { row: field('integer', { minimum: 0, maximum: 14 }), col: field('integer', { minimum: 0, maximum: 14 }) }, additionalProperties: false }),
      action('RESIGN', '对局中认输，对方获胜。'),
      action('RESTART_GAME', '房主在结束后交换先后手重新开始。'),
      action('END_GAME', '房主提前结束对局。')
    ]
  }
};

// main 的动作目录集中在 agentProtocol；提示词与当前分支共用同一份规则源。
for (const [gameId, playbook] of Object.entries(GAME_AGENT_PLAYBOOKS)) {
  GAME_AGENT_GUIDES[gameId].rules.push(...playbook.rules);
}
GAME_AGENT_GUIDES.gomoku.rules.push(...GOMOKU_AGENT_RULES);
const bombRules = GAME_AGENT_GUIDES.bombdefuse.rules;
bombRules[bombRules.findIndex(rule => rule.includes('select_symbols'))] = '操作放在 action 字段中，例如 cut_wire / press_key / press_symbols / enter_password / move。';

export function getAgentActions(room, playerId, gameId) {
  const me = room.players.find(player => player.id === playerId);
  if (!me) return [];
  const isHost = room.hostId === playerId;
  let names = [];
  if (gameId === 'codenames') {
    if (isHost && ['waiting', 'assigning_teams'].includes(room.phase) && room.players.length === 4) names = ['START_GAME'];
    if (room.phase === 'encrypting' && room.encryptor === playerId) names.push('SUBMIT_CLUES');
    if (room.phase === 'guessing' && room.encryptor !== playerId) names.push(me.team === room.encryptorTeam ? 'SUBMIT_TEAM_GUESS' : 'SUBMIT_OPPONENT_GUESS');
    if (room.phase === 'team_voting') names.push(me.team === room.encryptorTeam ? 'SUBMIT_TEAM_VOTE' : 'SUBMIT_OPPONENT_VOTE');
    if (isHost && (room.phase === 'result' || room.status === 'ended')) names.push('NEXT_ROUND');
  } else if (gameId === 'catguess') {
    if (isHost && room.phase === 'waiting') names = ['START_GAME'];
    if (room.phase === 'storyteller_picking' && room.gameState.storytellerId === playerId) names.push('SUBMIT_STORY');
    if (room.phase === 'others_picking' && room.gameState.storytellerId !== playerId) names.push('SUBMIT_CARD');
    if (room.phase === 'revealing' && room.gameState.storytellerId !== playerId) names.push('SUBMIT_VOTE');
    if (isHost && ['scoring', 'ended'].includes(room.phase)) names.push('NEXT_ROUND', 'END_GAME');
  } else if (gameId === 'bombdefuse') {
    if (isHost && room.phase === 'waiting') names = ['START_GAME', 'SET_DIFFICULTY', 'ASSIGN_ROLES'];
    if (room.phase === 'playing' && me.role === 'defuser') names.push('SUBMIT_MODULE_ACTION');
    if (isHost && ['solved', 'exploded', 'ended'].includes(room.phase)) names.push('RESTART', 'END_GAME');
  } else if (gameId === 'territory') {
    if (isHost && room.phase === 'waiting') names = ['START_GAME', 'SET_MAP_SIZE', 'SET_THEME'];
    if (room.phase === 'playing' && me.isOnline && !me.isEliminated) names.push('DISPATCH_UNITS');
    if (isHost && room.phase === 'ended') names.push('RESTART_GAME', 'END_GAME');
  } else if (gameId === 'gomoku') {
    if (isHost && room.phase === 'waiting' && room.players.length === 2) names = ['START_GAME'];
    if (room.phase === 'playing' && me.isOnline) {
      if (me.role === room.currentTurn) names.push('PLACE_STONE');
      names.push('RESIGN');
    }
    if (isHost && room.phase === 'playing') names.push('END_GAME');
    if (isHost && room.phase === 'ended') names.push('RESTART_GAME', 'END_GAME');
  }
  const all = GAME_AGENT_GUIDES[gameId].actions;
  return names.map(name => all.find(item => item.action === name)).filter(Boolean);
}

export function validateAgentIntent(gameId, actionName, payload) {
  const definition = GAME_AGENT_GUIDES[gameId]?.actions.find(item => item.action === actionName);
  if (!definition) return { error: `不支持的游戏动作：${actionName}` };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'payload 必须是对象' };
  const schema = definition.payloadSchema;
  if (schema.additionalProperties === false && Object.keys(payload).some(key => !Object.hasOwn(schema.properties || {}, key))) return { error: 'payload 包含未定义字段' };
  for (const key of schema.required || []) if (!Object.hasOwn(payload, key)) return { error: `payload 缺少 ${key}` };
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    const value = payload[key];
    if (value === undefined) continue;
    if (rule.type === 'string' && (typeof value !== 'string' || !value.trim() || value.length > (rule.maxLength || 100))) return { error: `${key} 必须是非空短文本` };
    if (rule.type === 'integer' && (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) return { error: `${key} 必须是有效整数` };
    if (rule.type === 'number' && (typeof value !== 'number' || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) return { error: `${key} 必须是数字` };
    if (rule.enum && !rule.enum.includes(value)) return { error: `${key} 不在允许范围` };
    if (rule.type === 'array') {
      if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) return { error: `${key} 数量不正确` };
      if (rule.items === 'integer' && value.some(item => !Number.isInteger(item) || item < rule.minimum || item > rule.maximum)) return { error: `${key} 必须是 1–4 的整数` };
      if (rule.items === 'string' && value.some(item => typeof item !== 'string' || !item.trim() || item.length > rule.maxLength)) return { error: `${key} 必须是非空短文本` };
    }
    if (rule.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 6000)) return { error: `${key} 必须是有效的小对象` };
  }
  return { value: payload };
}
