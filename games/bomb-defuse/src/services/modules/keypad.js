const DISPLAY_VALUES = ['READY', 'ALERT', 'HOLD', 'COUNT', 'CHECK', 'PANIC']
const KEY_LABELS = ['HOLD', 'CUT', 'SEND', 'SAFE', 'VENT', 'ARM', 'RESET', 'SYNC']

const KEYPAD_RULE_SETS = [
  {
    id: 'classic',
    rules: [
      '如果显示 READY、序列号为偶数且存在 SAFE，按 SAFE。',
      '如果电池不少于 3 个且存在 CUT，按 CUT。',
      '如果存在 HOLD，按 HOLD。',
      '其他情况，按阅读顺序第一个按钮。'
    ],
    resolve({ display, keys, serialNumber, batteries }) {
      const safeKey = findKey(keys, 'SAFE')
      if (display === 'READY' && serialIsEven(serialNumber) && safeKey) {
        return press(safeKey)
      }

      if (batteries >= 3) {
        const cutKey = findKey(keys, 'CUT')
        if (cutKey) return press(cutKey)
      }

      const holdKey = findKey(keys, 'HOLD')
      if (holdKey) return press(holdKey)

      return press(keys[0])
    }
  },
  {
    id: 'alert',
    rules: [
      '如果显示 ALERT 或 PANIC 且存在 VENT，按 VENT。',
      '如果序列号为奇数且存在 ARM，按 ARM。',
      '如果电池少于 2 个且存在 RESET，按 RESET。',
      '其他情况，按阅读顺序最后一个按钮。'
    ],
    resolve({ display, keys, serialNumber, batteries }) {
      const ventKey = findKey(keys, 'VENT')
      if ((display === 'ALERT' || display === 'PANIC') && ventKey) {
        return press(ventKey)
      }

      const armKey = findKey(keys, 'ARM')
      if (serialIsOdd(serialNumber) && armKey) {
        return press(armKey)
      }

      const resetKey = findKey(keys, 'RESET')
      if (batteries < 2 && resetKey) {
        return press(resetKey)
      }

      return press(keys[keys.length - 1])
    }
  },
  {
    id: 'routing',
    rules: [
      '如果显示 CHECK 且存在 SYNC，按 SYNC。',
      '如果 SEND 和 SAFE 同时存在，按阅读顺序更靠后的那个。',
      '如果显示 COUNT，按第二个按钮。',
      '其他情况，按第一个四个字母的按钮。'
    ],
    resolve({ display, keys }) {
      const syncKey = findKey(keys, 'SYNC')
      if (display === 'CHECK' && syncKey) return press(syncKey)

      const sendIndex = findKeyIndex(keys, 'SEND')
      const safeIndex = findKeyIndex(keys, 'SAFE')
      if (sendIndex !== -1 && safeIndex !== -1) {
        return press(keys[Math.max(sendIndex, safeIndex)])
      }

      if (display === 'COUNT') {
        return press(keys[Math.min(1, keys.length - 1)])
      }

      return press(keys.find(key => key.label.length === 4) ?? keys[0])
    }
  }
]

export function generateKeypadModule(context, random) {
  const display = DISPLAY_VALUES[Math.floor(random() * DISPLAY_VALUES.length)]
  const labels = pickUnique(KEY_LABELS, 4, random)
  const keys = labels.map((label, index) => ({
    id: `key-${index + 1}`,
    label
  }))
  const ruleSet = pickRuleSet(KEYPAD_RULE_SETS, random)
  const action = resolveKeypadSolution({
    display,
    keys,
    serialNumber: context.serialNumber,
    batteries: context.batteries,
    ruleSet: ruleSet.id
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
      ruleSet: ruleSet.id,
      rules: ruleSet.rules
    },
    solution: {
      action
    }
  }
}

export function resolveKeypadSolution({
  display,
  keys,
  serialNumber,
  batteries,
  ruleSet = 'classic'
}) {
  return findRuleSet(KEYPAD_RULE_SETS, ruleSet).resolve({
    display,
    keys,
    serialNumber,
    batteries
  })
}

export function validateKeypadAction(module, action) {
  return action?.type === 'press_key' && action.keyId === module.solution.action.keyId
}

function findKey(keys, label) {
  return keys.find(key => key.label === label) ?? null
}

function findKeyIndex(keys, label) {
  return keys.findIndex(key => key.label === label)
}

function serialIsEven(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 0
}

function serialIsOdd(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 1
}

function press(key) {
  return { type: 'press_key', keyId: key.id }
}

function pickRuleSet(ruleSets, random) {
  return ruleSets[Math.floor(random() * ruleSets.length)]
}

function findRuleSet(ruleSets, id) {
  return ruleSets.find(ruleSet => ruleSet.id === id) ?? ruleSets[0]
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
