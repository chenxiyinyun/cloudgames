import {
  createPlayerNameSanitizer,
  createRoomCodeSanitizer,
  stripUnsafeText
} from '../../../../src/shared/sanitize'

export const sanitizePlayerName = createPlayerNameSanitizer({
  maxLength: 18,
  emptyError: '请输入玩家名'
})

export const sanitizeRoomCode = createRoomCodeSanitizer({
  emptyError: '请输入房间号',
  lengthError: '房间号需要 6 位'
})

export function sanitizeMapSize(mapSize) {
  const value = stripUnsafeText(mapSize)
  if (!['small', 'medium', 'large'].includes(value)) {
    return { value: 'medium', error: '未知地图尺寸' }
  }
  return { value, error: null }
}

export function sanitizeTheme(theme) {
  const value = stripUnsafeText(theme)
  if (!['default', 'catpaw'].includes(value)) {
    return { value: 'default', error: '未知主题' }
  }
  return { value, error: null }
}

export function sanitizeDispatch(payload) {
  if (!payload || typeof payload !== 'object') {
    return { value: null, error: '无效派遣' }
  }
  const sourceId = stripUnsafeText(payload.sourceId)
  const targetId = stripUnsafeText(payload.targetId)
  const ratio = Number(payload.ratio)
  if (!sourceId || !targetId) return { value: null, error: '请选择领地' }
  if (![0.25, 0.5, 0.75].includes(ratio)) return { value: null, error: '未知派遣比例' }
  return {
    value: {
      sourceId,
      targetId,
      ratio,
      seq: Number(payload.seq) || 0
    },
    error: null
  }
}
