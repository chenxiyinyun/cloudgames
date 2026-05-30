/**
 * Input sanitization module for 喵喵猜词 P2P game.
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
 * Sanitize a storyteller's clue text (Dixit hint).
 * - Trim whitespace
 * - Strip HTML tags, angle brackets, and quote characters
 * - Limit to 20 characters
 *
 * @param {string} text - raw clue text
 * @returns {{ value: string, error: string|null }}
 */
export function sanitizeStoryClue(text) {
  if (typeof text !== 'string') {
    return { value: '', error: '提示内容无效' };
  }

  let value = text.trim();
  value = stripHtmlAndDangerous(value);
  value = value.substring(0, 20);

  if (!value) {
    return { value: '', error: '提示不能为空' };
  }

  return { value, error: null };
}
