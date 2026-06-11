const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6) {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS.charAt(array[i] % ROOM_CODE_CHARS.length);
  }
  return code;
}
