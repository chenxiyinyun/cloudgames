import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../index'
import { generateKeypadModule, resolveKeypadSolution, validateKeypadAction } from '../keypad'

describe('keypad module', () => {
  it('chooses SAFE when the display is READY and the serial number is even', () => {
    const keys = [
      { id: 'key-1', label: 'HOLD' },
      { id: 'key-2', label: 'CUT' },
      { id: 'key-3', label: 'SEND' },
      { id: 'key-4', label: 'SAFE' }
    ]

    expect(resolveKeypadSolution({
      display: 'READY',
      keys,
      serialNumber: 'AB-2468',
      batteries: 1
    })).toEqual({
      type: 'press_key',
      keyId: 'key-4'
    })
  })

  it('chooses CUT when there are at least three batteries and CUT exists', () => {
    const keys = [
      { id: 'key-1', label: 'HOLD' },
      { id: 'key-2', label: 'CUT' },
      { id: 'key-3', label: 'SEND' },
      { id: 'key-4', label: 'SAFE' }
    ]

    expect(resolveKeypadSolution({
      display: 'ALERT',
      keys,
      serialNumber: 'AB-1357',
      batteries: 3
    })).toEqual({
      type: 'press_key',
      keyId: 'key-2'
    })
  })

  it('generates and validates a deterministic keypad module', () => {
    const module = generateKeypadModule(
      { id: 'keypad-1', serialNumber: 'AB-2468', batteries: 2 },
      createSeededRandom('keypad-test')
    )

    expect(module.type).toBe('keypad')
    expect(module.bombView.keys).toHaveLength(4)
    expect(module.solution.action.type).toBe('press_key')
    expect(validateKeypadAction(module, module.solution.action)).toBe(true)
    expect(validateKeypadAction(module, { type: 'press_key', keyId: 'missing' })).toBe(false)
  })
})
