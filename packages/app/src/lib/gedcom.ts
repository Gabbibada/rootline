/**
 * Minimal GEDCOM 5.5.1 parser and exporter.
 *
 * Parser supports:
 *   INDI  — individuals  (NAME, SEX, BIRT/DATE, BIRT/PLAC, DEAT/DATE, OCCU)
 *   FAM   — families     (HUSB, WIFE, CHIL, MARR/DATE)
 *
 * Exporter writes a valid GEDCOM 5.5.1 file from a FamilyGraph.
 */

import { FamilyGraph, Person, Relationship } from '@rootline/engine'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GedcomRecord {
  level:    number
  tag:      string
  value:    string
  xref:     string | null
  children: GedcomRecord[]
}

export interface ParseResult {
  people:        Person[]
  relationships: Relationship[]
  errors:        string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

/** Convert GEDCOM date string (e.g. "15 JAN 1950") → YYYY-MM-DD or null */
function parseGedcomDate(raw: string): string | null {
  const MONTHS: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  // Handle "DD MON YYYY" or "MON YYYY" or "YYYY"
  const parts = raw.trim().toUpperCase().split(/\s+/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    const month = MONTHS[m]
    if (!month || !y.match(/^\d{4}$/)) return null
    return `${y}-${month}-${d.padStart(2, '0')}`
  }
  if (parts.length === 2) {
    const [m, y] = parts
    const month = MONTHS[m]
    if (!month || !y.match(/^\d{4}$/)) return null
    return `${y}-${month}-01`
  }
  if (parts.length === 1 && parts[0].match(/^\d{4}$/)) {
    return `${parts[0]}-01-01`
  }
  return null
}

// ── Parser ────────────────────────────────────────────────────────────────────

function tokenise(text: string): GedcomRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const roots: GedcomRecord[] = []
  const stack: GedcomRecord[] = []

  for (const line of lines) {
    const m = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\w+)\s*(.*)$/)
    if (!m) continue
    const level = parseInt(m[1], 10)
    const xref  = m[2]?.replace(/@/g, '').trim() || null
    const tag   = m[3].toUpperCase()
    const value = m[4]?.trim() || ''

    const rec: GedcomRecord = { level, tag, value, xref, children: [] }

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(rec)
    } else {
      stack[stack.length - 1].children.push(rec)
    }
    stack.push(rec)
  }
  return roots
}

function child(rec: GedcomRecord, tag: string): GedcomRecord | null {
  return rec.children.find(c => c.tag === tag) ?? null
}

function childVal(rec: GedcomRecord, tag: string): string {
  return child(rec, tag)?.value ?? ''
}

/** Clean GEDCOM name: "/Doe/" → "Doe", "John /Doe/" → "John Doe" */
function cleanName(raw: string): string {
  return raw.replace(/\//g, '').replace(/\s{2,}/g, ' ').trim()
}

export function parseGEDCOM(text: string, treeId: string): ParseResult {
  const errors: string[] = []
  const people: Person[] = []
  const relationships: Relationship[] = []

  // xref → local UUID
  const idMap = new Map<string, string>()

  const roots = tokenise(text)

  // ── Pass 1: individuals ──────────────────────────────────────────────────
  for (const rec of roots) {
    if (rec.tag !== 'INDI' || !rec.xref) continue

    const localId = uid()
    idMap.set(rec.xref, localId)

    const nameRaw = childVal(rec, 'NAME')
    const name    = cleanName(nameRaw) || 'Unknown'

    const sexRaw  = childVal(rec, 'SEX').toUpperCase()
    const gender  = sexRaw === 'F' ? 'F' : sexRaw === 'M' ? 'M' : 'NB'

    const birtRec    = child(rec, 'BIRT')
    const birtDate   = birtRec ? parseGedcomDate(childVal(birtRec, 'DATE')) : null
    const birthplace = birtRec ? childVal(birtRec, 'PLAC') || null : null

    const deatRec  = child(rec, 'DEAT')
    const deathDate= deatRec ? parseGedcomDate(childVal(deatRec, 'DATE')) : null
    const deceased = !!deatRec

    const occupation = childVal(rec, 'OCCU') || null
    const note       = childVal(rec, 'NOTE') || null

    people.push({
      id: localId, name, nickname: null, gender,
      birthday: birtDate, birthplace, deathDate, deceased,
      photo: null, location: null, occupation,
      story: note, treeId,
    } as Person & { occupation: string | null })
  }

  // ── Pass 2: families ─────────────────────────────────────────────────────
  for (const rec of roots) {
    if (rec.tag !== 'FAM') continue

    const husbXref = child(rec, 'HUSB')?.value.replace(/@/g, '').trim()
    const wifeXref = child(rec, 'WIFE')?.value.replace(/@/g, '').trim()
    const childXrefs = rec.children
      .filter(c => c.tag === 'CHIL')
      .map(c => c.value.replace(/@/g, '').trim())

    const husbId = husbXref ? idMap.get(husbXref) : undefined
    const wifeId = wifeXref ? idMap.get(wifeXref) : undefined

    // Spouse relationship
    if (husbId && wifeId) {
      relationships.push({
        id: uid(), from: husbId, to: wifeId,
        type: 'spouse', subtype: 'biological', treeId,
      })
    }

    // Parent → child edges for each parent
    const parentIds = [husbId, wifeId].filter(Boolean) as string[]
    for (const childXref of childXrefs) {
      const childId = idMap.get(childXref)
      if (!childId) { errors.push(`Unknown child ref: ${childXref}`); continue }
      // Use first available parent (engine only needs one parent edge to compute siblings)
      const parentId = parentIds[0]
      if (parentId) {
        relationships.push({
          id: uid(), from: parentId, to: childId,
          type: 'parent', subtype: 'biological', treeId,
        })
      }
      // If both parents exist, also add edge from second parent (engine supports multiple parents)
      if (parentIds[1]) {
        relationships.push({
          id: uid(), from: parentIds[1], to: childId,
          type: 'parent', subtype: 'biological', treeId,
        })
      }
    }
  }

  return { people, relationships, errors }
}

// ── Exporter ──────────────────────────────────────────────────────────────────

function gedDate(iso: string | null): string {
  if (!iso) return ''
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function exportGEDCOM(graph: FamilyGraph): string {
  const people = Object.values(graph.people)
  const rels   = graph.relationships

  // Build person → GEDCOM xref map
  const xrefMap = new Map<string, string>()
  people.forEach((p, i) => xrefMap.set(p.id, `I${i + 1}`))

  // Build FAM records: group spouse pairs + their children
  const famMap = new Map<string, { husb?: string; wife?: string; children: string[] }>()
  const spouseRels = rels.filter(r => r.type === 'spouse')
  spouseRels.forEach((r, i) => {
    const key = `F${i + 1}`
    famMap.set(key, { husb: r.from, wife: r.to, children: [] })
  })

  // Assign children to families
  for (const rel of rels.filter(r => r.type === 'parent')) {
    // Find a FAM where this parent is husb or wife
    for (const [key, fam] of famMap) {
      if (fam.husb === rel.from || fam.wife === rel.from) {
        if (!fam.children.includes(rel.to)) fam.children.push(rel.to)
        break
      }
    }
  }

  const lines: string[] = []

  lines.push('0 HEAD')
  lines.push('1 GEDC')
  lines.push('2 VERS 5.5.1')
  lines.push('1 CHAR UTF-8')
  lines.push('1 SOUR Rootline')
  lines.push('2 NAME Rootline Family Tree App')

  for (const p of people) {
    const xref = xrefMap.get(p.id)!
    lines.push(`0 @${xref}@ INDI`)
    lines.push(`1 NAME ${p.name}`)
    if (p.gender !== 'NB') lines.push(`1 SEX ${p.gender}`)
    if (p.birthday || p.birthplace) {
      lines.push('1 BIRT')
      if (p.birthday)   lines.push(`2 DATE ${gedDate(p.birthday)}`)
      if (p.birthplace) lines.push(`2 PLAC ${p.birthplace}`)
    }
    if (p.deceased || p.deathDate) {
      lines.push('1 DEAT Y')
      if (p.deathDate) lines.push(`2 DATE ${gedDate(p.deathDate)}`)
    }
    if ((p as any).occupation) lines.push(`1 OCCU ${(p as any).occupation}`)
    if (p.story)      lines.push(`1 NOTE ${p.story.replace(/\n/g, ' ')}`)
  }

  let famIdx = 1
  for (const [, fam] of famMap) {
    lines.push(`0 @F${famIdx}@ FAM`)
    if (fam.husb) lines.push(`1 HUSB @${xrefMap.get(fam.husb)}@`)
    if (fam.wife) lines.push(`1 WIFE @${xrefMap.get(fam.wife)}@`)
    for (const cid of fam.children) {
      const cx = xrefMap.get(cid)
      if (cx) lines.push(`1 CHIL @${cx}@`)
    }
    famIdx++
  }

  lines.push('0 TRLR')
  return lines.join('\n')
}
