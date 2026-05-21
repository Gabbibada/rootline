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
