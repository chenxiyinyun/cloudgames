import { generateKeypadModule, validateKeypadAction } from './keypad'
import { generateMazeModule, resolveMazeAction } from './maze'
import { generatePasswordModule, validatePasswordAction } from './password'
import { generateSymbolsModule, validateSymbolsAction } from './symbols'
import { generateWiresModule, validateWiresAction } from './wires'

const MODULE_GENERATORS = {
  wires: generateWiresModule,
  symbols: generateSymbolsModule,
  keypad: generateKeypadModule,
  password: generatePasswordModule,
  maze: generateMazeModule
}

const MODULE_VALIDATORS = {
  wires: validateWiresAction,
  symbols: validateSymbolsAction,
  keypad: validateKeypadAction,
  password: validatePasswordAction
}

// Stateful modules advance through several actions before solving, so they
// supply a resolver instead of a boolean validator.
const MODULE_RESOLVERS = {
  maze: resolveMazeAction
}

const DEFAULT_MODULE_TYPES = ['wires', 'symbols', 'keypad', 'password']

export function generateBombModules(context) {
  const random = createSeededRandom(context.seed)
  const moduleContext = {
    serialNumber: context.serialNumber,
    batteries: context.batteries,
    indicators: context.indicators
  }

  const types = context.moduleTypes?.length ? context.moduleTypes : DEFAULT_MODULE_TYPES
  const counts = {}

  return types
    .map(type => {
      const generate = MODULE_GENERATORS[type]
      if (!generate) return null
      counts[type] = (counts[type] || 0) + 1
      return generate({ ...moduleContext, id: `${type}-${counts[type]}` }, random)
    })
    .filter(Boolean)
}

export function validateModuleAction(module, action) {
  return MODULE_VALIDATORS[module?.type]?.(module, action) ?? false
}

// Unified action resolution. Stateful modules use their own resolver; the rest
// fall back to the binary validator (correct = solved, wrong = strike).
export function resolveModuleAction(module, action) {
  const resolver = MODULE_RESOLVERS[module?.type]
  if (resolver) return resolver(module, action)
  return validateModuleAction(module, action) ? { result: 'solved' } : { result: 'strike' }
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
export { generateMazeModule, resolveMazeAction } from './maze'
export { generatePasswordModule, validatePasswordAction } from './password'
export { generateSymbolsModule, validateSymbolsAction } from './symbols'
export { generateWiresModule, validateWiresAction } from './wires'
