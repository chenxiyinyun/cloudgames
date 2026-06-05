const DISPLAY_VALUES = ['READY', 'ALERT', 'HOLD', 'COUNT']
const KEY_LABELS = ['HOLD', 'CUT', 'SEND', 'SAFE', 'VENT', 'ARM']

export function generateKeypadModule(context, random) {
  const display = DISPLAY_VALUES[Math.floor(random() * DISPLAY_VALUES.length)]
  const labels = pickUnique(KEY_LABELS, 4, random)
  const keys = labels.map((label, index) => ({
    id: `key-${index + 1}`,
    label
  }))
  const action = resolveKeypadSolution({
    display,
    keys,
    serialNumber: context.serialNumber,
    batteries: context.batteries
  })

  return {
    id: context.id,
    type: 'keypad',
    status: 'unsolved',
    bombView: {
      display,
      keys
    },
    manualView: {
      ruleSet: 'mvp-keypad',
      rules: [
        'If the display says READY and the serial number is even, press SAFE.',
        'If there are three or more batteries and CUT is present, press CUT.',
        'If HOLD is present, press HOLD.',
        'Otherwise, press the first key in reading order.'
      ]
    },
    solution: {
      action
    }
  }
}

export function resolveKeypadSolution({ display, keys, serialNumber, batteries }) {
  if (display === 'READY' && serialIsEven(serialNumber)) {
    return { type: 'press_key', keyId: findKeyId(keys, 'SAFE') ?? keys[0].id }
  }

  if (batteries >= 3) {
    const cutKeyId = findKeyId(keys, 'CUT')
    if (cutKeyId) return { type: 'press_key', keyId: cutKeyId }
  }

  const holdKeyId = findKeyId(keys, 'HOLD')
  if (holdKeyId) {
    return { type: 'press_key', keyId: holdKeyId }
  }

  return { type: 'press_key', keyId: keys[0].id }
}

export function validateKeypadAction(module, action) {
  return action?.type === 'press_key' && action.keyId === module.solution.action.keyId
}

function findKeyId(keys, label) {
  return keys.find(key => key.label === label)?.id ?? null
}

function serialIsEven(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 0
}

function pickUnique(items, count, random) {
  const pool = [...items]
  const picked = []
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }
  return picked
}
