import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../index'
import { PASSWORD_WORDS, generatePasswordModule, validatePasswordAction } from '../password'

function spellableWords(module) {
  const columns = module.bombView.columns.map(column => column.letters)
  return PASSWORD_WORDS.filter(word =>
    word.split('').every((letter, position) => columns[position].includes(letter))
  )
}

describe('password module', () => {
  it('generates five columns whose target word is selectable', () => {
    const module = generatePasswordModule(
      { id: 'password-1', serialNumber: 'AB-2468', batteries: 2 },
      createSeededRandom('password-test')
    )

    expect(module.type).toBe('password')
    expect(module.bombView.columns).toHaveLength(5)
    expect(module.solution.action.type).toBe('enter_password')

    const target = module.solution.action.word
    target.split('').forEach((letter, position) => {
      expect(module.bombView.columns[position].letters).toContain(letter)
    })
  })

  it('guarantees the target is the only spellable word across many seeds', () => {
    for (let index = 0; index < 200; index += 1) {
      const module = generatePasswordModule(
        { id: 'password-1', serialNumber: 'AB-1357', batteries: 2 },
        createSeededRandom(`unique-${index}`)
      )
      expect(spellableWords(module)).toEqual([module.solution.action.word])
    }
  })

  it('validates the target word case-insensitively and rejects others', () => {
    const module = generatePasswordModule(
      { id: 'password-1', serialNumber: 'AB-2468', batteries: 2 },
      createSeededRandom('password-validate')
    )
    const target = module.solution.action.word

    expect(validatePasswordAction(module, { type: 'enter_password', word: target })).toBe(true)
    expect(validatePasswordAction(module, { type: 'enter_password', word: target.toLowerCase() })).toBe(true)
    expect(validatePasswordAction(module, { type: 'enter_password', word: 'ZZZZZ' })).toBe(false)
    expect(validatePasswordAction(module, { type: 'cut_wire', wireId: 'x' })).toBe(false)
  })
})
