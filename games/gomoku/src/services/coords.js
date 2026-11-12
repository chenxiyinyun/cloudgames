// 棋盘坐标工具：列字母（围棋惯例跳过 I）与坐标换算
import { BOARD_SIZE } from './gameEngine';

// 15 列：A–H、J–P（跳过 I，共 15 个字母）
export const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

/** 行列（0 起始）→ 棋谱坐标，如 H8 */
export function coordLabel(row, col) {
  return `${COL_LETTERS[col]}${BOARD_SIZE - row}`;
}
