const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black']

export function generateWiresModule(context, random) {
  const wireCount = 3 + Math.floor(random() * 3)
  const wires = Array.from({ length: wireCount }, (_, index) => ({
    id: `wire-${index + 1}`,
    color: WIRE_COLORS[Math.floor(random() * WIRE_COLORS.length)]
  }))

  const action = resolveWiresSolution({
    wires,
    serialNumber: context.serialNumber
  })

  return {
    id: context.id,
    type: 'wires',
    status: 'unsolved',
    bombView: {
      wires
    },
    manualView: {
      ruleSet: 'mvp-wires',
      rules: [
        'If there are no red wires, cut the second wire.',
        'If the last wire is white and the serial number is odd, cut the last wire.',
        'If there is more than one blue wire, cut the last blue wire.',
        'Otherwise, cut the last wire.'
      ]
    },
    solution: {
      action
    }
  }
}

export function resolveWiresSolution({ wires, serialNumber }) {
  const hasRedWire = wires.some(wire => wire.color === 'red')
  if (!hasRedWire) {
    return { type: 'cut_wire', wireId: wires[Math.min(1, wires.length - 1)].id }
  }

  const lastWire = wires[wires.length - 1]
  if (lastWire.color === 'white' && serialIsOdd(serialNumber)) {
    return { type: 'cut_wire', wireId: lastWire.id }
  }

  const blueWires = wires.filter(wire => wire.color === 'blue')
  if (blueWires.length > 1) {
    return { type: 'cut_wire', wireId: blueWires[blueWires.length - 1].id }
  }

  return { type: 'cut_wire', wireId: lastWire.id }
}

export function validateWiresAction(module, action) {
  return action?.type === 'cut_wire' && action.wireId === module.solution.action.wireId
}

function serialIsOdd(serialNumber) {
  const digits = String(serialNumber).match(/\d/g)
  if (!digits?.length) return false
  return Number(digits[digits.length - 1]) % 2 === 1
}
