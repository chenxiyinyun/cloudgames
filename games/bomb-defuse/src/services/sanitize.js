function stripUnsafeText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/["'`]/g, '')
    .replace(/[<>]/g, '')
    .trim()
}

export function sanitizePlayerName(name) {
  const value = stripUnsafeText(name).slice(0, 20)
  if (!value) {
    return { value: 'Player', error: 'Player name was empty; using Player.' }
  }
  return { value, error: null }
}

export function sanitizeRoomCode(code) {
  const value = stripUnsafeText(code).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!value) {
    return { value: '', error: 'Room code is required.' }
  }
  if (value.length !== 6) {
    return { value: '', error: 'Room code must be 6 letters or numbers.' }
  }
  return { value, error: null }
}

export function sanitizeModuleAction(action) {
  if (!action || typeof action !== 'object') {
    return { value: null, error: 'Invalid module action.' }
  }

  return {
    value: JSON.parse(JSON.stringify(action)),
    error: null
  }
}
