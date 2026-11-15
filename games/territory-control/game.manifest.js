/**
 * 门户元数据（纯数据，无任何 import）：
 * 首页游戏列表由它自动派生，构建入口由目录扫描派生，新增游戏无需改 App.vue / vite.config。
 * order 决定门户展示顺序。
 */
export default {
  gameId: 'territory-control',
  order: 4,
  name: '区域争夺',
  englishName: 'Territory Control',
  description: '指尖派兵，步步为营。在不断变化的地图上扩张领地，用策略赢下最后的版图。',
  href: 'games/territory-control/',
  players: '2–4 人',
  mode: 'versus',
  modeLabel: '策略对抗',
  tags: ['即时策略', '地图争夺'],
  color: 'cyan'
};
