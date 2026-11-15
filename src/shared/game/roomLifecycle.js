/**
 * 房间生命周期共享实现。
 *
 * 五个游戏的 createInitialRoom / addPlayerToRoom / removePlayerFromRoom 原先各写一份，
 * 重连识别、容量校验、房主迁移、掉线登记这类容易出错的规则重复了五次。
 * 这里只保留通用规则；各游戏通过参数声明差异（容量、加入门槛、玩家字段、
 * 对局中是否保留席位、暂停/保存阶段等钩子）。
 *
 * 注意：本模块只处理“房间成员关系”，不涉及任何游戏规则。
 */

export function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 房间骨架：id/code/hostId/status/phase/房主玩家/掉线列表/时间戳。
 * host 为房主玩家的游戏特有字段，extra 为房间的游戏特有字段。
 */
export function createBaseRoom({ hostPlayerId, hostName, roomCode, status = 'waiting', phase = 'waiting', host = {}, extra = {} }) {
  const now = Date.now();
  return {
    id: roomCode,
    code: roomCode,
    hostId: hostPlayerId,
    status,
    phase,
    players: [{ id: hostPlayerId, name: hostName, isHost: true, isOnline: true, order: 0, ...host }],
    disconnectedPlayers: [],
    createdAt: now,
    updatedAt: now,
    ...extra
  };
}

/**
 * 加入房间：
 * - 同一 playerId 视为重连（标记在线、更新昵称、移出掉线列表）。
 * - allowOnlineReconnect=false 时，已在线的同 id 会被拒绝（默认行为）。
 * - canJoin 返回 { error } 时拒绝（例如对局已开始）。
 * - 达到 maxPlayers 时返回 fullMessage。
 */
export function addPlayerToRoom(room, playerName, playerId, {
  maxPlayers,
  fullMessage = '房间已满',
  canJoin,
  allowOnlineReconnect = false,
  createPlayer,
  afterAdd
} = {}) {
  const existing = room.players.find(player => player.id === playerId);
  if (existing) {
    if (!allowOnlineReconnect && existing.isOnline) return { error: '玩家已在房间中' };
    existing.isOnline = true;
    existing.name = playerName;
    room.disconnectedPlayers = (room.disconnectedPlayers || []).filter(player => player.id !== playerId);
    room.updatedAt = Date.now();
    return { room, reconnected: true };
  }

  const rejected = canJoin?.(room);
  if (rejected?.error) return rejected;
  if (room.players.length >= maxPlayers) return { error: fullMessage };

  room.players.push(createPlayer({ playerId, playerName, order: room.players.length, room }));
  afterAdd?.(room);
  room.updatedAt = Date.now();
  return { room, reconnected: false };
}

/**
 * 离开房间：
 * - keepSeat(room) 为真 → 对局中保留席位，只标记离线并登记掉线信息。
 * - 否则移出玩家并做房主迁移；afterRemoval 负责各游戏特有的重排/队伍重建。
 * - dedupeDisconnected 避免同一玩家重复登记。
 */
export function removePlayerFromRoom(room, playerId, {
  keepSeat,
  onSeatKept,
  extraDisconnectedFields,
  dedupeDisconnected = false,
  afterRemoval
} = {}) {
  const player = room.players.find(candidate => candidate.id === playerId);
  if (!player) return room;

  if (keepSeat?.(room)) {
    player.isOnline = false;
    if (!room.disconnectedPlayers) room.disconnectedPlayers = [];
    if (!dedupeDisconnected || !room.disconnectedPlayers.some(entry => entry.id === playerId)) {
      room.disconnectedPlayers.push({
        id: player.id,
        name: player.name,
        ...(extraDisconnectedFields ? extraDisconnectedFields(player) : {}),
        disconnectedAt: Date.now()
      });
    }
    onSeatKept?.(room, player);
    room.updatedAt = Date.now();
    return room;
  }

  room.players = room.players.filter(candidate => candidate.id !== playerId);
  if (room.players.length > 0 && !room.players.some(candidate => candidate.id === room.hostId)) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }
  afterRemoval?.(room, player);
  room.updatedAt = Date.now();
  return room;
}
