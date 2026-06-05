import { gameState, getRoom, setRoom, updateLocalState } from './state'
import {
  clearStateCache,
  flushStateCache,
  hasCachedState,
  loadStateFromCache,
  saveStateToCache
} from '../services/stateCache'

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
