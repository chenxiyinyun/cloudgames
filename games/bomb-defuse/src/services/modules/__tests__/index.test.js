import { describe, expect, it } from 'vitest'
import { createSeededRandom, generateBombModules, resolveModuleAction } from '../index'
import { generateWiresModule } from '../wires'

describe('bomb module generation', () => {
  it('generates the modules in a stable order', () => {
    const modules = generateBombModules({
      seed: 'test-seed',
      serialNumber: 'TE-2468',
      batteries: 2,
      indicators: ['CAR']
    })

    expect(modules.map(module => module.id)).toEqual(['wires-1', 'symbols-1', 'keypad-1', 'password-1'])
    expect(modules.map(module => module.type)).toEqual(['wires', 'symbols', 'keypad', 'password'])
    expect(modules.every(module => module.status === 'unsolved')).toBe(true)
    expect(modules.every(module => module.solution.action)).toBe(true)
  })

  it('generates only the requested module types in order', () => {
    const modules = generateBombModules({
      seed: 'subset-seed',
      serialNumber: 'TE-2468',
      batteries: 2,
      indicators: ['CAR'],
      moduleTypes: ['wires', 'symbols', 'keypad']
    })

    expect(modules.map(module => module.id)).toEqual(['wires-1', 'symbols-1', 'keypad-1'])
    expect(modules.some(module => module.type === 'password')).toBe(false)
  })

  it('generates the maze module when requested', () => {
    const modules = generateBombModules({
      seed: 'maze-seed',
      serialNumber: 'TE-2468',
      batteries: 2,
      indicators: ['CAR'],
      moduleTypes: ['maze']
    })

    expect(modules.map(module => module.id)).toEqual(['maze-1'])
    expect(modules[0].type).toBe('maze')
  })

  it('skips unknown module types gracefully', () => {
    const modules = generateBombModules({
      seed: 'unknown-seed',
      serialNumber: 'TE-2468',
      batteries: 2,
      indicators: ['CAR'],
      moduleTypes: ['wires', 'nope', 'keypad']
    })

    expect(modules.map(module => module.type)).toEqual(['wires', 'keypad'])
  })

  it('resolves binary modules to solved or strike', () => {
    const wires = generateWiresModule({ id: 'wires-1', serialNumber: 'TE-2468' }, createSeededRandom('resolve'))

    expect(resolveModuleAction(wires, wires.solution.action)).toEqual({ result: 'solved' })
    expect(resolveModuleAction(wires, { type: 'cut_wire', wireId: 'missing' })).toEqual({ result: 'strike' })
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
