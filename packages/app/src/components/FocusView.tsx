/**
 * FocusView — re-rootable "browse" mode for the Tree tab.
 *
 * Shows one person as the anchor with parents above, spouse(s) beside,
 * children below, and siblings as chips. Tapping any person re-centres the
 * view on them; relationship labels always stay relative to the current
 * user (via the labelMap computed on the Tree screen).
 */
import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { buildAdjacency, FamilyGraph } from '@rootline/engine'
import { Avatar } from './Avatar'
import { Colors, Typography, Spacing, Radius } from '../theme'

interface FocusViewProps {
  graph:         FamilyGraph
  currentUserId: string
  labelMap:      Map<string, string>
  onOpenProfile: (id: string) => void
  onAddRelative: (pivotId: string) => void
}

export function FocusView({ graph, currentUserId, labelMap, onOpenProfile, onAddRelative }: FocusViewProps) {
  const [focusId, setFocusId] = useState(currentUserId)

  const adj = useMemo(() => {
    const rels = Array.isArray(graph.relationships) ? graph.relationships : []
    return buildAdjacency(rels)
  }, [graph])

  const focus = graph.people[focusId] ?? graph.people[currentUserId]

  const { parents, spouses, children, siblings } = useMemo(() => {
    const edges = adj[focus.id] ?? []
    const byDir = (d: string) => edges.filter(e => e.direction === d).map(e => graph.people[e.to]).filter(Boolean)
    const parents = byDir('up')
    const spouses = byDir('spouse')
    const children = byDir('down')

    const sibIds = new Set<string>()
    for (const p of parents) {
      for (const e of (adj[p.id] ?? [])) {
        if (e.direction === 'down' && e.to !== focus.id) sibIds.add(e.to)
      }
    }
    const siblings = [...sibIds].map(id => graph.people[id]).filter(Boolean)
    return { parents, spouses, children, siblings }
  }, [adj, graph, focus.id])

  const label = (id: string) => labelMap.get(id) ?? ''
  const displayName = (p: { name: string; deceased: boolean }) =>
    p.deceased ? `${p.name.split(' ')[0]} †` : p.name.split(' ')[0]

  const PersonCard = ({ person }: { person: (typeof graph.people)[string] }) => (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.pressed]}
      onPress={() => setFocusId(person.id)}
    >
      <Avatar name={person.name} photo={person.photo} size={32} amber={person.id === currentUserId} />
      <View style={s.cardText}>
        <Text style={s.cardName} numberOfLines={1}>{displayName(person)}</Text>
        {!!label(person.id) && <Text style={s.cardRel} numberOfLines={1}>{label(person.id)}</Text>}
      </View>
      <Text style={s.cardChevron}>›</Text>
    </Pressable>
  )

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.hint}>Tap anyone to make them the centre</Text>

      {focusId !== currentUserId && (
        <Pressable style={({ pressed }) => [s.backChip, pressed && s.pressed]} onPress={() => setFocusId(currentUserId)}>
          <Text style={s.backChipText}>⌂  Back to you</Text>
        </Pressable>
      )}

      {/* Parents */}
      {parents.length > 0 && (
        <>
          <View style={s.row}>
            {parents.map(p => <PersonCard key={p.id} person={p} />)}
          </View>
          <View style={s.vline} />
        </>
      )}

      {/* Anchor + spouse(s) */}
      <View style={s.anchorRow}>
        <Pressable
          style={({ pressed }) => [s.anchor, pressed && s.pressed]}
          onPress={() => onOpenProfile(focus.id)}
        >
          <Avatar name={focus.name} photo={focus.photo} size={44} amber />
          <View style={s.cardText}>
            <Text style={s.anchorName} numberOfLines={1}>{displayName(focus)}</Text>
            <Text style={s.anchorRel}>{label(focus.id) || ' '}</Text>
            <Text style={s.anchorLink}>View profile →</Text>
          </View>
        </Pressable>
        {spouses.map(sp => (
          <View key={sp.id} style={s.spouseWrap}>
            <View style={s.dash} />
            <PersonCard person={sp} />
          </View>
        ))}
      </View>

      {/* Children */}
      {children.length > 0 && (
        <>
          <View style={s.vline} />
          <View style={s.row}>
            {children.map(c => <PersonCard key={c.id} person={c} />)}
          </View>
        </>
      )}

      {/* Siblings */}
      {siblings.length > 0 && (
        <View style={s.sibs}>
          <Text style={s.sibsLabel}>SIBLINGS</Text>
          <View style={s.chips}>
            {siblings.map(sib => (
              <Pressable
                key={sib.id}
                style={({ pressed }) => [s.chip, pressed && s.pressed]}
                onPress={() => setFocusId(sib.id)}
              >
                <Avatar name={sib.name} photo={sib.photo} size={22} />
                <Text style={s.chipText} numberOfLines={1}>
                  {displayName(sib)}{label(sib.id) ? ` · ${label(sib.id)}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
        onPress={() => onAddRelative(focus.id)}
      >
        <Text style={s.addBtnText}>+ Add {focus.name.split(' ')[0]}'s relative</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll:     { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  hint:       { ...Typography.bodySmall, color: Colors.sand, opacity: 0.55, marginBottom: Spacing.lg },
  pressed:    { opacity: 0.75 },

  backChip:     { flexDirection: 'row', backgroundColor: Colors.bark2, borderWidth: 1, borderColor: Colors.bark3,
                  borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
                  marginBottom: Spacing.lg },
  backChipText: { ...Typography.label, color: Colors.amber, fontSize: 12 },

  row:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  vline:      { width: 1.5, height: 16, backgroundColor: Colors.amber, opacity: 0.45, marginVertical: Spacing.xs },

  card:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                backgroundColor: Colors.bark2, borderWidth: 1, borderColor: Colors.bark3,
                borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                minWidth: 130, maxWidth: 170 },
  cardText:   { flexShrink: 1 },
  cardName:   { ...Typography.label, color: Colors.cream, fontSize: 13 },
  cardRel:    { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  cardChevron:{ ...Typography.body, color: Colors.textMuted, marginLeft: 'auto' },

  anchorRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  anchor:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                backgroundColor: Colors.bark2, borderWidth: 1.5, borderColor: Colors.amber,
                borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  anchorName: { ...Typography.nameTag, color: Colors.cream },
  anchorRel:  { ...Typography.caption, color: Colors.amber, marginTop: 1 },
  anchorLink: { ...Typography.caption, color: Colors.sand, opacity: 0.6, marginTop: 3 },

  spouseWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dash:       { width: 14, height: 0, borderTopWidth: 1.5, borderTopColor: Colors.amber, borderStyle: 'dashed' },

  sibs:       { marginTop: Spacing.xl, alignItems: 'center', width: '100%' },
  sibsLabel:  { ...Typography.mono, fontSize: 9, color: Colors.sand, opacity: 0.5, letterSpacing: 1, marginBottom: Spacing.sm },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
                backgroundColor: Colors.bark2, borderWidth: 1, borderColor: Colors.bark3,
                borderRadius: Radius.full, paddingLeft: 4, paddingRight: Spacing.md, paddingVertical: 4 },
  chipText:   { ...Typography.caption, color: Colors.sand, maxWidth: 150 },

  addBtn:     { marginTop: Spacing.xxl, height: 44, borderWidth: 1, borderColor: Colors.bark3,
                borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: Spacing.xl },
  addBtnText: { ...Typography.label, color: Colors.amber, fontSize: 13 },
})
