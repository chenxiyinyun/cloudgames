export const SYMBOL_COLUMNS = [
  ['omega', 'lambda', 'star', 'spiral', 'hook', 'trident'],
  ['six', 'paragraph', 'lambda', 'bolt', 'spiral', 'question'],
  ['copyright', 'eye', 'star', 'trident', 'smile', 'omega'],
  ['hook', 'six', 'question', 'paragraph', 'eye', 'bolt']
]

export const SYMBOL_LABELS = {
  omega: 'Omega',
  lambda: 'Lambda',
  star: 'Star',
  spiral: 'Spiral',
  hook: 'Hook',
  trident: 'Trident',
  six: 'Six',
  paragraph: 'Paragraph',
  bolt: 'Bolt',
  question: 'Question',
  copyright: 'Copyright',
  eye: 'Eye',
  smile: 'Smile'
}

export function generateSymbolsModule(context, random) {
  const column = SYMBOL_COLUMNS[Math.floor(random() * SYMBOL_COLUMNS.length)]
  const symbols = pickUnique(column, 4, random).map(symbolId => ({
    id: symbolId,
    label: SYMBOL_LABELS[symbolId]
  }))
  const action = resolveSymbolsSolution({
    symbols: symbols.map(symbol => symbol.id),
    column
  })

  return {
    id: context.id,
    type: 'symbols',
    status: 'unsolved',
    bombView: {
      symbols
    },
    manualView: {
      columns: SYMBOL_COLUMNS,
      labels: SYMBOL_LABELS
    },
    solution: {
      action
    }
  }
}

export function resolveSymbolsSolution({ symbols, column }) {
  return {
    type: 'press_symbols',
    symbolIds: column.filter(symbolId => symbols.includes(symbolId))
  }
}

export function validateSymbolsAction(module, action) {
  return action?.type === 'press_symbols' &&
    Array.isArray(action.symbolIds) &&
    arraysEqual(action.symbolIds, module.solution.action.symbolIds)
}

function pickUnique(items, count, random) {
  const pool = [...items]
  const picked = []
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }
  return picked
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index])
}
