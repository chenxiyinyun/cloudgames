const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const COLUMN_SIZE = 6
const PASSWORD_LENGTH = 5

export const PASSWORD_WORDS = [
  'ABOUT', 'AFTER', 'AGAIN', 'ALONE', 'BEACH', 'BRAVE', 'BREAD', 'BRICK',
  'CHAIR', 'CLOUD', 'CRANE', 'DANCE', 'EAGLE', 'EARTH', 'FLAME', 'FROST',
  'GIANT', 'GRAPE', 'HEART', 'HORSE', 'LIGHT', 'MONEY', 'MUSIC', 'NIGHT',
  'OCEAN', 'PEARL', 'PLANT', 'RIVER', 'SMILE', 'SNAKE', 'SOUND', 'STONE',
  'STORM', 'SUGAR', 'TIGER', 'TRAIN', 'WATER', 'WHALE', 'WORLD', 'YOUTH'
]

export function generatePasswordModule(context, random) {
  const target = PASSWORD_WORDS[Math.floor(random() * PASSWORD_WORDS.length)]

  let columns = Array.from({ length: PASSWORD_LENGTH }, (_, position) =>
    buildColumn(target[position], random)
  )
  columns = repairUniqueness(columns, target, random)

  return {
    id: context.id,
    type: 'password',
    status: 'unsolved',
    bombView: {
      columns: columns.map((letters, index) => ({
        id: `col-${index + 1}`,
        letters
      }))
    },
    manualView: {
      words: PASSWORD_WORDS
    },
    solution: {
      action: { type: 'enter_password', word: target }
    }
  }
}

export function validatePasswordAction(module, action) {
  return action?.type === 'enter_password' &&
    typeof action.word === 'string' &&
    action.word.toUpperCase() === module.solution.action.word
}

function buildColumn(requiredLetter, random) {
  const letters = [requiredLetter]
  while (letters.length < COLUMN_SIZE) {
    const candidate = ALPHABET[Math.floor(random() * ALPHABET.length)]
    if (!letters.includes(candidate)) {
      letters.push(candidate)
    }
  }
  return shuffle(letters, random)
}

// Guarantees exactly one spellable word (the target) by repeatedly removing the
// letter that lets a rival word be spelled and replacing it with a "dead" letter
// no word uses at that position. Terminates in at most PASSWORD_WORDS.length steps.
function repairUniqueness(columns, target, random) {
  const next = columns.map(letters => [...letters])

  for (let guard = 0; guard <= PASSWORD_WORDS.length; guard += 1) {
    const rival = PASSWORD_WORDS.find(word => word !== target && isSpellable(word, next))
    if (!rival) return next

    const position = firstDivergentIndex(rival, target)
    const replacement = pickDeadLetter(position, next[position], random)
    next[position] = next[position].map(letter =>
      letter === rival[position] ? replacement : letter
    )
  }

  return next
}

function isSpellable(word, columns) {
  return word.split('').every((letter, position) => columns[position].includes(letter))
}

function firstDivergentIndex(rival, target) {
  for (let index = 0; index < target.length; index += 1) {
    if (rival[index] !== target[index]) return index
  }
  return 0
}

function pickDeadLetter(position, existing, random) {
  const usedByWords = new Set(PASSWORD_WORDS.map(word => word[position]))
  const candidates = ALPHABET.filter(letter =>
    !usedByWords.has(letter) && !existing.includes(letter)
  )
  if (candidates.length === 0) {
    return ALPHABET.find(letter => !existing.includes(letter)) ?? existing[0]
  }
  return candidates[Math.floor(random() * candidates.length)]
}

function shuffle(items, random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}
