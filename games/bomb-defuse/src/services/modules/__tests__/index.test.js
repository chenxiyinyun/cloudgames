import { describe, expect, it } from 'vitest'
import { generateBombModules } from '../index'

describe('bomb module generation', () => {
  it('generates the three MVP modules in a stable order', () => {
    const modules = generateBombModules({
      seed: 'test-seed',
      serialNumber: 'TE-2468',
      batteries: 2,
      indicators: ['CAR']
    })

    expect(modules.map(module => module.id)).toEqual(['wires-1', 'symbols-1', 'keypad-1'])
    expect(modules.map(module => module.type)).toEqual(['wires', 'symbols', 'keypad'])
    expect(modules.every(module => module.status === 'unsolved')).toBe(true)
    expect(modules.every(module => module.solution.action)).toBe(true)
  })

  it('uses the seed to keep module generation repeatable', () => {
    const context = {
      seed: 'repeatable-seed',
      serialNumber: 'RE-1357',
      batteries: 2,
      indicators: ['NSA']
    }

    expect(generateBombModules(context)).toEqual(generateBombModules(context))
  })
})
