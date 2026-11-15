/**
 * 投影共享工具：把权威房间裁剪成某个观察者可见的视图。
 *
 * 这里只放各游戏共用的骨架（玩家白名单字段、房间基础字段）；
 * 游戏特有的投影实现在各自的适配器 `project()` 里，避免集中式 switch。
 */
export const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));

// 允许下发给客户端的玩家字段白名单；未列出的字段（如任何凭证）一律不下发
export const publicPlayerFields = ['id', 'name', 'type', 'isHost', 'isOnline', 'order', 'role', 'team', 'isEncryptor', 'isEliminated', 'color'];

export function playersFor(room, playerId) {
  return room.players.map(player => {
    const projected = Object.fromEntries(publicPlayerFields.filter(key => player[key] !== undefined).map(key => [key, clone(player[key])]));
    projected.type = player.type === 'agent' ? 'agent' : 'human';
    if (player.id === playerId && Array.isArray(player.hand)) projected.hand = clone(player.hand);
    return projected;
  });
}

export function baseRoom(room, playerId) {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    phase: room.phase,
    settings: clone(room.settings),
    players: playersFor(room, playerId),
    disconnectedPlayers: (room.disconnectedPlayers || []).map(({ id, name, disconnectedAt }) => ({ id, name, disconnectedAt }))
  };
}
