export const MIN_MAP_SCALE = 1
export const MAX_MAP_SCALE = 2.4
export const MAX_TAP_DURATION_MS = 220
export const MAX_TAP_MOVEMENT_PX = 10

export function getContainedSize({
  viewportWidth,
  viewportHeight,
  aspectRatio
}) {
  const safeWidth = Math.max(0, viewportWidth)
  const safeHeight = Math.max(0, viewportHeight)
  if (safeWidth === 0 || safeHeight === 0) {
    return { width: 0, height: 0 }
  }

  const heightFromWidth = safeWidth / aspectRatio
  if (heightFromWidth <= safeHeight) {
    return { width: safeWidth, height: heightFromWidth }
  }

  const widthFromHeight = safeHeight * aspectRatio
  return { width: widthFromHeight, height: safeHeight }
}

export function clampViewport({
  scale = MIN_MAP_SCALE,
  offsetX = 0,
  offsetY = 0,
  viewportWidth,
  viewportHeight,
  aspectRatio,
  minScale = MIN_MAP_SCALE,
  maxScale = MAX_MAP_SCALE
}) {
  const nextScale = clamp(scale, minScale, maxScale)
  const { width, height } = getContainedSize({
    viewportWidth,
    viewportHeight,
    aspectRatio
  })

  const maxOffsetX = Math.max(0, (width * nextScale - width) / 2)
  const maxOffsetY = Math.max(0, (height * nextScale - height) / 2)

  return {
    scale: nextScale,
    offsetX: normalizeZero(clamp(offsetX, -maxOffsetX, maxOffsetX)),
    offsetY: normalizeZero(clamp(offsetY, -maxOffsetY, maxOffsetY)),
    contentWidth: width,
    contentHeight: height
  }
}

export function panViewport({
  scale,
  offsetX,
  offsetY,
  deltaX,
  deltaY,
  viewportWidth,
  viewportHeight,
  aspectRatio,
  minScale = MIN_MAP_SCALE,
  maxScale = MAX_MAP_SCALE
}) {
  return clampViewport({
    scale,
    offsetX: offsetX + deltaX,
    offsetY: offsetY + deltaY,
    viewportWidth,
    viewportHeight,
    aspectRatio,
    minScale,
    maxScale
  })
}

export function zoomViewport({
  scale,
  offsetX,
  offsetY,
  nextScale,
  focalX,
  focalY,
  viewportWidth,
  viewportHeight,
  aspectRatio,
  minScale = MIN_MAP_SCALE,
  maxScale = MAX_MAP_SCALE
}) {
  const safeScale = clamp(scale, minScale, maxScale)
  const clampedNextScale = clamp(nextScale, minScale, maxScale)
  const scaleRatio = safeScale === 0 ? 1 : clampedNextScale / safeScale
  const focalDx = focalX - viewportWidth / 2
  const focalDy = focalY - viewportHeight / 2

  return clampViewport({
    scale: clampedNextScale,
    offsetX: (1 - scaleRatio) * focalDx + scaleRatio * offsetX,
    offsetY: (1 - scaleRatio) * focalDy + scaleRatio * offsetY,
    viewportWidth,
    viewportHeight,
    aspectRatio,
    minScale,
    maxScale
  })
}

export function isTapGesture({
  durationMs,
  movementPx,
  maxDurationMs = MAX_TAP_DURATION_MS,
  maxMovementPx = MAX_TAP_MOVEMENT_PX
}) {
  return durationMs <= maxDurationMs && movementPx <= maxMovementPx
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value
}
