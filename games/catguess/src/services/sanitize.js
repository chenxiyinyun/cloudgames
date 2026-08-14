/**
 * Input sanitization module for 喵喵猜词.
 * Composes game-specific sanitizers on top of the shared primitives.
 */

import {
  createPlayerNameSanitizer,
  createRoomCodeSanitizer,
  createTextSanitizer
} from '../../../../src/shared/sanitize';

export const sanitizePlayerName = createPlayerNameSanitizer({
  maxLength: 20,
  fallback: 'Player',
  emptyError: '代号为空，已使用默认代号',
  fallbackOnNonString: true
});

export const sanitizeRoomCode = createRoomCodeSanitizer({
  nonStringError: '任务编号无效',
  emptyError: '请输入任务编号',
  lengthError: '任务编号必须为6位字符（字母或数字）'
});

/**
 * Sanitize a storyteller's clue text (Dixit hint).
 */
export const sanitizeStoryClue = createTextSanitizer({
  maxLength: 20,
  emptyError: '提示不能为空',
  nonStringError: '提示内容无效'
});
