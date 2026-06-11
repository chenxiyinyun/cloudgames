import { describe, expect, it } from 'vitest'
import { getMovingTroopVisuals, TRAVEL_TIME_PER_EDGE } from '../gameView'

const STREAM_DURATION = 600
const INDIVIDUAL_DURATION = TRAVEL_TIME_PER_EDGE - STREAM_DURATION

function soldierProgress(i, amount, elapsed) {
  const delay = amount > 1 ? (i / (amount - 1)) * STREAM_DURATION : 0
  const soldierElapsed = elapsed - delay
  if (soldierElapsed < 0) return -1
  return Math.min(1, Math.max(0, soldierElapsed / INDIVIDUAL_DURATION))
}

describe('territory control view helpers', () => {
  it('returns one visual per soldier with staggered departures midway through travel', () => {
    const amount = 12
    const stepStartTime = 1000
    const elapsed = TRAVEL_TIME_PER_EDGE / 2

    const visuals = getMovingTroopVisuals({
      movingTroops: [{
        id: 'mv1',
        playerId: 'p1',
        amount,
        path: ['a', 'b'],
        currentStep: 0
      }],
      territories: [
        { id: 'a', x: 100, y: 120 },
        { id: 'b', x: 300, y: 220 }
      ],
      animationStateById: { mv1: { stepStartTime } },
      now: stepStartTime + elapsed
    })

    const expected = []
    for (let i = 0; i < amount; i += 1) {
      const progress = soldierProgress(i, amount, elapsed)
      if (progress < 0 || progress >= 1) continue
      expected.push({
        id: `mv1-${i}`,
        playerId: 'p1',
        progress: expect.closeTo(progress, 3)
      })
    }

    expect(visuals).toHaveLength(expected.length)
    visuals.forEach((visual, index) => {
      expect(visual.id).toBe(expected[index].id)
      expect(visual.playerId).toBe(expected[index].playerId)
      expect(visual.progress).toEqual(expected[index].progress)
    })
  })

  it('skips troops with missing territories and stops rendering once soldiers arrive', () => {
    const amount = 8
    const stepStartTime = 0
    const now = TRAVEL_TIME_PER_EDGE * 4

    const visuals = getMovingTroopVisuals({
      movingTroops: [
        {
          id: 'mv1',
          playerId: 'p1',
          amount,
          path: ['a', 'b'],
          currentStep: 0
        },
        {
          id: 'mv2',
          playerId: 'p2',
          amount: 6,
          path: ['missing', 'b'],
          currentStep: 0
        }
      ],
      territories: [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 90, y: 30 }
      ],
      animationStateById: { mv1: { stepStartTime } },
      now
    })

    // mv2 → missing territory, skipped entirely
    expect(visuals.find(v => v.id.startsWith('mv2'))).toBeUndefined()
    // mv1 → all soldiers past travel time, no visuals remain
    expect(visuals.find(v => v.id.startsWith('mv1'))).toBeUndefined()
  })
})
