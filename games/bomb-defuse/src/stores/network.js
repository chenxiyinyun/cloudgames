import { createGameNetwork } from '../../../../src/shared/ws/createGameNetwork'
import { createLogger } from '../services/logger'
import { gameState, setConnectionStatus, setRoom, updateLocalState } from './state'

/**
 * bomb-defuse 网络层（服务器权威 / WebSocket）。
 *
 * 全部 WS 接线复用共享的 createGameNetwork：JOINED/STATE/ERROR → 响应式状态、
 * 断线自动重连并重新 JOIN（同 playerId 服务器视为重连）。这里只提供本游戏的
 * gameState 与状态写入函数。
 */
const net = createGameNetwork({
  gameId: 'bombdefuse',
  logger: createLogger('BombDefuse:Network'),
  gameState,
  setConnectionStatus,
  setRoom,
  updateLocalState
})

export const RECONNECT_METADATA = net.RECONNECT_METADATA

export const connectCreate = net.connectCreate
export const connectJoin = net.connectJoin
export const reconnectNetwork = net.reconnectNetwork
export const sendIntent = net.sendIntent
export const leaveNetwork = net.leaveNetwork
export const cleanupNetwork = net.cleanupNetwork
