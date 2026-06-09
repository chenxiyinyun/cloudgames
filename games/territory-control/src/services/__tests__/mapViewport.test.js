import { describe, expect, it } from 'vitest'
import {
  clampViewport,
  getContainedSize,
  isTapGesture,
  panViewport,
  zoomViewport
} from '../mapViewport'

describe('territory control map viewport helpers', () => {
  it('computes contained size for the battlefield aspect ratio', () => {
    expect(getContainedSize({
      viewportWidth: 320,
      viewportHeight: 500,
      aspectRatio: 1000 / 640
    })).toEqual({
      width: 320,
      height: 204.8
    })
  })

  it('keeps offsets centered when scale returns to 1', () => {
    expect(clampViewport({
      scale: 1,
      offsetX: 80,
      offsetY: -40,
      viewportWidth: 360,
      viewportHeight: 220,
      aspectRatio: 1000 / 640
    })).toMatchObject({
      scale: 1,
      offsetX: 0,
      offsetY: 0
    })
  })

  it('zooms around the pinch focal point', () => {
    expect(zoomViewport({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      nextScale: 2,
      focalX: 240,
      focalY: 100,
      viewportWidth: 320,
      viewportHeight: 200,
      aspectRatio: 2
    })).toMatchObject({
      scale: 2,
      offsetX: -80,
      offsetY: 0
    })
  })

  it('clamps pan distance to the visible battlefield bounds', () => {
    expect(panViewport({
      scale: 2,
      offsetX: 0,
      offsetY: 0,
      deltaX: 999,
      deltaY: -999,
      viewportWidth: 320,
      viewportHeight: 200,
      aspectRatio: 2
    })).toMatchObject({
      scale: 2,
      offsetX: 160,
      offsetY: -80
    })
  })

  it('distinguishes tap from drag gestures', () => {
    expect(isTapGesture({ durationMs: 140, movementPx: 6 })).toBe(true)
    expect(isTapGesture({ durationMs: 280, movementPx: 6 })).toBe(false)
    expect(isTapGesture({ durationMs: 140, movementPx: 18 })).toBe(false)
  })
})
