import {
  createPlayerNameSanitizer,
  createRoomCodeSanitizer
} from '../../../../src/shared/sanitize'

export const sanitizePlayerName = createPlayerNameSanitizer({
  maxLength: 20,
  fallback: 'Player',
  emptyError: 'Player name was empty; using Player.'
})

export const sanitizeRoomCode = createRoomCodeSanitizer({
  emptyError: 'Room code is required.',
  lengthError: 'Room code must be 6 letters or numbers.'
})

export function sanitizeModuleAction(action) {
  if (!action || typeof action !== 'object') {
    return { value: null, error: 'Invalid module action.' }
  }

  return {
    value: JSON.parse(JSON.stringify(action)),
    error: null
  }
}
