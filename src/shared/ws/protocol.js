/**
 * WebSocket 联机协议常量（客户端与服务器共用的唯一真源）。
 *
 * C2S = client → server，S2C = server → client。
 * 服务器权威模型：客户端只发意图（INTENT）和加入/离开，权威房间状态由服务器
 * 通过 STATE 全量下发。
 */
export const C2S = {
  CREATE: 'CREATE',
  JOIN: 'JOIN',
  INTENT: 'INTENT',
  LEAVE: 'LEAVE'
};

export const S2C = {
  JOINED: 'JOINED',
  STATE: 'STATE',
  ERROR: 'ERROR'
};
