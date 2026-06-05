const SIZE = 5

// dx/dy use grid coordinates with y growing downward; `opposite` carves the
// matching opening in the neighbouring cell.
const DIRECTIONS = {
  up: { dx: 0, dy: -1, opposite: 'down' },
  down: { dx: 0, dy: 1, opposite: 'up' },
  left: { dx: -1, dy: 0, opposite: 'right' },
  right: { dx: 1, dy: 0, opposite: 'left' }
}

export function generateMazeModule(context, random) {
  const cells = carveMaze(SIZE, random)
  const { start, goal } = pickEndpoints(SIZE, random)

  return {
    id: context.id,
    type: 'maze',
    status: 'unsolved',
    // The defuser only sees their position and the goal — never the walls.
    bombView: {
      size: SIZE,
      position: { ...start },
      goal: { ...goal }
    },
    // The expert reads the walls (and the live position) from the manual.
    manualView: {
      size: SIZE,
      cells,
      start: { ...start },
      goal: { ...goal }
    },
    solution: {
      cells,
      goal: { ...goal }
    }
  }
}

// Resolves a move into one of three outcomes the engine understands:
// 'progress' (valid step), 'solved' (reached the goal), or 'strike' (hit a wall
// or sent a malformed action).
export function resolveMazeAction(module, action) {
  if (action?.type !== 'move' || !DIRECTIONS[action.direction]) {
    return { result: 'strike' }
  }

  const position = module.bombView.position
  const cell = module.solution.cells[position.y]?.[position.x]
  if (!cell || !cell[action.direction]) {
    return { result: 'strike' }
  }

  const dir = DIRECTIONS[action.direction]
  const next = { x: position.x + dir.dx, y: position.y + dir.dy }
  const goal = module.solution.goal

  if (next.x === goal.x && next.y === goal.y) {
    return { result: 'solved', bombView: { position: next } }
  }
  return { result: 'progress', bombView: { position: next } }
}

function carveMaze(size, random) {
  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ up: false, down: false, left: false, right: false }))
  )
  const visited = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  const stack = [{ x: 0, y: 0 }]
  visited[0][0] = true

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const options = Object.entries(DIRECTIONS).filter(([, dir]) => {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy
      return inBounds(nx, ny, size) && !visited[ny][nx]
    })

    if (options.length === 0) {
      stack.pop()
      continue
    }

    const [name, dir] = options[Math.floor(random() * options.length)]
    const nx = current.x + dir.dx
    const ny = current.y + dir.dy
    cells[current.y][current.x][name] = true
    cells[ny][nx][dir.opposite] = true
    visited[ny][nx] = true
    stack.push({ x: nx, y: ny })
  }

  return cells
}

function pickEndpoints(size, random) {
  const start = randomCell(size, random)
  let goal = randomCell(size, random)
  for (let attempt = 0; attempt < 60 && !isFarEnough(start, goal, size); attempt += 1) {
    goal = randomCell(size, random)
  }
  if (start.x === goal.x && start.y === goal.y) {
    goal = start.x === 0 && start.y === 0
      ? { x: size - 1, y: size - 1 }
      : { x: 0, y: 0 }
  }
  return { start, goal }
}

function isFarEnough(start, goal, size) {
  const distance = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y)
  return distance >= size - 1
}

function randomCell(size, random) {
  return { x: Math.floor(random() * size), y: Math.floor(random() * size) }
}

function inBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size
}
