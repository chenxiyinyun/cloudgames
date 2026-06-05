import { generateKeypadModule, validateKeypadAction } from './keypad'
import { generateSymbolsModule, validateSymbolsAction } from './symbols'
import { generateWiresModule, validateWiresAction } from './wires'

const MODULE_VALIDATORS = {
  wires: validateWiresAction,
  symbols: validateSymbolsAction,
  keypad: validateKeypadAction
}

export function generateBombModules(context) {
  const random = createSeededRandom(context.seed)
  const moduleContext = {
    serialNumber: context.serialNumber,
    batteries: context.batteries,
    indicators: context.indicators
  }

  return [
    generateWiresModule({ ...moduleContext, id: 'wires-1' }, random),
    generateSymbolsModule({ ...moduleContext, id: 'symbols-1' }, random),
    generateKeypadModule({ ...moduleContext, id: 'keypad-1' }, random)
  ]
}

export function validateModuleAction(module, action) {
  return MODULE_VALIDATORS[module?.type]?.(module, action) ?? false
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed)

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function hashSeed(seed) {
  const text = String(seed || 'bomb-defuse')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export { generateKeypadModule, validateKeypadAction } from './keypad'
export { generateSymbolsModule, validateSymbolsAction } from './symbols'
export { generateWiresModule, validateWiresAction } from './wires'
