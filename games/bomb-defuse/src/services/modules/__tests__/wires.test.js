import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../index'
import { generateWiresModule, resolveWiresSolution, validateWiresAction } from '../wires'

describe('wires module', () => {
  it('cuts the second wire when there are no red wires', () => {
    const wires = [
      { id: 'wire-1', color: 'yellow' },
      { id: 'wire-2', color: 'blue' },
      { id: 'wire-3', color: 'white' }
    ]

    expect(resolveWiresSolution({ wires, serialNumber: 'AB-2468' })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-2'
    })
  })

  it('cuts the last wire when it is white and the serial number is odd', () => {
    const wires = [
      { id: 'wire-1', color: 'red' },
      { id: 'wire-2', color: 'yellow' },
      { id: 'wire-3', color: 'white' }
    ]

    expect(resolveWiresSolution({ wires, serialNumber: 'AB-1357' })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-3'
    })
  })

  it('cuts the last blue wire when there are multiple blue wires', () => {
    const wires = [
      { id: 'wire-1', color: 'blue' },
      { id: 'wire-2', color: 'red' },
      { id: 'wire-3', color: 'blue' },
      { id: 'wire-4', color: 'yellow' }
    ]

    expect(resolveWiresSolution({ wires, serialNumber: 'AB-2468' })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-3'
    })
  })

  it('cuts the last wire otherwise', () => {
    const wires = [
      { id: 'wire-1', color: 'red' },
      { id: 'wire-2', color: 'yellow' },
      { id: 'wire-3', color: 'white' }
    ]

    expect(resolveWiresSolution({ wires, serialNumber: 'AB-2468' })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-3'
    })
  })

  it('generates and validates a deterministic wires module', () => {
    const module = generateWiresModule(
      { id: 'wires-1', serialNumber: 'AB-1357' },
      createSeededRandom('wires-test')
    )

    expect(module.type).toBe('wires')
    expect(module.bombView.wires.length).toBeGreaterThanOrEqual(3)
    expect(module.manualView.ruleSet).toEqual(expect.any(String))
    expect(module.manualView.rules).toHaveLength(4)
    expect(module.solution.action.type).toBe('cut_wire')
    expect(validateWiresAction(module, module.solution.action)).toBe(true)
    expect(validateWiresAction(module, { type: 'cut_wire', wireId: 'missing' })).toBe(false)
  })

  it('generates different wire rule sets across seeds', () => {
    const ruleSets = new Set()

    for (let index = 0; index < 40; index += 1) {
      const module = generateWiresModule(
        { id: 'wires-1', serialNumber: 'AB-1357' },
        createSeededRandom(`wires-rules-${index}`)
      )
      ruleSets.add(module.manualView.ruleSet)
      expect(validateWiresAction(module, module.solution.action)).toBe(true)
    }

    expect(ruleSets.size).toBeGreaterThan(1)
  })

  it('supports the density wire rules', () => {
    const wires = [
      { id: 'wire-1', color: 'red' },
      { id: 'wire-2', color: 'black' },
      { id: 'wire-3', color: 'blue' }
    ]

    expect(resolveWiresSolution({
      wires,
      serialNumber: 'AB-2468',
      ruleSet: 'density'
    })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-2'
    })
  })

  it('supports the position wire rules', () => {
    const wires = [
      { id: 'wire-1', color: 'red' },
      { id: 'wire-2', color: 'yellow' },
      { id: 'wire-3', color: 'black' },
      { id: 'wire-4', color: 'yellow' },
      { id: 'wire-5', color: 'blue' }
    ]

    expect(resolveWiresSolution({
      wires,
      serialNumber: 'AB-2468',
      ruleSet: 'position'
    })).toEqual({
      type: 'cut_wire',
      wireId: 'wire-3'
    })
  })
})
