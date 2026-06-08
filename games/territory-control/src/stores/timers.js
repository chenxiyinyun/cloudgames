import { GAME_PHASES, tickProduction, neutralizeLongOfflinePlayers } from '../services/gameEngine'
import { gameState, getRoom, setConnectionStatus, updateLocalState } from './state'

let joinTimeout = null
let joinRetryTimer = null
let productionTimer = null
let offlineNeutralizeTimer = null

export function startJoinTimeout(callback, timeoutMs = 15000) {
  clearJoinTimeout()
  joinTimeout = setTimeout(callback, timeoutMs)
}

export function clearJoinTimeout() {
  if (joinTimeout) {
    clearTimeout(joinTimeout)
    joinTimeout = null
  }
}

export function startJoinRetryInterval(callback, intervalMs = 2000) {
  stopJoinRetry()
  joinRetryTimer = setInterval(callback, intervalMs)
}

export function stopJoinRetry() {
  if (joinRetryTimer) {
    clearInterval(joinRetryTimer)
    joinRetryTimer = null
  }
}

export function startProductionTimer(onTick) {
  stopProductionTimer()
  productionTimer = setInterval(() => {
    const room = getRoom()
    if (!room || room.phase !== GAME_PHASES.PLAYING) {
      stopProductionTimer()
      stopOfflineNeutralizeTimer()
      return
    }
    tickProduction(room)
    updateLocalState(room)
    onTick?.()
    if (room.phase !== GAME_PHASES.PLAYING) {
      stopProductionTimer()
      stopOfflineNeutralizeTimer()
    }
  }, 1000)
}

export function stopProductionTimer() {
  if (productionTimer) {
    clearInterval(productionTimer)
    productionTimer = null
  }
  stopOfflineNeutralizeTimer()
}

/**
 * 离线玩家中立化定时器(仅 host 端):每 5s 检查一次,把 60s+ 未上线的玩家
 * territory 强制中立化 + isEliminated=true,防止躺赢。
 * 与 production timer 生命周期绑定(随游戏开始/结束自动启停)。
 */
export function startOfflineNeutralizeTimer(onNeutralize) {
  stopOfflineNeutralizeTimer()
  offlineNeutralizeTimer = setInterval(() => {
    const room = getRoom()
    if (!room || room.phase !== GAME_PHASES.PLAYING) {
      stopOfflineNeutralizeTimer()
      return
    }
    const eliminatedIds = neutralizeLongOfflinePlayers(room)
    if (eliminatedIds.length > 0) {
      updateLocalState(room)
      onNeutralize?.(eliminatedIds)
    }
  }, 5000)
}

export function stopOfflineNeutralizeTimer() {
  if (offlineNeutralizeTimer) {
    clearInterval(offlineNeutralizeTimer)
    offlineNeutralizeTimer = null
  }
}

export function resetAllTimers() {
  clearJoinTimeout()
  stopJoinRetry()
  stopProductionTimer()
  stopOfflineNeutralizeTimer()
}

export function markReconnectAttempt() {
  setConnectionStatus('reconnecting', 'Reconnecting...')
}

export function resetReconnectAttempt() {
  if (gameState.connected) {
    setConnectionStatus('connected', 'Connected')
  }
}
