import { checkEndCondition, GAME_PHASES } from '../services/gameEngine'
import { gameState, getRoom, setConnectionStatus, updateLocalState } from './state'

let joinTimeout = null
let joinRetryTimer = null
let countdownTimer = null

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

export function startCountdownTimer(onExpired) {
  stopCountdownTimer()
  countdownTimer = setInterval(() => {
    const room = getRoom()
    if (!room) return
    if (room.phase !== GAME_PHASES.PLAYING) {
      stopCountdownTimer()
      return
    }
    checkEndCondition(room)
    updateLocalState(room)
    if (room.phase === GAME_PHASES.EXPLODED) {
      stopCountdownTimer()
      onExpired?.()
    } else if (room.phase !== GAME_PHASES.PLAYING) {
      stopCountdownTimer()
    }
  }, 500)
}

export function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

export function resetAllTimers() {
  clearJoinTimeout()
  stopJoinRetry()
  stopCountdownTimer()
}

export function markReconnectAttempt() {
  setConnectionStatus('reconnecting', 'Reconnecting...')
}

export function resetReconnectAttempt() {
  if (gameState.connected) {
    setConnectionStatus('connected', 'Connected')
  }
}
