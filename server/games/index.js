/**
 * 游戏适配器注册表。roomManager 按 gameId 查到对应适配器，本身与具体游戏无关。
 * 接入新游戏：写一个适配器并在此登记。
 */
import bombdefuse from './bombdefuse.js';
import territory from './territory.js';

const ADAPTERS = {
  [bombdefuse.gameId]: bombdefuse,
  [territory.gameId]: territory
};

export function getGameAdapter(gameId) {
  return ADAPTERS[gameId] || null;
}

export function listGameIds() {
  return Object.keys(ADAPTERS);
}
