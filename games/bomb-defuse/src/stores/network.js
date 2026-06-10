import { reactive } from 'vue'
import { createWebSocketService } from '../../../../src/shared/ws/createWebSocketService'
import { createLogger } from '../services/logger'
import { gameState, setConnectionStatus, setRoom, updateLocalState } from './state'

/**
 * bomb-defuse 网络层（服务器权威 / WebSocket）。
 *
 * 取代原 PeerJS 网络层：没有 host/guest 分支、没有主机迁移、没有加入重试握手。
 * 这里只把 WebSocket 传输层的回调接到响应式状态上：
 *   JOINED → 标记已连接、记录 playerId/roomCode、应用首帧房间
 *   STATE  → 应用服务器下发的权威房间（全量）
 *   ERROR  → 写入错误；fatal 时回退到菜单
 */

const log = createLogger('BombDefuse:Network')

// ConnectionOverlay 显示重连进度用（保持与旧接口同名同形）
export const RECONNECT_METADATA = reactive({ attempt: 0, MAX_ATTEMPTS: 6 })

const ws = createWebSocketService({
  gameId: 'bombdefuse',
  logger: log,
  maxReconnects: RECONNECT_METADATA.MAX_ATTEMPTS
})

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
  },

  onState: (room) => {
    applyRoom(room)
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
    if (status === 'connected') gameState.connected = true
    if (status === 'reconnecting') {
      RECONNECT_METADATA.attempt += 1
    } else if (status === 'connected') {
      RECONNECT_METADATA.attempt = 0
    }
  }
})

function applyRoom(room) {
  if (!room) return
  setRoom(room)
  updateLocalState(room)
}

// ── 公开 API（供 gameStore 使用）─────────────────────────────────────────────

export function connectCreate(playerId, playerName) {
  ws.create(playerId, playerName)
}

export function connectJoin(roomCode, playerId, playerName) {
  ws.join(roomCode, playerId, playerName)
}

export function reconnectNetwork() {
  return ws.reconnect()
}

export function sendIntent(action, payload) {
  return ws.sendIntent(action, payload)
}

export function leaveNetwork() {
  ws.leave()
}

export function cleanupNetwork() {
  ws.leave()
  RECONNECT_METADATA.attempt = 0
}
