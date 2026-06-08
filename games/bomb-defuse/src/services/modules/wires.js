const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black']

const WIRE_RULE_SETS = [
  {
    id: 'classic',
    rules: [
      '如果没有红线，剪第二根线。',
      '如果最后一根是白线且序列号为奇数，剪最后一根线。',
      '如果蓝线超过一根，剪最后一根蓝线。',
      '其他情况，剪最后一根线。'
    ],
    resolve({ wires, serialNumber }) {
      const hasRedWire = wires.some(wire => wire.color === 'red')
      if (!hasRedWire) {
        return cut(wires[Math.min(1, wires.length - 1)])
      }

      const lastWire = wires[wires.length - 1]
      if (lastWire.color === 'white' && serialIsOdd(serialNumber)) {
        return cut(lastWire)
      }

      const blueWires = wires.filter(wire => wire.color === 'blue')
      if (blueWires.length > 1) {
        return cut(blueWires[blueWires.length - 1])
      }

      return cut(lastWire)
    }
  },
  {
    id: 'density',
    rules: [
      '如果正好有一根黑线，剪这根黑线。',
      '如果黄线数量多于蓝线，剪第一根黄线。',
      '如果序列号为偶数且存在白线，剪第一根白线。',
      '其他情况，剪第一根线。'
    ],
    resolve({ wires, serialNumber }) {
      const blackWires = wires.filter(wire => wire.color === 'black')
      if (blackWires.length === 1) return cut(blackWires[0])

      const yellowWires = wires.filter(wire => wire.color === 'yellow')
      const blueWires = wires.filter(wire => wire.color === 'blue')
      if (yellowWires.length > blueWires.length && yellowWires.length > 0) {
        return cut(yellowWires[0])
      }

      const whiteWires = wires.filter(wire => wire.color === 'white')
      if (serialIsEven(serialNumber) && whiteWires.length > 0) {
        return cut(whiteWires[0])
      }

      return cut(wires[0])
    }
  },
  {
    id: 'position',
    rules: [
      '如果第一根是蓝线，剪第一根线。',
      '如果没有白线，剪中间那根线。',
      '如果红线数量多于黑线，剪最后一根红线。',
      '其他情况，剪最后一根线。'
    ],
    resolve({ wires }) {
      if (wires[0].color === 'blue') return cut(wires[0])

      if (!wires.some(wire => wire.color === 'white')) {
        return cut(wires[Math.floor(wires.length / 2)])
      }

      const redWires = wires.filter(wire => wire.color === 'red')
      const blackWires = wires.filter(wire => wire.color === 'black')
      if (redWires.length > blackWires.length) {
        return cut(redWires[redWires.length - 1])
      }

      return cut(wires[wires.length - 1])
    }
  }
]

export function generateWiresModule(context, random) {
  const wireCount = 3 + Math.floor(random() * 3)
  const wires = Array.from({ length: wireCount }, (_, index) => ({
    id: `wire-${index + 1}`,
    color: WIRE_COLORS[Math.floor(random() * WIRE_COLORS.length)]
  }))
  const ruleSet = pickRuleSet(WIRE_RULE_SETS, random)

  const action = resolveWiresSolution({
    wires,
    serialNumber: context.serialNumber,
    ruleSet: ruleSet.id
  })

  return {
    id: context.id,
    type: 'wires',
    status: 'unsolved',
    bombView: {
      wires
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

export function resolveWiresSolution({ wires, serialNumber, ruleSet = 'classic' }) {
  return findRuleSet(WIRE_RULE_SETS, ruleSet).resolve({ wires, serialNumber })
}

export function validateWiresAction(module, action) {
  return action?.type === 'cut_wire' && action.wireId === module.solution.action.wireId
}

function serialIsOdd(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 1
}

function serialIsEven(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 0
}

function cut(wire) {
  return { type: 'cut_wire', wireId: wire.id }
}

function pickRuleSet(ruleSets, random) {
  return ruleSets[Math.floor(random() * ruleSets.length)]
}

function findRuleSet(ruleSets, id) {
  return ruleSets.find(ruleSet => ruleSet.id === id) ?? ruleSets[0]
}
