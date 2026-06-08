import { watch } from 'vue'
import { gameState, getRoom, setRoom, updateLocalState } from './state'
import {
  cancelPendingSave,
  clearStateCache,
  flushStateCache,
  hasCachedState,
  loadStateFromCache,
  saveStateToCache
} from '../services/stateCache'

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStateCache(gameState)
  })
}

watch(() => ({
  screen: gameState.screen,
  playerId: gameState.playerId,
  playerName: gameState.playerName,
  roomCode: gameState.roomCode,
  isHost: gameState.isHost,
  connectionStatus: gameState.connectionStatus,
  room: gameState.room
}), newState => {
  if (newState.screen === 'menu') {
    cancelPendingSave()
    return
  }
  if (newState.playerId) {
    saveStateToCache(gameState)
  }
}, { deep: true })

export function flushCache() {
  flushStateCache(gameState)
}

export function clearCache() {
  clearStateCache()
}

export function hasRestoreableState() {
  return hasCachedState()
}

export function restoreFromCache() {
  const cached = loadStateFromCache()
  if (!cached?.state || !cached?.room) return false

  Object.assign(gameState, cached.state)
  const room = {
    ...cached.room,
    code: cached.state.roomCode,
    id: cached.state.roomCode
  }
  setRoom(room)
  updateLocalState(room)
  return true
}

export function updateCache() {
  if (!getRoom()) return
  saveStateToCache(gameState)
}
