const noopLogger = {
  warn: () => {}
};

export function createJoinRequestSender({
  p2p,
  gameId,
  getRoomCode,
  logger = noopLogger,
  joinRequestType = 'JOIN_REQUEST'
}) {
  if (!p2p || !gameId || typeof getRoomCode !== 'function') {
    throw new Error('createJoinRequestSender requires p2p, gameId, and getRoomCode');
  }

  return function sendJoinRequest(playerId, playerName, isReconnect = false) {
    const roomCode = getRoomCode();
    const hostPeerId = p2p.getHostPeerId?.(roomCode) || `${gameId}-${roomCode}`;
    const connectedPeers = p2p.getConnectedPeers();
    const targetPeerId = connectedPeers.includes(hostPeerId) ? hostPeerId : connectedPeers[0];

    if (!targetPeerId) {
      logger.warn('JOIN_REQUEST skipped: no connected host peer yet', { hostPeerId });
      return false;
    }

    return p2p.sendTo(targetPeerId, joinRequestType, {
      playerId,
      playerName,
      originalPeerId: p2p.getMyPeerId?.() || p2p.peer?.id,
      isReconnect
    });
  };
}
