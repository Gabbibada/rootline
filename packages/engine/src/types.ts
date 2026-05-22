export type Gender = 'M' | 'F' | 'NB'
export type EdgeType = 'parent' | 'spouse'
export type EdgeSubtype = 'biological' | 'step' | 'adoptive' | 'legal'
export type Direction = 'up' | 'down' | 'spouse'

export interface Person {
  id:         string
  name:       string
  nickname:   string | null
  gender:     Gender
  birthday:   string | null   // YYYY-MM-DD
  birthplace: string | null
  deathDate:  string | null   // YYYY-MM-DD
  photo:      string | null
  location:   string | null
  story:      string | null
  treeId:     string
  deceased:   boolean
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
