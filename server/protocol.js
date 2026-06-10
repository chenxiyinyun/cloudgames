/**
 * WebSocket 联机协议（服务器权威模型）。
 *
 * 客户端只发"意图"，服务器跑权威游戏逻辑后把房间状态广播回所有客户端。
 * 没有 host/guest 之分，没有主机迁移 —— 服务器就是权威。
 *
 * 协议常量的唯一真源在 src/shared/ws/protocol.js（客户端也从那里 import），
 * 这里重新导出，避免两端各写一份导致漂移。
 *
 *   C2S.CREATE  { gameId, playerId, playerName }      建房
 *   C2S.JOIN    { roomCode, playerId, playerName }    加入/重连（同 playerId 即重连）
 *   C2S.INTENT  { action, payload }                   游戏意图（START_GAME / SUBMIT_* 等）
 *   C2S.LEAVE   {}                                    主动离开
 *
 *   S2C.JOINED  { playerId, roomCode, room }          建房/加入成功
 *   S2C.STATE   { room }                              权威房间状态（全量）
 *   S2C.ERROR   { message, fatal? }                   意图被拒 / 房间不存在等
 */
export { C2S, S2C } from '../src/shared/ws/protocol.js';
