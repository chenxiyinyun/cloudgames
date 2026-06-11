import { createGameNetwork } from '../../../../src/shared/ws/createGameNetwork'
import { createLogger } from '../services/logger'
import { gameState, setConnectionStatus, setRoom, updateLocalState } from './state'

/**
 * territory-control 网络层（服务器权威 / WebSocket）。
 *
 * 复用共享 createGameNetwork。territory 的生产/移动/离线中和等"持续推进"由服务器
 * tick 驱动并通过 STATE 全量下发，客户端不再跑任何生产定时器。
 */
const net = createGameNetwork({
  gameId: 'territory',
  logger: createLogger('Territory:Network'),
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
