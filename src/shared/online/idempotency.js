export function createOperationDeduper({
  makeKey,
  ttlMs = 10000,
  pruneMs = 30000,
  clock = () => Date.now()
}) {
  if (typeof makeKey !== 'function') {
    throw new Error('createOperationDeduper requires a makeKey function');
  }

  const processedOps = new Map();

  function generateOpKey(type, payload = {}, roomCode = '') {
    return makeKey(type, payload, roomCode);
  }

  function isDuplicateOp(key, overrideTtlMs = ttlMs) {
    const now = clock();
    const prev = processedOps.get(key);
    if (prev && now - prev < overrideTtlMs) {
      return true;
    }
    processedOps.set(key, now);
    return false;
  }

  function cleanupOps(overridePruneMs = pruneMs) {
    const now = clock();
    for (const [key, ts] of processedOps) {
      if (now - ts > overridePruneMs) {
        processedOps.delete(key);
      }
    }
  }

  function resetOps() {
    processedOps.clear();
  }

  return {
    generateOpKey,
    isDuplicateOp,
    cleanupOps,
    resetOps
  };
}
