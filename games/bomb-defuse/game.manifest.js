/**
 * 门户元数据（纯数据，无任何 import）：
 * 首页游戏列表由它自动派生，构建入口由目录扫描派生，新增游戏无需改 App.vue / vite.config。
 * order 决定门户展示顺序。
 */
export default {
  gameId: 'bomb-defuse',
  order: 3,
  name: '双人拆弹',
  englishName: 'Bomb Defuse',
  description: '一个人面对炸弹，一个人手握手册。保持沟通、拆解模块，在最后一秒拯救彼此。',
  href: 'games/bomb-defuse/',
  players: '2 人',
  mode: 'coop',
  modeLabel: '双人协作',
  tags: ['实时沟通', '紧张解谜'],
  color: 'yellow'
};
