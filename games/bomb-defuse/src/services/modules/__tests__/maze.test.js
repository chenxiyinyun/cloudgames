import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../index'
import { generateMazeModule, resolveMazeAction } from '../maze'

const STEP = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }

// Breadth-first path of directions from start to goal, walking only through
// carved openings. Returns null if the goal is unreachable.
function solvePath(cells, start, goal) {
  const keyOf = cell => `${cell.x},${cell.y}`
  const prev = new Map([[keyOf(start), null]])
  const queue = [start]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current.x === goal.x && current.y === goal.y) break
    for (const [name, step] of Object.entries(STEP)) {
      if (!cells[current.y][current.x][name]) continue
      const next = { x: current.x + step.dx, y: current.y + step.dy }
      if (prev.has(keyOf(next))) continue
      prev.set(keyOf(next), { from: current, dir: name })
      queue.push(next)
    }
  }

  if (!prev.has(keyOf(goal))) return null
  const path = []
  let node = keyOf(goal)
  while (prev.get(node)) {
    const { from, dir } = prev.get(node)
    path.unshift(dir)
    node = keyOf(from)
  }
  return path
}

// 2x2 fixture: (0,0) --down--> (0,1) --right--> (1,1, goal). (1,0) is isolated.
function fixtureMaze() {
  return {
    type: 'maze',
    status: 'unsolved',
    bombView: { size: 2, position: { x: 0, y: 0 }, goal: { x: 1, y: 1 } },
    solution: {
      cells: [
        [{ up: false, down: true, left: false, right: false }, { up: false, down: false, left: false, right: false }],
        [{ up: true, down: false, left: false, right: true }, { up: false, down: false, left: true, right: false }]
      ],
      goal: { x: 1, y: 1 }
    }
  }
}

describe('maze module', () => {
  it('generates a board with distinct start and goal', () => {
    const module = generateMazeModule({ id: 'maze-1' }, createSeededRandom('maze-test'))

    expect(module.type).toBe('maze')
    expect(module.bombView.size).toBe(module.manualView.size)
    expect(module.bombView.position).toEqual(module.manualView.start)
    expect(module.manualView.start).not.toEqual(module.manualView.goal)
    expect(module.manualView.cells).toHaveLength(module.manualView.size)
  })

  it('produces a solvable maze across many seeds', () => {
    for (let index = 0; index < 200; index += 1) {
      const module = generateMazeModule({ id: 'maze-1' }, createSeededRandom(`solvable-${index}`))
      const path = solvePath(module.solution.cells, module.bombView.position, module.solution.goal)
      expect(path).not.toBeNull()
      expect(path.length).toBeGreaterThan(0)
    }
  })

  it('strikes on a malformed action or a wall', () => {
    const module = fixtureMaze()

    expect(resolveMazeAction(module, { type: 'press_key' })).toEqual({ result: 'strike' })
    expect(resolveMazeAction(module, { type: 'move', direction: 'sideways' })).toEqual({ result: 'strike' })
    // (0,0) has walls up, left and right.
    expect(resolveMazeAction(module, { type: 'move', direction: 'right' })).toEqual({ result: 'strike' })
    expect(resolveMazeAction(module, { type: 'move', direction: 'up' })).toEqual({ result: 'strike' })
  })

  it('advances on a valid step and solves on reaching the goal', () => {
    const module = fixtureMaze()

    const first = resolveMazeAction(module, { type: 'move', direction: 'down' })
    expect(first).toEqual({ result: 'progress', bombView: { position: { x: 0, y: 1 } } })

    module.bombView.position = first.bombView.position
    const second = resolveMazeAction(module, { type: 'move', direction: 'right' })
    expect(second).toEqual({ result: 'solved', bombView: { position: { x: 1, y: 1 } } })
  })

  it('can be driven from start to goal along the generated path without striking', () => {
    const module = generateMazeModule({ id: 'maze-1' }, createSeededRandom('drive-test'))
    const path = solvePath(module.solution.cells, module.bombView.position, module.solution.goal)

    let last = null
    path.forEach((direction, index) => {
      last = resolveMazeAction(module, { type: 'move', direction })
      expect(last.result).toBe(index === path.length - 1 ? 'solved' : 'progress')
      module.bombView.position = last.bombView.position
    })
    expect(last.result).toBe('solved')
  })
})
