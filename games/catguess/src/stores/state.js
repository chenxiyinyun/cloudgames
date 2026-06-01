// ── Reactive Game State ───────────────────────────────────────────────────────
// catguess 全局 reactive 状态 + 房主权威房间状态（cachedRoom）访问器。
// 命名与 codenames/src/stores/roomState.js 对齐：getRoom / setRoom。

import { reactive } from 'vue';
import { GAME_PHASES } from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';

const log = createLogger('GameStore');

// ── Default Word Pool ──
const DEFAULT_WORD_POOL = [
  '苹果', '月亮', '彩虹', '沙滩', '森林', '海洋', '星空', '火焰', '冰山', '沙漠',
  '花园', '瀑布', '闪电', '雪花', '阳光', '影子', '迷宫', '城堡', '桥梁', '灯塔',
  '风筝', '气球', '帆船', '火箭', '面具', '钥匙', '时钟', '镜子', '蜡烛', '羽毛',
  '珍珠', '钻石', '琥珀', '翡翠', '宝剑', '盾牌', '皇冠', '魔杖', '书卷', '信封',
  '摇篮', '秋千', '滑梯', '旋转', '跳跃', '飞翔', '沉睡', '苏醒', '哭泣', '微笑',
  '拥抱', '亲吻', '告别', '重逢', '冒险', '旅行', '探索', '发现', '秘密', '宝藏',
  '梦想', '回忆', '思念', '期待', '自由', '孤独', '勇气', '温柔', '愤怒', '平静',
  '春天', '夏天', '秋天', '冬天', '黎明', '黄昏', '午夜', '午后', '清晨', '傍晚',
  '猫咪', '小狗', '兔子', '狐狸', '小鸟', '蝴蝶', '鲸鱼', '海豚', '狮子', '大象',
  '熊猫', '松鼠', '刺猬', '金鱼', '蜗牛', '蜻蜓', '蜜蜂', '蚂蚁', '蜘蛛', '螃蟹',
  '玫瑰', '百合', '雏菊', '樱花', '荷花', '向日葵', '蒲公英', '薰衣草', '仙人掌', '蘑菇',
  '吉他', '钢琴', '小提琴', '笛子', '鼓点', '旋律', '音符', '歌声', '舞蹈', '诗歌',
  '画笔', '颜料', '画布', '雕塑', '照片', '电影', '剧本', '魔术', '童话', '寓言',
  '咖啡', '奶茶', '巧克力', '冰淇淋', '蛋糕', '糖果', '面包', '米饭', '面条', '火锅',
  '日出', '日落', '潮汐', '极光', '流星', '彩虹', '暴风', '海啸', '火山', '地震',
  '友谊', '爱情', '亲情', '信任', '背叛', '谎言', '真相', '命运', '奇迹', '永恒',
  '瞬间', '无限', '轮回', '平行', '虚幻', '真实', '光明', '黑暗', '寂静', '喧嚣',
  '起点', '终点', '旅途', '归途', '远方', '故乡', '城市', '乡村', '街道', '家门'
];

export { DEFAULT_WORD_POOL };

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  isHost: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected',
  connectionMessage: '',
  toast: null,
  // P2P 诊断信息（启动时由 p2p.getConnectionDiagnostics() 初始化 + 模式变更时更新）
  diagnostics: {
    mode: 'unknown',
    signaling: null,
    turnRelay: null,
    lastModeChange: null,
    peers: {}
  },

  room: {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  }
});

// 房主权威房间状态：会被整体重新赋值（创建/恢复/收到全量 ROOM_STATE/迁移）。
// 对外只暴露 getRoom()/setRoom() 访问器，禁止直接导入。
let _cachedRoom = null;
export function getRoom() {
  return _cachedRoom;
}
export function setRoom(room) {
  _cachedRoom = room;
}

// 启动时立即拉取一次诊断（信令/TURN 信息在构建期就确定了）
try {
  Object.assign(gameState.diagnostics, p2p.getConnectionDiagnostics());
} catch (e) {
  log.warn('Failed to read initial p2p diagnostics', { error: e });
}

// 订阅模式变更（P2P → TURN 切换时刷新诊断 + 通知玩家）
p2p.onModeChange = (payload) => {
  log.info('P2P mode change', payload);
  gameState.diagnostics.lastModeChange = payload;
  gameState.diagnostics.mode = payload.mode || gameState.diagnostics.mode;
  // 在连接状态文案上提示一下（仅在 connecting/reconnecting 时）
  if (payload.phase === 'switching-to-relay' && payload.reason) {
    gameState.connectionMessage = payload.reason;
  } else if (payload.phase === 'using-relay' && payload.mode === 'relay') {
    gameState.connectionMessage = '已通过 TURN 中继连接';
  }
};

// 实时拉取最新诊断（用于 UI 组件，不依赖 reactive 字段）
export function getDiagnostics() {
  try {
    return p2p.getConnectionDiagnostics();
  } catch {
    return gameState.diagnostics;
  }
}

// ── Local mirror update (called by network when ROOM_STATE arrives) ──────────
// 从房主权威房间重建 gameState.room。Shuffled cards 在非 SCORING 阶段隐藏 secretCardId。
export function updateLocalState(room) {
  if (!room) return;

  gameState.roomCode = room.code;
  gameState.isHost = room.hostId === gameState.playerId;

  gameState.room = {
    players: (room.players || []).map(p => ({ ...p })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      round: room.gameState.round || 0,
      storytellerId: room.gameState.storytellerId || null,
      clue: room.gameState.clue || '',
      submittedCards: room.gameState.submittedCards ? [...room.gameState.submittedCards] : [],
      shuffledCards: sanitizeShuffledCardsForClient(room.gameState, room.phase),
      votes: room.gameState.votes ? [...room.gameState.votes] : [],
      roundScores: room.gameState.roundScores ? { ...room.gameState.roundScores } : {},
      scores: room.gameState.scores ? { ...room.gameState.scores } : {},
      roundHistory: room.gameState.roundHistory ? [...room.gameState.roundHistory] : [],
      winner: room.gameState.winner || null,
      secretCardId: room.gameState.secretCardId != null ? room.gameState.secretCardId : null
    } : {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    hostId: room.hostId || null,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
    savedPhase: room.savedPhase || null,
    savedStorytellerId: room.savedStorytellerId || null
  };

  syncScreenToPhase(room);
}

function sanitizeShuffledCardsForClient(gameState, phase) {
  if (!gameState.shuffledCards) return [];

  if (phase === GAME_PHASES.SCORING || phase === GAME_PHASES.ENDED) {
    return [...gameState.shuffledCards];
  }

  return gameState.shuffledCards.map(card => ({
    id: card.id,
    word: card.word,
    submitterId: card.submitterId
  }));
}

function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}
