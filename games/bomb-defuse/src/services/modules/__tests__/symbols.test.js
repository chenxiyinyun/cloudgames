import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../index'
import {
  SYMBOL_COLUMNS,
  generateSymbolsModule,
  resolveSymbolsSolution,
  validateSymbolsAction
} from '../symbols'

describe('symbols module', () => {
  it('resolves symbol order from the matching manual column', () => {
    const symbols = ['omega', 'lambda', 'star', 'spiral']
    const action = resolveSymbolsSolution({ symbols, column: SYMBOL_COLUMNS[0] })

    expect(action).toEqual({
      type: 'press_symbols',
      symbolIds: ['omega', 'lambda', 'star', 'spiral']
    })
  })

  it('generates symbols that all belong to one shared manual column', () => {
    const module = generateSymbolsModule(
      { id: 'symbols-1' },
      createSeededRandom('symbols-test')
    )

    const sharedColumn = SYMBOL_COLUMNS.find(column =>
      module.bombView.symbols.every(symbol => column.includes(symbol.id))
    )

    expect(sharedColumn).toBeTruthy()
    expect(module.solution.action.symbolIds).toEqual(
      sharedColumn.filter(symbolId =>
        module.bombView.symbols.some(symbol => symbol.id === symbolId)
      )
    )
    expect(validateSymbolsAction(module, module.solution.action)).toBe(true)
  })

  it('rejects symbols pressed in the wrong order', () => {
    const module = generateSymbolsModule(
      { id: 'symbols-1' },
      createSeededRandom('symbols-test')
    )
    const reversed = [...module.solution.action.symbolIds].reverse()

    expect(validateSymbolsAction(module, {
      type: 'press_symbols',
      symbolIds: reversed
    })).toBe(false)
  })
})
