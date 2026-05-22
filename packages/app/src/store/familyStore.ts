import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FamilyGraph, Person, Relationship } from '@rootline/engine'

// ── Activity log ──────────────────────────────────────────────────────────────
export type ActivityType = 'added' | 'updated' | 'removed'

export interface ActivityEntry {
  id:         string
  type:       ActivityType
  personId:   string
  personName: string
  timestamp:  number   // Date.now()
}

function uid6() {
  return Math.random().toString(36).slice(2, 8)
}

// ── Store types ───────────────────────────────────────────────────────────────
interface FamilyState {
  graph:           FamilyGraph | null
  currentUserId:   string | null
  selectedMemberId:string | null
  treeName:        string | null
  activityLog:     ActivityEntry[]

  setGraph:         (graph: FamilyGraph) => void
  initGraph:        (person: Person, treeName: string) => void
  loadGraph:        (graph: FamilyGraph, treeName: string, currentUserId: string | null) => void
  addPerson:        (person: Person) => void
  updatePerson:     (id: string, updates: Partial<Person>) => void
  removePerson:     (id: string) => void
  addRelationship:  (rel: Relationship) => void
  removeRelationship:(relId: string) => void
  setCurrentUser:   (id: string) => void
  selectMember:     (id: string | null) => void
  getMember:        (id: string) => Person | null
  getMemberCount:   () => number
  logActivity:      (type: ActivityType, person: Pick<Person, 'id' | 'name'>) => void
  clearActivity:    () => void
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      graph: null, currentUserId: null, selectedMemberId: null, treeName: null, activityLog: [],

      setGraph: (graph) => set({ graph }),

      loadGraph: (graph, treeName, currentUserId) => set({ graph, treeName, currentUserId }),

      initGraph: (person, treeName) => set({
        graph: { people: { [person.id]: person }, relationships: [] },
        currentUserId: person.id,
        treeName,
      }),

      addPerson: (person) => set((s) => !s.graph ? s : {
        graph: { ...s.graph, people: { ...s.graph.people, [person.id]: person } },
      }),

      updatePerson: (id, updates) => set((s) => !s.graph?.people[id] ? s : {
        graph: { ...s.graph, people: { ...s.graph.people, [id]: { ...s.graph.people[id], ...updates } } },
      }),

      removePerson: (id) => set((s) => {
        if (!s.graph) return s
        const { [id]: _removed, ...remaining } = s.graph.people
        return {
          graph: {
            people: remaining,
            relationships: s.graph.relationships.filter(r => r.from !== id && r.to !== id),
          },
        }
      }),

      addRelationship: (rel) => set((s) => {
        if (!s.graph || s.graph.relationships.some(r => r.id === rel.id)) return s
        return { graph: { ...s.graph, relationships: [...s.graph.relationships, rel] } }
      }),

      removeRelationship: (relId) => set((s) => !s.graph ? s : {
        graph: { ...s.graph, relationships: s.graph.relationships.filter(r => r.id !== relId) },
      }),

      setCurrentUser:  (id) => set({ currentUserId: id }),
      selectMember:    (id) => set({ selectedMemberId: id }),
      getMember:       (id) => get().graph?.people[id] ?? null,
      getMemberCount:  () => Object.keys(get().graph?.people ?? {}).length,

      logActivity: (type, person) => set((s) => ({
        activityLog: [
          { id: uid6(), type, personId: person.id, personName: person.name, timestamp: Date.now() },
          ...s.activityLog,
        ].slice(0, 50),   // keep last 50 entries
      })),

      clearActivity: () => set({ activityLog: [] }),
    }),
    {
      name: 'rootline-family',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        graph:        s.graph,
        currentUserId:s.currentUserId,
        treeName:     s.treeName,
        activityLog:  s.activityLog,
      }),
    }
  )
)
