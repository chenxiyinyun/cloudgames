export function deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith('__v_') || key === '_rawValue' || key === '_value') continue;
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function computeRoomDiff(oldRoom, newRoom) {
  const diff = {};
  let changedCount = 0;
  const keys = Object.keys(newRoom || {});

  for (const key of keys) {
    if (key.startsWith('__v_') || key === '_rawValue' || key === '_value') continue;

    const oldVal = oldRoom ? oldRoom[key] : undefined;
    const newVal = newRoom[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = newVal;
      changedCount++;
    }
  }

  return { diff, changedCount, totalFields: keys.length };
}

export function createRoomBroadcaster({
  p2p,
  getRoom,
  updateLocalState,
  roomStateType = 'ROOM_STATE',
  getDeltaMeta = () => ({}),
  fullSyncRatio = 0.5
}) {
  if (!p2p || typeof getRoom !== 'function' || typeof updateLocalState !== 'function') {
    throw new Error('createRoomBroadcaster requires p2p, getRoom, and updateLocalState');
  }

  let lastBroadcastState = null;

  function resetBroadcastState() {
    lastBroadcastState = null;
  }

  function broadcastState({ forceFull = false, error = null } = {}) {
    const room = getRoom();
    if (!room) return null;

    const { diff, changedCount, totalFields } = computeRoomDiff(lastBroadcastState, room);
    const shouldSendFull = forceFull ||
      !lastBroadcastState ||
      changedCount > totalFields * fullSyncRatio ||
      totalFields < 3;

    const payload = shouldSendFull
      ? { room }
      : { delta: diff, ...getDeltaMeta(room) };

    if (error) {
      payload.error = error;
    }

    p2p.broadcast(roomStateType, payload);
    lastBroadcastState = deepClone(room);
    updateLocalState(room);
    return payload;
  }

  return {
    broadcastState,
    resetBroadcastState
  };
}
