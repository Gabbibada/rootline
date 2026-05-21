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
