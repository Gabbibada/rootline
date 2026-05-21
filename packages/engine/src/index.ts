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
