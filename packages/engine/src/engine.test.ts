import { createEngine, FamilyGraph, RelationshipEngine } from './index'
import { buildAdjacency, getSiblings, getParents, getChildren } from './graph'

function makePerson(id: string, name: string, gender: 'M'|'F'|'NB', nickname?: string) {
  return { id, name, nickname: nickname ?? null, gender, birthday: null, birthplace: null,
           deathDate: null, photo: null, location: null, occupation: null, story: null, treeId: 'bada-tree', deceased: false }
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

describe('Non-canonical paths — the mislabelled-mother regression', () => {
  // Real tester bug: mum was wired as the brother's parent but not Janet's,
  // so Janet's shortest path to her own mother was [up,down,up] — and the
  // old u/d counting called her mother "Your sister". Paths that climb
  // again after descending have no honest kinship name.
  const g: FamilyGraph = {
    people: {
      dad:   makePerson('dad',   'Emmanuel', 'M'),
      mum:   makePerson('mum',   'Modupe',   'F'),
      gma:   makePerson('gma',   'Lydia',    'F'),
      bro:   makePerson('bro',   'Gabriel',  'M'),
      janet: makePerson('janet', 'Janet',    'F'),
    },
    relationships: [
      makeParent('dad', 'bro'), makeParent('dad', 'janet'),
      makeParent('mum', 'bro'), makeParent('gma', 'mum'),
    ],
  }
  test('mother reachable only via sibling is never "sister"', () => {
    const r = createEngine(g).getRelationship('janet', 'mum')
    expect(r.found && r.path.steps.map((s: any) => s.direction)).toEqual(['up', 'down', 'up'])
    expect(r.found && r.path.label).toBe('Your relative')
  })
  test('grandmother reachable only via sibling is never "sister"', () => {
    const r = createEngine(g).getRelationship('janet', 'gma')
    expect(r.found && r.path.label).toBe('Your relative')
  })
})

describe('In-law and step labels', () => {
  const g: FamilyGraph = {
    people: {
      you:     makePerson('you',     'Gabriel', 'M'),
      wife:    makePerson('wife',    'Emiola',  'F'),
      wmum:    makePerson('wmum',    'Elizabeth', 'F'),
      dad:     makePerson('dad',     'Emmanuel', 'M'),
      stepmum: makePerson('stepmum', 'Grace',   'F'),
      sis:     makePerson('sis',     'Janet',   'F'),
      sishub:  makePerson('sishub',  'Tunde',   'M'),
      dau:     makePerson('dau',     'Joanna',  'F'),
      dauhub:  makePerson('dauhub',  'Seun',    'M'),
    },
    relationships: [
      makeSpouse('you', 'wife'),
      makeParent('wmum', 'wife'),
      makeParent('dad', 'you'), makeParent('dad', 'sis'),
      makeSpouse('dad', 'stepmum'),
      makeSpouse('sis', 'sishub'),
      makeParent('you', 'dau'),
      makeSpouse('dau', 'dauhub'),
    ],
  }
  test("wife's mother is mother-in-law",     () => { const r = createEngine(g).getRelationship('you', 'wmum');   expect(r.found && r.path.label).toBe('Your mother-in-law') })
  test("father's spouse is step-mother",     () => { const r = createEngine(g).getRelationship('you', 'stepmum'); expect(r.found && r.path.label).toBe('Your step-mother') })
  test("sister's husband is brother-in-law", () => { const r = createEngine(g).getRelationship('you', 'sishub'); expect(r.found && r.path.label).toBe('Your brother-in-law') })
  test("daughter's husband is son-in-law",   () => { const r = createEngine(g).getRelationship('you', 'dauhub'); expect(r.found && r.path.label).toBe('Your son-in-law') })
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
