/**
 * 门户元数据（纯数据，无任何 import）：
 * 首页游戏列表由它自动派生，构建入口由目录扫描派生，新增游戏无需改 App.vue / vite.config。
 * order 决定门户展示顺序。
 */
export default {
  gameId: 'catguess',
  order: 2,
  name: '喵喵猜词',
  englishName: 'Cat Guess',
  description: '让想象力坐上飞船。描述你的画，找出讲故事的人，看看谁最懂你的奇思妙想。',
  href: 'games/catguess/',
  players: '3–6 人',
  mode: 'versus',
  modeLabel: '欢乐猜词',
  tags: ['脑洞表达', '轻松聚会'],
  color: 'pink'
};
