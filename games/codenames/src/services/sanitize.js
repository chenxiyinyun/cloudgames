/**
 * Input sanitization module for Codename.
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
 * Sanitize a single clue word (empty results are filtered out by sanitizeClues).
 */
export const sanitizeClueWord = createTextSanitizer({ maxLength: 30 });

/**
 * Sanitize an array of clue words.
 * Applies sanitizeClueWord to each, filters out empty strings,
 * and validates that at least 1 clue remains.
 *
 * @param {string[]} clues - raw clue array
 * @returns {{ value: string[], error: string|null }}
 */
export function sanitizeClues(clues) {
  if (!Array.isArray(clues)) {
    return { value: [], error: '线索格式无效' };
  }

  const sanitized = clues
    .map(c => sanitizeClueWord(c).value)
    .filter(c => c.length > 0);

  if (sanitized.length === 0) {
    return { value: [], error: '至少需要1个有效线索' };
  }

  return { value: sanitized, error: null };
}
