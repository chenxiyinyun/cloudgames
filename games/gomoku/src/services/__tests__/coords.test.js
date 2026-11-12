import { describe, it, expect } from 'vitest'
import { COL_LETTERS, coordLabel } from '../coords'

describe('coords', () => {
  it('provides 15 column letters (A–H, J–P, skipping I)', () => {
    expect(COL_LETTERS).toHaveLength(15)
    expect(COL_LETTERS[0]).toBe('A')
    expect(COL_LETTERS[7]).toBe('H')
    expect(COL_LETTERS[8]).toBe('J')
    expect(COL_LETTERS[14]).toBe('P')
    expect(COL_LETTERS).not.toContain('I')
  })

  it('labels the center intersection as H8', () => {
    expect(coordLabel(7, 7)).toBe('H8')
  })

  it('labels the four corners', () => {
    expect(coordLabel(0, 0)).toBe('A15')
    expect(coordLabel(0, 14)).toBe('P15')
    expect(coordLabel(14, 0)).toBe('A1')
    expect(coordLabel(14, 14)).toBe('P1')
  })

  it('never produces undefined labels', () => {
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        expect(coordLabel(row, col)).not.toContain('undefined')
      }
    }
  })
})
