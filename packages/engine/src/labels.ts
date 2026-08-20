import { Gender, Person, TraversalStep } from './types'

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
  if (steps.length === 0) return 'You'

  const dirs = steps.map(s => s.direction)
  if (dirs.length === 1 && dirs[0] === 'spouse')
    return pick(gender, 'Your husband', 'Your wife', 'Your spouse')

  // The u/d kinship formula is only valid for canonical paths: an optional
  // spouse hop at either end, then all ups followed by all downs. Anything
  // else — e.g. [up,down,up] through a half-sibling or a missing parent
  // link — must NOT be forced into the formula: that's how a mother got
  // labelled "Your sister" when her own parent edge was missing.
  const leadSpouse = dirs[0] === 'spouse'
  const tailSpouse = dirs[dirs.length - 1] === 'spouse'
  const core       = dirs.slice(leadSpouse ? 1 : 0, dirs.length - (tailSpouse ? 1 : 0))
  const firstDown  = core.indexOf('down')
  const canonical  =
    !core.includes('spouse') &&
    (firstDown === -1 || core.slice(firstDown).every(dir => dir === 'down'))

  if (!canonical || (leadSpouse && tailSpouse)) return 'Your relative'

  const u = firstDown === -1 ? core.length : firstDown
  const d = core.length - u

  // Straight up — ancestors, their spouses, or your spouse's ancestors
  if (d === 0 && u > 0) {
    const base =
      u === 1 ? pick(gender, 'father', 'mother', 'parent') :
      u === 2 ? `grand${pick(gender, 'father', 'mother', 'parent')}` :
                `${greatPrefix(u - 2)}grand${pick(gender, 'father', 'mother', 'parent')}`
    if (leadSpouse) return `Your ${base}-in-law`   // spouse's parent
    if (tailSpouse) return `Your step-${base}`     // parent's spouse
    return `Your ${base}`
  }

  // Straight down — descendants, their spouses, or your spouse's children
  if (u === 0 && d > 0) {
    const base =
      d === 1 ? pick(gender, 'son', 'daughter', 'child') :
      d === 2 ? `grand${pick(gender, 'son', 'daughter', 'child')}` :
                `${greatPrefix(d - 2)}grand${pick(gender, 'son', 'daughter', 'child')}`
    if (leadSpouse) return `Your step-${base}`     // spouse's child
    if (tailSpouse) return `Your ${base}-in-law`   // child's spouse
    return `Your ${base}`
  }

  // Up then down — collateral lines
  const il = leadSpouse || tailSpouse ? '-in-law' : ''
  if (u === 1 && d === 1) return `Your ${pick(gender, 'brother', 'sister', 'sibling')}${il}`
  if (u === 2 && d === 1) return `Your ${pick(gender, 'uncle', 'aunt')}${leadSpouse ? '-in-law' : ''}`
  if (u === 1 && d === 2) return `Your ${pick(gender, 'nephew', 'niece')}${leadSpouse ? '-in-law' : ''}`
  if (d === 1 && u >= 3)  return `Your ${'great-'.repeat(u - 2)}${pick(gender, 'uncle', 'aunt')}`
  if (u === 1 && d >= 3)  return `Your ${'great-'.repeat(d - 3)}grand-${pick(gender, 'nephew', 'niece')}`

  if (u >= 2 && d >= 2) {
    const degree  = Math.min(u, d) - 1
    const removed = Math.abs(u - d)
    if (removed === 0) return `Your ${ordinal(degree)} cousin`
    return `Your ${ordinal(degree)} cousin ${removed} time${removed > 1 ? 's' : ''} removed`
  }

  return 'Your relative'
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
