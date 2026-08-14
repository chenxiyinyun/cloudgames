/**
 * Shared input sanitization primitives.
 * Prevents XSS and injection by cleaning user-facing string inputs before
 * they are stored or sent through the WebSocket protocol.
 *
 * Games compose their own sanitize.js on top of these factories, supplying
 * game-specific limits, fallbacks and error messages.
 */

/**
 * Strip HTML tags, quote characters and stray angle brackets from any value.
 * Non-string values are coerced via String(value ?? ''). Result is trimmed.
 *
 * @param {*} value - raw input
 * @returns {string} cleaned string
 */
export function stripUnsafeText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')   // strip complete HTML tags like <script>
    .replace(/["'`]/g, '')      // strip quote characters
    .replace(/[<>]/g, '')       // strip stray angle brackets
    .trim();
}

/**
 * Build a player name sanitizer.
 * - Strips unsafe characters, trims, limits to maxLength
 * - When the result is empty: falls back to `fallback` (with `emptyError`
 *   notice) if a fallback is configured, otherwise returns an empty value
 *   with `emptyError`
 * - Non-string input: if `fallbackOnNonString` is true, returns the fallback
 *   silently; otherwise it is treated like an empty string
 *
 * @param {object} options
 * @param {number} options.maxLength - max characters kept (default 20)
 * @param {string|null} [options.fallback] - name used when input is empty
 * @param {string|null} options.emptyError - error shown for empty input
 * @param {boolean} [options.fallbackOnNonString] - silently fall back for non-string input
 * @returns {(name: *) => { value: string, error: string|null }}
 */
export function createPlayerNameSanitizer({ maxLength = 20, fallback = null, emptyError, fallbackOnNonString = false }) {
  return function sanitizePlayerName(name) {
    if (typeof name !== 'string') {
      if (fallbackOnNonString) {
        return { value: fallback ?? '', error: null };
      }
      // coerce non-string input like an empty string
      name = '';
    }

    const value = stripUnsafeText(name).substring(0, maxLength);
    if (!value) {
      if (fallback) {
        return { value: fallback, error: emptyError ?? null };
      }
      return { value: '', error: emptyError ?? null };
    }

    return { value, error: null };
  };
}

/**
 * Build a room code sanitizer.
 * - Trims, uppercases, strips non-alphanumeric characters (A-Z, 0-9)
 * - Validates exact length of 6
 *
 * @param {object} options
 * @param {string|null} [options.nonStringError] - error for non-string input (skips empty check when set)
 * @param {string} options.emptyError - error when nothing valid remains
 * @param {string} options.lengthError - error when length is not 6
 * @returns {(code: *) => { value: string, error: string|null }}
 */
export function createRoomCodeSanitizer({ nonStringError = null, emptyError, lengthError }) {
  return function sanitizeRoomCode(code) {
    if (nonStringError !== null && typeof code !== 'string') {
      return { value: '', error: nonStringError };
    }

    const value = stripUnsafeText(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!value) {
      return { value: '', error: emptyError };
    }
    if (value.length !== 6) {
      return { value: '', error: lengthError };
    }

    return { value, error: null };
  };
}

/**
 * Build a short free-text sanitizer (clues, hints, messages...).
 * - Strips unsafe characters, trims, limits to maxLength
 * - Empty result yields `emptyError` when configured, otherwise passes through
 *
 * @param {object} options
 * @param {number} options.maxLength - max characters kept
 * @param {string|null} [options.emptyError] - error for empty result; null keeps empty silently
 * @param {string|null} [options.nonStringError] - error for non-string input; null treats as empty string
 * @returns {(text: *) => { value: string, error: string|null }}
 */
export function createTextSanitizer({ maxLength, emptyError = null, nonStringError = null }) {
  return function sanitizeText(text) {
    if (typeof text !== 'string') {
      return { value: '', error: nonStringError };
    }

    const value = stripUnsafeText(text).substring(0, maxLength);
    if (!value && emptyError) {
      return { value: '', error: emptyError };
    }

    return { value, error: null };
  };
}
