import { reactive } from 'vue'
import { createWebSocketService } from './createWebSocketService'

/**
 * 把 WebSocket 传输层接到某个游戏的响应式状态上 —— 4 个游戏共用的网络层样板。
 *
 * 各游戏只需提供自己的 gameState 与 setConnectionStatus/setRoom/updateLocalState，
 * 这里统一处理 JOINED/STATE/ERROR/状态变化到 gameState 的映射，以及重连进度
 * （RECONNECT_METADATA，供 ConnectionOverlay 显示）。
 *
 * 返回供 gameStore 调用的精简接口：connectCreate / connectJoin / reconnectNetwork /
 * sendIntent / leaveNetwork / cleanupNetwork。
 */
export function createGameNetwork({
  gameId,
  logger = console,
  gameState,
  setConnectionStatus,
  setRoom,
  updateLocalState,
  maxReconnects = 6,
  onJoined: extraOnJoined,
  onState: extraOnState
}) {
  const RECONNECT_METADATA = reactive({ attempt: 0, MAX_ATTEMPTS: maxReconnects })

  const ws = createWebSocketService({ gameId, logger, maxReconnects })

  function applyRoom(room) {
    if (!room) return
    setRoom(room)
    updateLocalState(room)
  }

  ws.on({
    onJoined: ({ playerId, roomCode, room }) => {
      gameState.playerId = playerId
      gameState.roomCode = roomCode
      gameState.connected = true
      gameState.connecting = false
      gameState.error = null
      RECONNECT_METADATA.attempt = 0
      applyRoom(room)
      if (gameState.screen === 'menu') gameState.screen = 'lobby'
      extraOnJoined?.({ playerId, roomCode, room })
    },

    onState: (room) => {
      applyRoom(room)
      extraOnState?.(room)
    },

    onError: ({ message, fatal }) => {
      gameState.error = message || '操作失败'
      if (fatal) {
        gameState.connected = false
        gameState.connecting = false
        setConnectionStatus('error', message || '连接已断开')
      }
    },

    onStatus: (status, message) => {
      setConnectionStatus(status, message)
      gameState.connecting = status === 'connecting' || status === 'reconnecting'
      if (status === 'connected') {
        gameState.connected = true
        RECONNECT_METADATA.attempt = 0
      } else if (status === 'reconnecting') {
        RECONNECT_METADATA.attempt += 1
      }
    }
  })

  return {
    RECONNECT_METADATA,
    connectCreate: (playerId, playerName) => ws.create(playerId, playerName),
    connectJoin: (roomCode, playerId, playerName) => ws.join(roomCode, playerId, playerName),
    reconnectNetwork: () => ws.reconnect(),
    sendIntent: (action, payload) => ws.sendIntent(action, payload),
    leaveNetwork: () => ws.leave(),
    cleanupNetwork: () => {
      ws.leave()
      RECONNECT_METADATA.attempt = 0
    }
  }
}
