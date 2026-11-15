import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  GAME_PHASES,
  gameState,
  handleEndGame,
  handlePlaceStone,
  handleResign,
  reconnectRoom
} from '../stores/gameStore';

/**
 * 五子棋对局视图状态：把计时、文案、派生状态与操作从 GameScreen 模板里抽出来，
 * 组件只负责布局与展示。规则本身仍在 gameEngine 里。
 */
export function useGomokuView() {
  const showRules = ref(false);
  const confirmingResign = ref(false);
  const isReconnecting = ref(false);
  let resignTimer = null;

  const room = computed(() => gameState.room);
  const players = computed(() => room.value.players || []);
  const blackPlayer = computed(() => players.value.find(player => player.role === 'black'));
  const whitePlayer = computed(() => players.value.find(player => player.role === 'white'));
  const moveHistory = computed(() => room.value.moveHistory || []);
  const moveCount = computed(() => moveHistory.value.length);
  const lastMove = computed(() => moveHistory.value[moveHistory.value.length - 1] || null);

  const isBlackTurn = computed(() => room.value.phase === GAME_PHASES.PLAYING && room.value.currentTurn === 'black');
  const isWhiteTurn = computed(() => room.value.phase === GAME_PHASES.PLAYING && room.value.currentTurn === 'white');

  const connectionStatus = computed(() => gameState.connectionStatus);
  const connectionMessage = computed(() => gameState.connectionMessage);

  const isOnline = computed(() => {
    const me = players.value.find(player => player.id === gameState.playerId);
    return me?.isOnline !== false;
  });

  const canPlace = computed(() => {
    return room.value.phase === GAME_PHASES.PLAYING
      && gameState.role !== null
      && gameState.role === room.value.currentTurn
      && isOnline.value;
  });

  const canResign = computed(() => room.value.phase === GAME_PHASES.PLAYING && isOnline.value);

  // ── 回合计时展示 ──────────────────────────────────────────────────────────
  const nowTick = ref(Date.now());
  let timer = null;

  onMounted(() => {
    timer = setInterval(() => { nowTick.value = Date.now(); }, 500);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
    if (resignTimer) clearTimeout(resignTimer);
  });

  const remainingSeconds = computed(() => {
    const deadline = room.value.turnDeadline;
    if (!deadline || room.value.phase !== GAME_PHASES.PLAYING) return null;
    return Math.max(0, Math.ceil((deadline - nowTick.value) / 1000));
  });

  const isUrgent = computed(() => remainingSeconds.value !== null && remainingSeconds.value <= 10);

  const countdownText = computed(() => {
    if (remainingSeconds.value === null) return '--';
    return `${remainingSeconds.value}s`;
  });

  // ── 文案 ──────────────────────────────────────────────────────────────────
  const turnText = computed(() => {
    if (room.value.phase === GAME_PHASES.WAITING) return '等待开始';
    if (room.value.phase === GAME_PHASES.ENDED) {
      if (room.value.winner === 'draw') return '平局';
      if (!room.value.winner) return '对局结束';
      return `${room.value.winner === 'black' ? '黑棋' : '白棋'}获胜`;
    }
    return gameState.role === room.value.currentTurn ? '轮到你落子' : '等待对手落子';
  });

  const isEnded = computed(() => room.value.phase === GAME_PHASES.ENDED);

  const endBannerTitle = computed(() => {
    if (room.value.winner === 'draw') return '握手言和';
    if (!room.value.winner) return '对局结束';
    return gameState.role === room.value.winner ? '你赢了！' : '你输了';
  });

  const endBannerClass = computed(() => {
    if (room.value.winner === 'draw' || !room.value.winner) return 'draw';
    return gameState.role === room.value.winner ? 'win' : 'lose';
  });

  const endBannerSub = computed(() => {
    if (room.value.winner === 'draw') return '棋盘下满，双方势均力敌';
    if (!room.value.winner) return '房主结束了本局对弈';
    const winnerName = players.value.find(player => player.role === room.value.winner)?.name || '对手';
    return `${room.value.winner === 'black' ? '黑棋' : '白棋'} · ${winnerName} 获得胜利`;
  });

  // ── 操作 ──────────────────────────────────────────────────────────────────
  function showResult() {
    gameState.screen = 'result';
  }

  function openRules() {
    showRules.value = true;
  }

  function closeRules() {
    showRules.value = false;
  }

  function onPlaceStone({ row, col }) {
    if (!canPlace.value) return;
    handlePlaceStone(row, col);
  }

  function onResignClick() {
    if (!canResign.value) return;
    if (!confirmingResign.value) {
      confirmingResign.value = true;
      resignTimer = setTimeout(() => { confirmingResign.value = false; }, 3000);
      return;
    }
    confirmingResign.value = false;
    clearTimeout(resignTimer);
    handleResign();
  }

  function onEndGame() {
    if (!gameState.isHost) return;
    handleEndGame();
  }

  async function handleReconnect() {
    isReconnecting.value = true;
    try {
      await reconnectRoom();
    } finally {
      isReconnecting.value = false;
    }
  }

  return {
    room,
    players,
    blackPlayer,
    whitePlayer,
    moveHistory,
    moveCount,
    lastMove,
    isBlackTurn,
    isWhiteTurn,
    connectionStatus,
    connectionMessage,
    isOnline,
    canPlace,
    canResign,
    isUrgent,
    countdownText,
    turnText,
    isEnded,
    endBannerTitle,
    endBannerClass,
    endBannerSub,
    showRules,
    confirmingResign,
    isReconnecting,
    showResult,
    openRules,
    closeRules,
    onPlaceStone,
    onResignClick,
    onEndGame,
    handleReconnect
  };
}
