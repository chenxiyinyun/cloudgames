import { describe, expect, it } from 'vitest'
import { getMovingTroopVisuals, TRAVEL_TIME_PER_EDGE } from '../gameView'

describe('territory control view helpers', () => {
  it('interpolates moving troop positions based on elapsed time', () => {
    const visuals = getMovingTroopVisuals({
      movingTroops: [{
        id: 'mv1',
        playerId: 'p1',
        amount: 12,
        path: ['a', 'b'],
        currentStep: 0
      }],
      territories: [
        { id: 'a', x: 100, y: 120 },
        { id: 'b', x: 300, y: 220 }
      ],
      animationStateById: {
        mv1: { stepStartTime: 1000 }
      },
      now: 1000 + TRAVEL_TIME_PER_EDGE / 2
    })

    expect(visuals).toEqual([{
      id: 'mv1',
      playerId: 'p1',
      amount: 12,
      x: 200,
      y: 170,
      progress: 0.5
    }])
  })

  it('clamps progress and skips troops with missing territories', () => {
    const visuals = getMovingTroopVisuals({
      movingTroops: [
        {
          id: 'mv1',
          playerId: 'p1',
          amount: 8,
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
      animationStateById: {
        mv1: { stepStartTime: 0 }
      },
      now: TRAVEL_TIME_PER_EDGE * 4
    })

    expect(visuals).toEqual([{
      id: 'mv1',
      playerId: 'p1',
      amount: 8,
      x: 90,
      y: 30,
      progress: 1
    }])
  })
})
