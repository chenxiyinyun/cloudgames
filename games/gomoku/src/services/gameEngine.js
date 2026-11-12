/**
 * 五子棋（Gomoku）纯函数引擎 —— 客户端与服务器共用（服务器权威）。
 *
 * 规则（无禁手自由规则）：
 *   - 15×15 棋盘，黑棋先行，双方轮流落子；
 *   - 任意方向（横/竖/斜）先连成 5 子者获胜（长连也算胜）；
 *   - 棋盘下满仍无人获胜则为平局；
 *   - 每手限时 TURN_TIME_MS，超时未落子判负（由服务器 tick 驱动）；
 *   - 对局中可随时认输；房主可提前结束对局。
 *
 * 断线处理：等待/结束阶段直接移除；对局中标记离线并保留席位，
 * 回合计时会自然推进（轮到离线方时超时判负），重连后恢复在线。
 */

export const GAME_PHASES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  ENDED: 'ended',
  PAUSED: 'paused'
};

export const BOARD_SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const TURN_TIME_MS = 60_000;
export const MAX_PLAYERS = 2;

// 对局结束原因
export const END_REASONS = {
  WIN: 'win',
  DRAW: 'draw',
  TIMEOUT: 'timeout',
  RESIGN: 'resign',
  HOST_END: 'host_end'
};

const DIRECTIONS = [
  [1, 0],   // 横向
  [0, 1],   // 纵向
  [1, 1],   // 主对角线
  [1, -1]   // 副对角线
];

// 星位（0 起始坐标）
export const STAR_POINTS = [
  [3, 3], [3, 11], [11, 3], [11, 11], [7, 7]
];

export function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => EMPTY));
}

export function createInitialRoom(hostPlayerId, hostName, roomCode) {
  return {
    id: roomCode,
    code: roomCode,
    hostId: hostPlayerId,
    status: GAME_PHASES.WAITING,
    phase: GAME_PHASES.WAITING,
    players: [{
      id: hostPlayerId,
      name: hostName,
      role: null,          // 'black' | 'white'，开局时分配
      isHost: true,
      isOnline: true,
      order: 0,
      type: 'human'
    }],
    board: createEmptyBoard(),
    currentTurn: null,     // 'black' | 'white'
    moveHistory: [],       // [{ playerId, row, col, color, at }]
    winner: null,          // 'black' | 'white' | 'draw'
    winningLine: null,     // 获胜连线的棋子坐标 [{ row, col }]
    endReason: null,
    turnDeadline: null,    // 当前回合的落子截止时间戳（服务器时间）
    settings: {
      boardSize: BOARD_SIZE,
      turnTimeMs: TURN_TIME_MS
    },
    disconnectedPlayers: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function addPlayerToRoom(room, playerName, playerId) {
  // 断线重连：同 playerId 且当前离线 → 恢复在线
  const existing = room.players.find(p => p.id === playerId);
  if (existing) {
    if (existing.isOnline) {
      return { error: '玩家已在房间中' };
    }
    existing.isOnline = true;
    existing.name = playerName;
    room.disconnectedPlayers = (room.disconnectedPlayers || []).filter(p => p.id !== playerId);
    room.updatedAt = Date.now();
    return { room, reconnected: true };
  }

  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '游戏已开始，无法加入' };
  }
  if (room.players.length >= MAX_PLAYERS) {
    return { error: '房间已满（五子棋为双人对局）' };
  }

  room.players.push({
    id: playerId,
    name: playerName,
    role: null,
    isHost: false,
    isOnline: true,
    order: room.players.length,
    type: 'human'
  });
  room.updatedAt = Date.now();
  return { room, reconnected: false };
}

export function removePlayerFromRoom(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return room;

  // 对局中：标记离线并保留席位（回合计时会自然推进，重连可恢复）
  if (room.phase === GAME_PHASES.PLAYING) {
    player.isOnline = false;
    if (!room.disconnectedPlayers) room.disconnectedPlayers = [];
    if (!room.disconnectedPlayers.some(p => p.id === playerId)) {
      room.disconnectedPlayers.push({
        id: player.id,
        name: player.name,
        role: player.role,
        disconnectedAt: Date.now()
      });
    }
    room.updatedAt = Date.now();
    return room;
  }

  // 等待/结束阶段：直接移除
  room.players = room.players.filter(p => p.id !== playerId);
  room.disconnectedPlayers = (room.disconnectedPlayers || []).filter(p => p.id !== playerId);

  if (room.players.length > 0 && !room.players.some(p => p.id === room.hostId)) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  room.updatedAt = Date.now();
  return room;
}

export function startGame(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '游戏已开始或已结束' };
  }
  if (room.players.length < MAX_PLAYERS) {
    return { error: '需要两名玩家才能开始' };
  }
  if (!room.players.every(p => p.isOnline)) {
    return { error: '等待玩家上线' };
  }

  // 先加入者（房主）执黑先行
  room.players[0].role = 'black';
  room.players[1].role = 'white';
  resetBoardForNewGame(room, now);

  room.status = GAME_PHASES.PLAYING;
  room.phase = GAME_PHASES.PLAYING;
  room.updatedAt = Date.now();
  return { room };
}

export function placeStone(room, playerId, row, col, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '游戏未在进行中' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };
  if (!player.isOnline) return { error: '你已离线，请重新连接' };
  if (player.role !== room.currentTurn) {
    return { error: room.currentTurn === 'black' ? '还没轮到黑棋落子' : '还没轮到白棋落子' };
  }
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { error: `落子位置无效（行/列需在 0–${BOARD_SIZE - 1} 之间）` };
  }
  if (room.board[row][col] !== EMPTY) {
    return { error: '该位置已有棋子' };
  }

  const color = player.role === 'black' ? BLACK : WHITE;
  room.board[row][col] = color;
  room.moveHistory.push({ playerId, row, col, color, at: now });

  const line = checkWin(room.board, row, col);
  if (line) {
    room.winner = player.role;
    room.winningLine = line;
    room.endReason = END_REASONS.WIN;
    room.status = GAME_PHASES.ENDED;
    room.phase = GAME_PHASES.ENDED;
    room.turnDeadline = null;
  } else if (room.moveHistory.length >= BOARD_SIZE * BOARD_SIZE) {
    room.winner = 'draw';
    room.endReason = END_REASONS.DRAW;
    room.status = GAME_PHASES.ENDED;
    room.phase = GAME_PHASES.ENDED;
    room.turnDeadline = null;
  } else {
    room.currentTurn = player.role === 'black' ? 'white' : 'black';
    room.turnDeadline = now + TURN_TIME_MS;
  }

  room.updatedAt = Date.now();
  return { room };
}

/** 从 (row, col) 出发检查是否连成 5 子；获胜时返回整条连线坐标，否则返回 null。 */
export function checkWin(board, row, col) {
  const color = board[row][col];
  if (color === EMPTY) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const line = [{ row, col }];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
        line.push({ row: r, col: c });
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

/** 回合超时：当前该落子的一方判负。 */
export function applyTurnTimeout(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING) return room;
  const loser = room.currentTurn;
  room.winner = loser === 'black' ? 'white' : 'black';
  room.endReason = END_REASONS.TIMEOUT;
  room.status = GAME_PHASES.ENDED;
  room.phase = GAME_PHASES.ENDED;
  room.turnDeadline = null;
  room.updatedAt = now;
  return room;
}

/** 供服务器 tick 调用：到点则判负并返回 true（表示状态有变化需要广播）。 */
export function tickTurnDeadline(room, now) {
  if (room.phase !== GAME_PHASES.PLAYING) return false;
  if (!room.turnDeadline || now < room.turnDeadline) return false;
  applyTurnTimeout(room, now);
  return true;
}

export function resign(room, playerId) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '游戏未在进行中' };
  }
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  room.winner = player.role === 'black' ? 'white' : 'black';
  room.endReason = END_REASONS.RESIGN;
  room.status = GAME_PHASES.ENDED;
  room.phase = GAME_PHASES.ENDED;
  room.turnDeadline = null;
  room.updatedAt = Date.now();
  return { room };
}

export function endGame(room) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '游戏未在进行中' };
  }
  room.status = GAME_PHASES.ENDED;
  room.phase = GAME_PHASES.ENDED;
  room.turnDeadline = null;
  room.endReason = END_REASONS.HOST_END;
  room.updatedAt = Date.now();
  return { room };
}

/** 再来一局：交换先后手，重新开局。 */
export function restartGame(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.ENDED) {
    return { error: '本局尚未结束' };
  }
  if (room.players.length < MAX_PLAYERS) {
    return { error: '需要两名玩家才能重新开始' };
  }
  if (!room.players.every(p => p.isOnline)) {
    return { error: '等待玩家上线' };
  }

  for (const player of room.players) {
    player.role = player.role === 'black' ? 'white' : 'black';
  }
  resetBoardForNewGame(room, now);

  room.status = GAME_PHASES.PLAYING;
  room.phase = GAME_PHASES.PLAYING;
  room.updatedAt = Date.now();
  return { room };
}

function resetBoardForNewGame(room, now) {
  room.board = createEmptyBoard();
  room.currentTurn = 'black';
  room.moveHistory = [];
  room.winner = null;
  room.winningLine = null;
  room.endReason = null;
  room.turnDeadline = now + TURN_TIME_MS;
  room.disconnectedPlayers = [];
}

/** 当前回合剩余毫秒数（客户端展示用；非进行中返回 null）。 */
export function getRemainingTurnMs(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING || !room.turnDeadline) return null;
  return Math.max(0, room.turnDeadline - now);
}
