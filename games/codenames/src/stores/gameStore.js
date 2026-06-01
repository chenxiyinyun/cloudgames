// 门面：保持组件的 import 路径与公共 API 稳定。
// 实际实现已拆分为 roomState / timers / messageHandlers / connection 四个模块。
export { gameState, restoreFromCache, hasRestoreableState } from './roomState';
export {
  createRoom,
  joinRoom,
  reconnectRoom,
  leaveRoom,
  handleStartGame,
  handleSubmitClues,
  handleSubmitTeamGuess,
  handleSubmitOpponentGuess,
  handleSubmitOpponentVote,
  handleSubmitTeamVote,
  handleNextRound,
  handlePlayAgain,
  RECONNECT_METADATA
} from './connection';
export { GAME_PHASES, GUESS_TYPE } from '../services/gameEngine';
