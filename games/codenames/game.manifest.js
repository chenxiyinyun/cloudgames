/**
 * 门户元数据（纯数据，无任何 import）：
 * 首页游戏列表由它自动派生，构建入口由目录扫描派生，新增游戏无需改 App.vue / vite.config。
 * order 决定门户展示顺序。
 */
export default {
  gameId: 'codenames',
  order: 1,
  name: '截码战',
  englishName: 'Codenames',
  description: '一个词，藏着只有你们懂的暗号。给出巧妙线索，带队友避开对手布下的陷阱。',
  href: 'games/codenames/',
  players: '4 人',
  mode: 'versus',
  modeLabel: '团队对抗',
  tags: ['语言联想', '脑力交锋'],
  color: 'cyan'
};
