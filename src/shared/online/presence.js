/**
 * 玩家在线状态的共享叶子操作。
 *
 * 四个游戏的 handleJoinRequest 控制流各不相同（去重时机、peerId 匹配、game-started
 * 门禁、resume 逻辑等），不强行统一。但「把一名已存在的玩家标记为重新上线」这一步
 * 在所有重连分支里完全一致，且重复了约 8 处。抽到此处避免各处复制
 * disconnectedPlayers 过滤逻辑时出现 copy 偏差，并提供单一修复点。
 */

/**
 * 把已存在的玩家标记为「重新上线」：置 isOnline、刷新 _peerId、
 * 并从 disconnectedPlayers 名单中移除该玩家。
 *
 * 注意：不处理 player.name —— 是否随重连刷新名字由各游戏的调用方自行决定。
 *
 * @param {{ disconnectedPlayers?: Array<{id: string}> }} room  房间状态（可变引用）
 * @param {{ id: string, isOnline?: boolean, _peerId?: string }} player  已匹配到的玩家（可变引用）
 * @param {string} peerId  该玩家当前的 peerId
 */
export function markPlayerOnline(room, player, peerId) {
  player.isOnline = true;
  player._peerId = peerId;
  if (room.disconnectedPlayers) {
    room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== player.id);
  }
}
