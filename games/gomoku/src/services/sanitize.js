/**
 * Input sanitization for Gomoku.
 * Composes game-specific sanitizers on top of the shared primitives.
 */

import {
  createPlayerNameSanitizer,
  createRoomCodeSanitizer
} from '../../../../src/shared/sanitize';

export const sanitizePlayerName = createPlayerNameSanitizer({
  maxLength: 20,
  fallback: '棋士',
  emptyError: '代号为空，已使用默认代号',
  fallbackOnNonString: true
});

export const sanitizeRoomCode = createRoomCodeSanitizer({
  nonStringError: '房间号无效',
  emptyError: '请输入房间号',
  lengthError: '房间号必须为6位字符（字母或数字）'
});
