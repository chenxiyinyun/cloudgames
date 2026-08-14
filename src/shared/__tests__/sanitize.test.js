import { describe, expect, it } from 'vitest';
import {
  createPlayerNameSanitizer,
  createRoomCodeSanitizer,
  createTextSanitizer,
  stripUnsafeText
} from '../sanitize';

describe('stripUnsafeText', () => {
  it('strips HTML tags, quotes and angle brackets', () => {
    expect(stripUnsafeText('<script>alert(1)</script>"hi"')).toBe('alert(1)hi');
    expect(stripUnsafeText('a<b')).toBe('ab');
  });

  it('coerces non-string input and trims', () => {
    expect(stripUnsafeText(null)).toBe('');
    expect(stripUnsafeText(123)).toBe('123');
    expect(stripUnsafeText('  abc  ')).toBe('abc');
  });
});

describe('createPlayerNameSanitizer', () => {
  const withFallback = createPlayerNameSanitizer({
    maxLength: 20,
    fallback: 'Player',
    emptyError: '代号为空，已使用默认代号',
    fallbackOnNonString: true
  });

  const strict = createPlayerNameSanitizer({
    maxLength: 18,
    emptyError: '请输入玩家名'
  });

  it('truncates to maxLength and keeps error null', () => {
    expect(withFallback('x'.repeat(50))).toEqual({ value: 'x'.repeat(20), error: null });
    expect(strict('x'.repeat(50))).toEqual({ value: 'x'.repeat(18), error: null });
  });

  it('falls back with notice when empty after cleaning', () => {
    expect(withFallback('   <b></b>')).toEqual({ value: 'Player', error: '代号为空，已使用默认代号' });
  });

  it('non-string silently falls back when fallbackOnNonString is set', () => {
    expect(withFallback(42)).toEqual({ value: 'Player', error: null });
    expect(strict(42)).toEqual({ value: '', error: '请输入玩家名' });
  });
});

describe('createRoomCodeSanitizer', () => {
  const withNonStringError = createRoomCodeSanitizer({
    nonStringError: '任务编号无效',
    emptyError: '请输入任务编号',
    lengthError: '任务编号必须为6位字符（字母或数字）'
  });

  const plain = createRoomCodeSanitizer({
    emptyError: 'Room code is required.',
    lengthError: 'Room code must be 6 letters or numbers.'
  });

  it('uppercases and keeps valid 6-char codes', () => {
    expect(withNonStringError(' abc123 ')).toEqual({ value: 'ABC123', error: null });
  });

  it('strips invalid characters and reports length errors', () => {
    expect(withNonStringError('ab!')).toEqual({ value: '', error: '任务编号必须为6位字符（字母或数字）' });
    expect(plain('abc')).toEqual({ value: '', error: 'Room code must be 6 letters or numbers.' });
  });

  it('reports empty and non-string errors', () => {
    expect(withNonStringError('')).toEqual({ value: '', error: '请输入任务编号' });
    expect(withNonStringError(null)).toEqual({ value: '', error: '任务编号无效' });
    expect(plain(null)).toEqual({ value: '', error: 'Room code is required.' });
  });
});

describe('createTextSanitizer', () => {
  it('limits length and reports empty errors when configured', () => {
    const clue = createTextSanitizer({ maxLength: 20, emptyError: '提示不能为空', nonStringError: '提示内容无效' });
    expect(clue('  hello ')).toEqual({ value: 'hello', error: null });
    expect(clue('')).toEqual({ value: '', error: '提示不能为空' });
    expect(clue(1)).toEqual({ value: '', error: '提示内容无效' });
  });

  it('passes empty through silently when no emptyError is set', () => {
    const word = createTextSanitizer({ maxLength: 30 });
    expect(word('')).toEqual({ value: '', error: null });
    expect(word(1)).toEqual({ value: '', error: null });
    expect(word('x'.repeat(50))).toEqual({ value: 'x'.repeat(30), error: null });
  });
});
