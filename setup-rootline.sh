#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-rootline.sh
# Run this from your rootline project root. It writes every source file.
# Usage: bash setup-rootline.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
echo "🌳 Setting up Rootline source files..."

# ── Create directories ────────────────────────────────────────────────────────
mkdir -p packages/engine/src
mkdir -p packages/api/src/routes
mkdir -p packages/app/app/\(tabs\)
mkdir -p packages/app/app/member
mkdir -p packages/app/assets/fonts
mkdir -p packages/app/src/components
mkdir -p packages/app/src/hooks
mkdir -p packages/app/src/lib
mkdir -p packages/app/src/screens
mkdir -p packages/app/src/store
mkdir -p packages/app/src/theme

# ══════════════════════════════════════════════════════════════════════════════
# ENGINE
# ══════════════════════════════════════════════════════════════════════════════

cat > packages/engine/package.json << 'EOF'
{
  "name": "@rootline/engine",
  "version": "0.1.0",
  "description": "The Rootline relationship engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest --no-coverage",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.4",
    "typescript": "^5.4.5"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/src/**/*.test.ts"]
  }
}
EOF

cat > packages/engine/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# ── types.ts ──────────────────────────────────────────────────────────────────
cat > packages/engine/src/types.ts << 'EOF'
export type Gender = 'M' | 'F' | 'NB'
export type EdgeType = 'parent' | 'spouse'
export type EdgeSubtype = 'biological' | 'step' | 'adoptive' | 'legal'
export type Direction = 'up' | 'down' | 'spouse'

export interface Person {
  id:       string
  name:     string
  nickname: string | null
  gender:   Gender
  birthday: string | null
  photo:    string | null
  location: string | null
  story:    string | null
  treeId:   string
  deceased: boolean
}

export interface Relationship {
  id:      string
  from:    string
  to:      string
  type:    EdgeType
  subtype: EdgeSubtype
  treeId:  string
}

export interface FamilyGraph {
  people:        Record<string, Person>
  relationships: Relationship[]
}

export interface TraversalStep {
  from:      string
  to:        string
  direction: Direction
  subtype:   EdgeSubtype
}

export interface RelationshipPath {
  personIds:   string[]
  steps:       TraversalStep[]
  label:       string
  description: string
  distance:    number
}

export type RelationshipResult =
  | { found: true;  path:   RelationshipPath }
  | { found: false; reason: 'same_person' | 'no_connection' | 'not_found' }
EOF

# ── graph.ts ──────────────────────────────────────────────────────────────────
cat > packages/engine/src/graph.ts << 'EOF'
import { FamilyGraph, Relationship, TraversalStep, Direction, EdgeSubtype } from './types'

interface AdjacencyEntry {
  to:        string
  direction: Direction
  subtype:   EdgeSubtype
}

export type AdjacencyList = Record<string, AdjacencyEntry[]>

export function buildAdjacency(relationships: Relationship[]): AdjacencyList {
  const adj: AdjacencyList = {}
  const ensure = (id: string) => { if (!adj[id]) adj[id] = [] }

  for (const rel of relationships) {
    ensure(rel.from)
    ensure(rel.to)
    if (rel.type === 'parent') {
      adj[rel.from].push({ to: rel.to, direction: 'down', subtype: rel.subtype })
      adj[rel.to].push({   to: rel.from, direction: 'up',   subtype: rel.subtype })
    } else if (rel.type === 'spouse') {
      adj[rel.from].push({ to: rel.to, direction: 'spouse', subtype: rel.subtype })
      adj[rel.to].push({   to: rel.from, direction: 'spouse', subtype: rel.subtype })
    }
  }
  return adj
}

interface BFSNode {
  personId: string
  path:     string[]
  steps:    TraversalStep[]
}

export function bfsPath(
  sourceId: string,
  targetId: string,
  adj:      AdjacencyList,
  graph:    FamilyGraph,
): { path: string[]; steps: TraversalStep[] } | null {
  if (!graph.people[sourceId] || !graph.people[targetId]) return null
  if (sourceId === targetId) return { path: [sourceId], steps: [] }

  const visited = new Set<string>([sourceId])
  const queue: BFSNode[] = [{ personId: sourceId, path: [sourceId], steps: [] }]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of (adj[current.personId] ?? [])) {
      if (visited.has(neighbor.to)) continue
      visited.add(neighbor.to)
      const step: TraversalStep = {
        from: current.personId, to: neighbor.to,
        direction: neighbor.direction, subtype: neighbor.subtype,
      }
      const newPath  = [...current.path, neighbor.to]
      const newSteps = [...current.steps, step]
      if (neighbor.to === targetId) return { path: newPath, steps: newSteps }
      queue.push({ personId: neighbor.to, path: newPath, steps: newSteps })
    }
  }
  return null
}

export function getParents(personId: string, adj: AdjacencyList): string[] {
  return (adj[personId] ?? []).filter(e => e.direction === 'up').map(e => e.to)
}

export function getChildren(personId: string, adj: AdjacencyList): string[] {
  return (adj[personId] ?? []).filter(e => e.direction === 'down').map(e => e.to)
}

export function getSiblings(personId: string, adj: AdjacencyList): string[] {
  const parents = getParents(personId, adj)
  const set = new Set<string>()
  for (const p of parents) {
    for (const c of getChildren(p, adj)) {
      if (c !== personId) set.add(c)
    }
  }
  return Array.from(set)
}
EOF

# ── labels.ts ─────────────────────────────────────────────────────────────────
cat > packages/engine/src/labels.ts << 'EOF'
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
EOF

# ── index.ts ──────────────────────────────────────────────────────────────────
cat > packages/engine/src/index.ts << 'EOF'
import { buildAdjacency, bfsPath, getSiblings, getParents, getChildren } from './graph'
import { generateLabel, generateDescription, summariseDirections }        from './labels'
import { FamilyGraph, RelationshipPath, RelationshipResult, Person, Relationship } from './types'

export * from './types'
export { getSiblings, getParents, getChildren, buildAdjacency } from './graph'
export { summariseDirections } from './labels'

export class RelationshipEngine {
  private graph: FamilyGraph

  constructor(graph: FamilyGraph) { this.graph = graph }

  updateGraph(graph: FamilyGraph): void { this.graph = graph }

  getRelationship(sourceId: string, targetId: string): RelationshipResult {
    const { people, relationships } = this.graph
    if (!people[sourceId] || !people[targetId]) return { found: false, reason: 'not_found' }
    if (sourceId === targetId)                   return { found: false, reason: 'same_person' }

    const adj       = buildAdjacency(relationships)
    const bfsResult = bfsPath(sourceId, targetId, adj, this.graph)
    if (!bfsResult) return { found: false, reason: 'no_connection' }

    const { path: personIds, steps } = bfsResult
    const label       = generateLabel(steps, people[targetId])
    const description = generateDescription(personIds, steps, people)

    return { found: true, path: { personIds, steps, label, description, distance: steps.length } }
  }

  getAllRelationships(sourceId: string): Array<{ personId: string; result: RelationshipResult }> {
    return Object.keys(this.graph.people)
      .filter(id => id !== sourceId)
      .map(personId => ({ personId, result: this.getRelationship(sourceId, personId) }))
      .filter(r => r.result.found)
      .sort((a, b) => {
        const dA = a.result.found ? a.result.path.distance : 99
        const dB = b.result.found ? b.result.path.distance : 99
        return dA - dB
      })
  }

  getPathDescription(sourceId: string, targetId: string): string | null {
    const r = this.getRelationship(sourceId, targetId)
    return r.found ? r.path.description : null
  }

  areDirectlyRelated(a: string, b: string): boolean {
    const r = this.getRelationship(a, b)
    return r.found && r.path.distance === 1
  }

  getBirthdayNotification(sourceId: string, targetId: string, daysUntil: number): string | null {
    const target = this.graph.people[targetId]
    if (!target) return null
    const r = this.getRelationship(sourceId, targetId)
    if (!r.found) return null
    const name  = target.nickname ?? target.name
    const label = r.path.label.replace(/^Your /, '').toLowerCase()
    const days  = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'in 1 day' : `in ${daysUntil} days`
    return `${name}'s birthday is ${days} — your ${label}`
  }
}

export function createEngine(graph: FamilyGraph): RelationshipEngine {
  return new RelationshipEngine(graph)
}
EOF

# ── engine.test.ts ────────────────────────────────────────────────────────────
cat > packages/engine/src/engine.test.ts << 'EOF'
import { createEngine, FamilyGraph, RelationshipEngine } from './index'
import { buildAdjacency, getSiblings, getParents, getChildren } from './graph'

function makePerson(id: string, name: string, gender: 'M'|'F'|'NB', nickname?: string) {
  return { id, name, nickname: nickname ?? null, gender, birthday: null,
           photo: null, location: null, story: null, treeId: 'bada-tree', deceased: false }
}
function makeParent(from: string, to: string) {
  return { id: `${from}->${to}`, from, to, type: 'parent' as const, subtype: 'biological' as const, treeId: 'bada-tree' }
}
function makeSpouse(from: string, to: string) {
  return { id: `${from}--${to}`, from, to, type: 'spouse' as const, subtype: 'biological' as const, treeId: 'bada-tree' }
}

const BADA_GRAPH: FamilyGraph = {
  people: {
    ggpa:   makePerson('ggpa',   'Chief Bada',      'M', 'Chief'),
    gpa:    makePerson('gpa',    'Samuel Bada',      'M', 'Grandpa'),
    gma:    makePerson('gma',    'Risikat Bada',     'F', 'Grandma Risi'),
    dad:    makePerson('dad',    'James Bada',       'M', 'Dad'),
    mum:    makePerson('mum',    'Adunola Bada',     'F', 'Mum'),
    uncle:  makePerson('uncle',  'Adewale Bada',     'M', 'Uncle Dele'),
    auntie: makePerson('auntie', 'Bosede Bada',      'F', 'Auntie Bose'),
    you:    makePerson('you',    'Gabriel Bada',     'M', 'Gabbi'),
    sis:    makePerson('sis',    'Temitope Bada',    'F', 'Temi'),
    cousin: makePerson('cousin', 'Babatunde Bada',   'M', 'Tunde'),
  },
  relationships: [
    makeParent('ggpa','gpa'),   makeParent('gpa','dad'),
    makeParent('gpa','uncle'),  makeParent('gpa','auntie'),
    makeParent('gma','dad'),    makeParent('gma','uncle'),
    makeParent('gma','auntie'), makeParent('dad','you'),
    makeParent('dad','sis'),    makeParent('mum','you'),
    makeParent('mum','sis'),    makeParent('uncle','cousin'),
    makeSpouse('gpa','gma'),    makeSpouse('dad','mum'),
  ],
}

let engine: RelationshipEngine
beforeEach(() => { engine = createEngine(BADA_GRAPH) })

describe('Direct ancestors', () => {
  test('father',            () => { const r = engine.getRelationship('you','dad');  expect(r.found && r.path.label).toBe('Your father') })
  test('mother',            () => { const r = engine.getRelationship('you','mum');  expect(r.found && r.path.label).toBe('Your mother') })
  test('grandfather',       () => { const r = engine.getRelationship('you','gpa');  expect(r.found && r.path.label).toBe('Your grandfather') })
  test('grandmother',       () => { const r = engine.getRelationship('you','gma');  expect(r.found && r.path.label).toBe('Your grandmother') })
  test('great-grandfather', () => { const r = engine.getRelationship('you','ggpa'); expect(r.found && r.path.label).toBe('Your great-grandfather') })
})

describe('Direct descendants', () => {
  test('son',          () => { const r = engine.getRelationship('dad','you');  expect(r.found && r.path.label).toBe('Your son') })
  test('daughter',     () => { const r = engine.getRelationship('dad','sis');  expect(r.found && r.path.label).toBe('Your daughter') })
  test('grandson',     () => { const r = engine.getRelationship('gpa','you');  expect(r.found && r.path.label).toBe('Your grandson') })
  test('great-grandson',() => { const r = engine.getRelationship('ggpa','you');expect(r.found && r.path.label).toBe('Your great-grandson') })
})

describe('Collateral', () => {
  test('brother',       () => { const r = engine.getRelationship('sis','you');    expect(r.found && r.path.label).toBe('Your brother') })
  test('sister',        () => { const r = engine.getRelationship('you','sis');    expect(r.found && r.path.label).toBe('Your sister') })
  test('uncle',         () => { const r = engine.getRelationship('you','uncle');  expect(r.found && r.path.label).toBe('Your uncle') })
  test('aunt',          () => { const r = engine.getRelationship('you','auntie'); expect(r.found && r.path.label).toBe('Your aunt') })
  test('nephew',        () => { const r = engine.getRelationship('uncle','you');  expect(r.found && r.path.label).toBe('Your nephew') })
  test('niece',         () => { const r = engine.getRelationship('uncle','sis');  expect(r.found && r.path.label).toBe('Your niece') })
  test('first cousin',  () => { const r = engine.getRelationship('you','cousin'); expect(r.found && r.path.label).toBe('Your first cousin') })
  test('cousin reverse',() => { const r = engine.getRelationship('cousin','you'); expect(r.found && r.path.label).toBe('Your first cousin') })
  test('uncle distance',() => { const r = engine.getRelationship('you','uncle');  expect(r.found && r.path.distance).toBe(3) })
})

describe('Spouse', () => {
  test('husband', () => { const r = engine.getRelationship('mum','dad'); expect(r.found && r.path.label).toBe('Your husband') })
  test('wife',    () => { const r = engine.getRelationship('dad','mum'); expect(r.found && r.path.label).toBe('Your wife') })
})

describe('Path structure', () => {
  test('uncle personIds',  () => { const r = engine.getRelationship('you','uncle'); expect(r.found && r.path.personIds).toEqual(['you','dad','gpa','uncle']) })
  test('description',      () => { const r = engine.getRelationship('you','uncle'); expect(r.found && r.path.description).toBe('Gabbi → Dad → Grandpa → Uncle Dele') })
  test('ggpa distance',    () => { const r = engine.getRelationship('you','ggpa');  expect(r.found && r.path.distance).toBe(3) })
  test('uncle directions', () => { const r = engine.getRelationship('you','uncle'); expect(r.found && r.path.steps.map((s:any)=>s.direction)).toEqual(['up','up','down']) })
})

describe('Edge cases', () => {
  test('same person',      () => { const r = engine.getRelationship('you','you');         expect(!r.found && r.reason).toBe('same_person') })
  test('not found',        () => { const r = engine.getRelationship('you','ghost');        expect(!r.found && r.reason).toBe('not_found') })
  test('no connection',    () => {
    const isolated = { people: { ...BADA_GRAPH.people, stranger: makePerson('stranger','X','M') }, relationships: BADA_GRAPH.relationships }
    const r = createEngine(isolated).getRelationship('you','stranger')
    expect(!r.found && r.reason).toBe('no_connection')
  })
  test('bidirectional',    () => {
    const fwd = engine.getRelationship('you','uncle')
    const rev = engine.getRelationship('uncle','you')
    expect(fwd.found && fwd.path.label).toBe('Your uncle')
    expect(rev.found && rev.path.label).toBe('Your nephew')
  })
})

describe('Graph utilities', () => {
  test('getParents',  () => { const a = buildAdjacency(BADA_GRAPH.relationships); expect(getParents('you',a)).toContain('dad') })
  test('getChildren', () => { const a = buildAdjacency(BADA_GRAPH.relationships); expect(getChildren('dad',a)).toContain('you') })
  test('getSiblings', () => { const a = buildAdjacency(BADA_GRAPH.relationships); expect(getSiblings('you',a)).toContain('sis') })
  test('uncle sibling of dad', () => { const a = buildAdjacency(BADA_GRAPH.relationships); expect(getSiblings('dad',a)).toContain('uncle') })
})

describe('Birthday notifications', () => {
  test('3 days',  () => expect(engine.getBirthdayNotification('you','uncle',3)).toBe("Uncle Dele's birthday is in 3 days — your uncle"))
  test('today',   () => expect(engine.getBirthdayNotification('you','dad',0)).toBe("Dad's birthday is today — your father"))
  test('1 day',   () => expect(engine.getBirthdayNotification('you','gma',1)).toBe("Grandma Risi's birthday is in 1 day — your grandmother"))
})

describe('Non-binary gender', () => {
  test('NB parent', () => {
    const g: FamilyGraph = {
      people: { nb: { ...makePerson('nb','Alex','NB','Alex') }, child: makePerson('child','Jamie','M') },
      relationships: [makeParent('nb','child')],
    }
    const r = createEngine(g).getRelationship('child','nb')
    expect(r.found && r.path.label).toBe('Your parent')
  })
})
EOF

# ══════════════════════════════════════════════════════════════════════════════
# API
# ══════════════════════════════════════════════════════════════════════════════

cat > packages/api/package.json << 'EOF'
{
  "name": "@rootline/api",
  "version": "0.1.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
EOF

cat > packages/api/src/index.ts << 'EOF'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import { relationshipsRouter } from './routes/relationships'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'rootline-api', version: '0.1.0' }))
app.use('/api/v1', relationshipsRouter)
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})
app.listen(PORT, () => console.log(`Rootline API running on http://localhost:${PORT}`))
export default app
EOF

cat > packages/api/src/routes/relationships.ts << 'EOF'
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { createEngine, FamilyGraph } from '../../engine/src/index'

export const relationshipsRouter = Router()
const trees = new Map<string, FamilyGraph>()

const RelSchema  = z.object({ sourceId: z.string().min(1), targetId: z.string().min(1) })
const BdaySchema = z.object({ sourceId: z.string().min(1), targetId: z.string().min(1), daysUntil: z.coerce.number().int().min(0) })

relationshipsRouter.post('/trees/:treeId/graph', (req: Request, res: Response) => {
  const { treeId } = req.params
  const graph = req.body as FamilyGraph
  if (!graph.people || !graph.relationships) return res.status(400).json({ error: 'Invalid graph' })
  trees.set(treeId, graph)
  return res.json({ ok: true, treeId, memberCount: Object.keys(graph.people).length })
})

relationshipsRouter.get('/trees/:treeId/relationship', (req: Request, res: Response) => {
  const p = RelSchema.safeParse(req.query)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  return res.json(createEngine(graph).getRelationship(p.data.sourceId, p.data.targetId))
})

relationshipsRouter.get('/trees/:treeId/people/:personId/relationships', (req: Request, res: Response) => {
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  const { personId } = req.params
  if (!graph.people[personId]) return res.status(404).json({ error: 'Person not found' })
  const all = createEngine(graph).getAllRelationships(personId)
  return res.json({ personId, relationships: all.map(r => ({
    personId: r.personId,
    name: graph.people[r.personId]?.nickname ?? graph.people[r.personId]?.name,
    label: r.result.found ? r.result.path.label : null,
    distance: r.result.found ? r.result.path.distance : null,
  }))})
})

relationshipsRouter.get('/trees/:treeId/birthday-notification', (req: Request, res: Response) => {
  const p = BdaySchema.safeParse(req.query)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  const msg = createEngine(graph).getBirthdayNotification(p.data.sourceId, p.data.targetId, p.data.daysUntil)
  if (!msg) return res.status(404).json({ error: 'Could not generate notification' })
  return res.json({ message: msg })
})
EOF

# ══════════════════════════════════════════════════════════════════════════════
# APP — CONFIG FILES
# ══════════════════════════════════════════════════════════════════════════════

cat > packages/app/package.json << 'EOF'
{
  "name": "@rootline/app",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start":    "expo start",
    "android":  "expo start --android",
    "ios":      "expo start --ios",
    "web":      "expo start --web",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo":                            "~51.0.0",
    "expo-router":                     "~3.5.0",
    "expo-status-bar":                 "~1.12.1",
    "expo-font":                       "~12.0.9",
    "expo-splash-screen":              "~0.27.5",
    "expo-linking":                    "~6.3.1",
    "expo-constants":                  "~16.0.2",
    "expo-haptics":                    "~13.0.1",
    "expo-image":                      "~1.12.12",
    "expo-notifications":              "~0.28.9",
    "react":                           "18.2.0",
    "react-native":                    "0.74.1",
    "react-native-safe-area-context":  "4.10.1",
    "react-native-screens":            "3.31.1",
    "react-native-svg":                "15.2.0",
    "react-native-reanimated":         "~3.10.1",
    "react-native-gesture-handler":    "~2.16.1",
    "zustand":                         "^4.5.2",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@supabase/supabase-js": "^2.43.4"
  },
  "devDependencies": {
    "@babel/core":   "^7.24.0",
    "@types/react":  "~18.2.79",
    "typescript":    "^5.4.5"
  }
}
EOF

cat > packages/app/babel.config.js << 'EOF'
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  }
}
EOF

cat > packages/app/tsconfig.json << 'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@rootline/engine": ["../engine/src/index.ts"]
    }
  },
  "include": ["**/*.ts","**/*.tsx",".expo/types/**/*.d.ts","expo-env.d.ts"]
}
EOF

cat > packages/app/app.json << 'EOF'
{
  "expo": {
    "name": "Rootline",
    "slug": "rootline",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "scheme": "rootline",
    "splash": { "backgroundColor": "#1C1008" },
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.gabbibada.rootline" },
    "android": { "package": "com.gabbibada.rootline" },
    "plugins": ["expo-router","expo-font","expo-splash-screen"],
    "experiments": { "typedRoutes": true }
  }
}
EOF

cat > packages/app/.env.example << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EOF

# ══════════════════════════════════════════════════════════════════════════════
# APP — SOURCE FILES
# ══════════════════════════════════════════════════════════════════════════════

# theme
cat > packages/app/src/theme/index.ts << 'EOF'
export const Colors = {
  bark: '#1C1008', bark2: '#2C1A0E', bark3: '#3A2218',
  amber: '#B07D4A', amberLight: '#C89560',
  sand: '#E8C99A', cream: '#F7F0E6', cream2: '#EDE4D8',
  forest: '#3A6B47', forestLight: '#4A7C59',
  textDark: '#1C1008', textMid: '#7A5C3A', textMuted: '#A8906F', textOnDark: '#E8C99A',
  error: '#C8503C', success: '#3A6B47', warning: '#C9973A',
  surface: '#F7F0E6', surfaceAlt: '#EDE4D8',
  border: 'rgba(176,125,74,0.25)', borderFaint: 'rgba(176,125,74,0.12)',
} as const

export const Typography = {
  display:   { fontFamily: 'CormorantGaramond-Medium',  fontSize: 36, lineHeight: 42 },
  heading1:  { fontFamily: 'CormorantGaramond-Medium',  fontSize: 28, lineHeight: 34 },
  heading2:  { fontFamily: 'CormorantGaramond-Medium',  fontSize: 22, lineHeight: 28 },
  nameTag:   { fontFamily: 'CormorantGaramond-Medium',  fontSize: 18, lineHeight: 22 },
  body:      { fontFamily: 'DMSans-Regular',            fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: 'DMSans-Regular',            fontSize: 13, lineHeight: 18 },
  label:     { fontFamily: 'DMSans-Medium',             fontSize: 13, lineHeight: 16 },
  caption:   { fontFamily: 'DMSans-Regular',            fontSize: 11, lineHeight: 14 },
  mono:      { fontFamily: 'IBMPlexMono-Regular',       fontSize: 10, lineHeight: 14, letterSpacing: 0.8 },
} as const

export const Spacing  = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48 } as const
export const Radius   = { sm:6, md:10, lg:14, xl:20, full:999 } as const
export const Shadow   = {
  card:   { shadowColor:'#1C1008', shadowOffset:{width:0,height:2},  shadowOpacity:0.08, shadowRadius:8,  elevation:3 },
  strong: { shadowColor:'#1C1008', shadowOffset:{width:0,height:8},  shadowOpacity:0.18, shadowRadius:24, elevation:8 },
} as const
EOF

# store
cat > packages/app/src/store/familyStore.ts << 'EOF'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FamilyGraph, Person, Relationship } from '@rootline/engine'

interface FamilyState {
  graph: FamilyGraph | null
  currentUserId: string | null
  selectedMemberId: string | null
  setGraph: (graph: FamilyGraph) => void
  addPerson: (person: Person) => void
  updatePerson: (id: string, updates: Partial<Person>) => void
  addRelationship: (rel: Relationship) => void
  removeRelationship: (relId: string) => void
  setCurrentUser: (id: string) => void
  selectMember: (id: string | null) => void
  getMember: (id: string) => Person | null
  getMemberCount: () => number
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      graph: null, currentUserId: null, selectedMemberId: null,
      setGraph: (graph) => set({ graph }),
      addPerson: (person) => set((s) => !s.graph ? s : {
        graph: { ...s.graph, people: { ...s.graph.people, [person.id]: person } }
      }),
      updatePerson: (id, updates) => set((s) => !s.graph?.people[id] ? s : {
        graph: { ...s.graph, people: { ...s.graph.people, [id]: { ...s.graph.people[id], ...updates } } }
      }),
      addRelationship: (rel) => set((s) => {
        if (!s.graph || s.graph.relationships.some(r => r.id === rel.id)) return s
        return { graph: { ...s.graph, relationships: [...s.graph.relationships, rel] } }
      }),
      removeRelationship: (relId) => set((s) => !s.graph ? s : {
        graph: { ...s.graph, relationships: s.graph.relationships.filter(r => r.id !== relId) }
      }),
      setCurrentUser: (id) => set({ currentUserId: id }),
      selectMember: (id) => set({ selectedMemberId: id }),
      getMember: (id) => get().graph?.people[id] ?? null,
      getMemberCount: () => Object.keys(get().graph?.people ?? {}).length,
    }),
    {
      name: 'rootline-family',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ graph: s.graph, currentUserId: s.currentUserId }),
    }
  )
)
EOF

# hooks
cat > packages/app/src/hooks/useRelationship.ts << 'EOF'
import { useMemo } from 'react'
import { createEngine, FamilyGraph, RelationshipResult } from '@rootline/engine'

export function useRelationship(graph: FamilyGraph|null, sourceId: string|null, targetId: string|null): RelationshipResult|null {
  return useMemo(() => {
    if (!graph || !sourceId || !targetId) return null
    return createEngine(graph).getRelationship(sourceId, targetId)
  }, [graph, sourceId, targetId])
}

export function useAllRelationships(graph: FamilyGraph|null, personId: string|null) {
  return useMemo(() => {
    if (!graph || !personId) return []
    return createEngine(graph).getAllRelationships(personId)
  }, [graph, personId])
}

export function useBirthdayNotification(graph: FamilyGraph|null, sourceId: string|null, targetId: string|null, daysUntil: number): string|null {
  return useMemo(() => {
    if (!graph || !sourceId || !targetId) return null
    return createEngine(graph).getBirthdayNotification(sourceId, targetId, daysUntil)
  }, [graph, sourceId, targetId, daysUntil])
}
EOF

# supabase client
cat > packages/app/src/lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})

export const signUpWithEmail  = (email: string, password: string) => supabase.auth.signUp({ email, password })
export const signInWithEmail  = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password })
export const signOut          = () => supabase.auth.signOut()
export const getSession       = () => supabase.auth.getSession()
EOF

# components
cat > packages/app/src/components/TabIcon.tsx << 'EOF'
import React from 'react'
import Svg, { Path, Circle, Line } from 'react-native-svg'

type IconName = 'home'|'tree'|'family'|'profile'
interface Props { name: IconName; color: string; focused: boolean; size?: number }

export function TabIcon({ name, color, focused, size = 22 }: Props) {
  const w = focused ? 1.8 : 1.4
  switch (name) {
    case 'home':    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/><Path d="M9 22V12h6v10" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/></Svg>
    case 'tree':    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Line x1="12" y1="20" x2="12" y2="10" stroke={color} strokeWidth={w} strokeLinecap="round"/><Path d="M5 20v-6M12 10V4M19 20v-3" stroke={color} strokeWidth={w} strokeLinecap="round"/><Circle cx="12" cy="6" r="2" stroke={color} strokeWidth={w}/><Circle cx="5" cy="14" r="2" stroke={color} strokeWidth={w}/><Circle cx="19" cy="17" r="2" stroke={color} strokeWidth={w}/></Svg>
    case 'family':  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={w} strokeLinecap="round"/><Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={w}/><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>
    case 'profile': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={w}/><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>
  }
}
EOF

echo ""
echo "✅ All source files written."
echo ""
echo "Next steps:"
echo "  1. cd packages/engine && npm install && npm test"
echo "  2. cd packages/app   && npm install"
echo "  3. cp packages/app/.env.example packages/app/.env  (then add Supabase keys)"
echo "  4. cd packages/app   && npx expo start"
