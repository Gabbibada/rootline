import { Direction, EdgeSubtype, Gender, Person, TraversalStep } from './types'

interface PathPattern {
  upsBeforePivot:  number
  downsAfterPivot: number
  totalUps:        number
  totalDowns:      number
  hasSpouse:       boolean
  spousePosition:  'start' | 'middle' | 'end' | 'none'
  subtypes:        EdgeSubtype[]
}

function analysePattern(steps: TraversalStep[]): PathPattern {
  const dirs     = steps.map(s => s.direction)
  const subtypes = steps.map(s => s.subtype)
  const totalUps    = dirs.filter(d => d === 'up').length
  const totalDowns  = dirs.filter(d => d === 'down').length
  const hasSpouse   = dirs.includes('spouse')
  const pivotIndex  = dirs.findIndex(d => d !== 'up')
  const upsBeforePivot  = pivotIndex === -1 ? dirs.length : pivotIndex
  const downsAfterPivot = pivotIndex === -1 ? 0 : dirs.slice(pivotIndex).filter(d => d === 'down').length
  const spouseIdx = dirs.indexOf('spouse')
  let spousePosition: PathPattern['spousePosition'] = 'none'
  if (spouseIdx === 0)                     spousePosition = 'start'
  else if (spouseIdx === dirs.length - 1) spousePosition = 'end'
  else if (spouseIdx > 0)                 spousePosition = 'middle'
  return { upsBeforePivot, downsAfterPivot, totalUps, totalDowns, hasSpouse, spousePosition, subtypes }
}

function pick(gender: Gender, male: string, female: string, nb?: string): string {
  if (gender === 'M') return male
  if (gender === 'F') return female
  return nb ?? male + '/' + female
}

function greatPrefix(depth: number): string {
  return depth <= 0 ? '' : 'great-'.repeat(depth)
}

const ORDINALS = ['zeroth','first','second','third','fourth','fifth']
function ordinal(n: number): string { return ORDINALS[n] ?? n + 'th' }

export function generateLabel(steps: TraversalStep[], target: Person): string {
  const gender = target.gender
  const p      = analysePattern(steps)
  const { upsBeforePivot: u, downsAfterPivot: d, hasSpouse } = p

  if (steps.length === 0) return 'You'

  if (hasSpouse && steps.length === 1) return pick(gender, 'Your husband', 'Your wife', 'Your spouse')

  const isInLaw = p.spousePosition === 'start'

  if (d === 0 && !hasSpouse) {
    if (u === 1) return `Your ${pick(gender, 'father', 'mother', 'parent')}`
    if (u === 2) return `Your ${pick(gender, 'grandfather', 'grandmother', 'grandparent')}`
    return `Your ${greatPrefix(u - 2)}grand${pick(gender, 'father', 'mother', 'parent')}`
  }

  if (u === 0 && !hasSpouse) {
    if (d === 1) return `Your ${pick(gender, 'son', 'daughter', 'child')}`
    if (d === 2) return `Your grand${pick(gender, 'son', 'daughter', 'child')}`
    return `Your ${greatPrefix(d - 2)}grand${pick(gender, 'son', 'daughter', 'child')}`
  }

  const il = isInLaw ? '-in-law' : ''
  if (u === 1 && d === 1) return `Your ${pick(gender, 'brother', 'sister', 'sibling')}${il}`
  if (u === 2 && d === 1) return `Your ${pick(gender, 'uncle', 'aunt')}${il}`
  if (u === 1 && d === 2) return `Your ${pick(gender, 'nephew', 'niece')}`
  if (u === 2 && d === 2) return 'Your first cousin'
  if (u === 3 && d === 1) return `Your great-${pick(gender, 'uncle', 'aunt')}`
  if (u === 1 && d === 3) return `Your grand-${pick(gender, 'nephew', 'niece')}`
  if (u === 3 && d === 2) return 'Your first cousin once removed'
  if (u === 2 && d === 3) return 'Your first cousin once removed'
  if (u === 3 && d === 3) return 'Your second cousin'
  if (u === 4 && d === 1) return `Your great-great-${pick(gender, 'uncle', 'aunt')}`
  if (u === 4 && d === 4) return 'Your third cousin'

  if (u >= 2 && d >= 2) {
    const smaller  = Math.min(u, d)
    const degree   = smaller - 1
    const removed  = Math.abs(u - d)
    const degStr   = ordinal(degree)
    if (removed === 0) return `Your ${degStr} cousin`
    return `Your ${degStr} cousin ${removed} time${removed > 1 ? 's' : ''} removed`
  }

  return `Your relative (${u}↑ ${d}↓)`
}

export function generateDescription(
  personIds: string[],
  steps:     TraversalStep[],
  people:    Record<string, Person>,
): string {
  if (personIds.length <= 1) return people[personIds[0]]?.nickname ?? 'You'
  return personIds.map(id => people[id]?.nickname ?? people[id]?.name ?? id).join(' → ')
}

export function summariseDirections(steps: TraversalStep[]): string {
  const ups    = steps.filter(s => s.direction === 'up').length
  const downs  = steps.filter(s => s.direction === 'down').length
  const spouse = steps.filter(s => s.direction === 'spouse').length
  const parts: string[] = []
  if (ups)    parts.push(`${ups} generation${ups > 1 ? 's' : ''} up`)
  if (downs)  parts.push(`${downs} generation${downs > 1 ? 's' : ''} down`)
  if (spouse) parts.push('via spouse')
  return parts.join(', ')
}
