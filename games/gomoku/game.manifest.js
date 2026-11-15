/**
 * 门户元数据（纯数据，无任何 import）：
 * 首页游戏列表由它自动派生，构建入口由目录扫描派生，新增游戏无需改 App.vue / vite.config。
 * order 决定门户展示顺序。
 */
export default {
  gameId: 'gomoku',
  order: 5,
  name: '五子棋',
  englishName: 'Gomoku',
  description: '一黑一白，一落一子。在纵横棋盘上排兵布阵，先连成五子者赢下这局。',
  href: 'games/gomoku/',
  players: '2 人',
  mode: 'versus',
  modeLabel: '双人对弈',
  tags: ['策略对弈', '烧脑对决'],
  color: 'yellow'
};
