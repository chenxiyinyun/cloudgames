/**
 * WebSocket 联机协议（服务器权威模型）。
 *
 * 客户端只发"意图"，服务器跑权威游戏逻辑后把房间状态广播回所有客户端。
 * 没有 host/guest 之分，没有主机迁移 —— 服务器就是权威。
 */

// client → server
export const C2S = {
  CREATE: 'CREATE',   // { gameId, playerId, playerName }            建房
  JOIN: 'JOIN',       // { roomCode, playerId, playerName }          加入/重连（同 playerId 即重连）
  INTENT: 'INTENT',   // { action, payload }                         游戏意图（START_GAME / SUBMIT_* 等）
  LEAVE: 'LEAVE'      // {}                                          主动离开
};

// server → client
export const S2C = {
  JOINED: 'JOINED',   // { playerId, roomCode, room }                建房/加入成功
  STATE: 'STATE',     // { room }                                    权威房间状态（全量）
  ERROR: 'ERROR'      // { message, fatal? }                         意图被拒 / 房间不存在等
};
