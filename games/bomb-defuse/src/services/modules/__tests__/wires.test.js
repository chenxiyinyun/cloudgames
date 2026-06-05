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
    expect(module.solution.action.type).toBe('cut_wire')
    expect(validateWiresAction(module, module.solution.action)).toBe(true)
    expect(validateWiresAction(module, { type: 'cut_wire', wireId: 'missing' })).toBe(false)
  })
})
