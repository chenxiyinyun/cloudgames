/**
 * Input sanitization module for Codename P2P game.
 * Prevents XSS and injection by cleaning all user-facing string inputs
 * before they are stored or broadcast via WebRTC.
 */

/**
 * Strip HTML tags and dangerous characters from a string.
 * @param {string} str
 * @returns {string}
 */
function stripHtmlAndDangerous(str) {
  return str
    .replace(/<[^>]*>/g, '')   // strip complete HTML tags like <script>
    .replace(/["'`]/g, '')      // strip quote characters
    .replace(/[<>]/g, '');      // strip stray angle brackets
}

/**
 * Sanitize a player name.
 * - Trim whitespace
 * - Strip HTML tags, angle brackets, and quote characters
 * - Limit to 20 characters
 * - Default to "Player" if empty after sanitization
 *
 * @param {string} name - raw player name
 * @returns {{ value: string, error: string|null }}
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') {
    return { value: 'Player', error: null };
  }

  let value = name.trim();
  value = stripHtmlAndDangerous(value);
  value = value.substring(0, 20);

  if (!value) {
    return { value: 'Player', error: '代号为空，已使用默认代号' };
  }

  return { value, error: null };
}

/**
 * Sanitize a room code.
 * - Trim whitespace
 * - Uppercase
 * - Strip non-alphanumeric characters (A-Z, 0-9)
 * - Validate exact length of 6
 *
 * @param {string} code - raw room code
 * @returns {{ value: string, error: string|null }}
 */
export function sanitizeRoomCode(code) {
  if (typeof code !== 'string') {
    return { value: '', error: '任务编号无效' };
  }

  let value = code.trim().toUpperCase();
  value = value.replace(/[^A-Z0-9]/g, '');

  if (!value) {
    return { value: '', error: '请输入任务编号' };
  }

  if (value.length !== 6) {
    return { value: '', error: '任务编号必须为6位字符（字母或数字）' };
  }

  return { value, error: null };
}

/**
 * Sanitize a single clue word.
 * - Trim whitespace
 * - Strip HTML tags, angle brackets, and quote characters
 * - Limit to 30 characters
 *
 * @param {string} word - raw clue word
 * @returns {{ value: string, error: null }}
 */
export function sanitizeClueWord(word) {
  if (typeof word !== 'string') {
    return { value: '', error: null };
  }

  let value = word.trim();
  value = stripHtmlAndDangerous(value);
  value = value.substring(0, 30);

  return { value, error: null };
}

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
