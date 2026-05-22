/**
 * "How are we related?" screen
 *
 * Two person pickers (A defaults to the current user, B is chosen from the
 * full family list). The relationship engine computes the shortest path and
 * the PathExplainer shows the chain of people.
 */
import { useState, useMemo } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  FlatList, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { createEngine, Person, Direction, RelationshipPath } from '@rootline/engine'
import { useFamilyStore } from '../src/store/familyStore'
import { Avatar } from '../src/components/Avatar'
import { Colors, Typography, Spacing, Radius, Shadow } from '../src/theme'

// ── PathExplainer (local copy, mirrors member/[id].tsx) ──────────────────────

function stepLabel(dir: Direction): string {
  if (dir === 'up')   return 'parent'
  if (dir === 'down') return 'child'
  return 'spouse'
}

function PathExplainer({ path, people }: { path: RelationshipPath; people: Record<string, Person> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.pathScroll}
    >
      {path.personIds.map((pid, idx) => {
        const person  = people[pid]
        const name    = person?.name.split(' ')[0] ?? '?'
        const isFirst = idx === 0
        const isLast  = idx === path.personIds.length - 1
        const step    = path.steps[idx]
        return (
          <View key={pid} style={s.pathItem}>
            <View style={s.pathNode}>
              <Avatar
                name={person?.name ?? '?'}
                photo={person?.photo}
                size={44}
                amber={isFirst}
                style={[s.pathAvatar, isLast && s.pathAvatarTarget]}
              />
              <Text style={s.pathName} numberOfLines={1}>{name}</Text>
            </View>
            {step && (
              <View style={s.pathConnector}>
                <Text style={s.pathConnLabel}>{stepLabel(step.direction)}</Text>
                <Text style={s.pathConnArrow}>›</Text>
              </View>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

// ── Person picker modal ───────────────────────────────────────────────────────

function PersonPicker({
  visible,
  onClose,
  onSelect,
  excludeId,
  people,
}: {
  visible:   boolean
  onClose:   () => void
  onSelect:  (p: Person) => void
  excludeId: string | null
  people:    Person[]
}) {
  const [q, setQ] = useState('')
  const filtered  = useMemo(() => {
    const lq = q.trim().toLowerCase()
    return people.filter(p => p.id !== excludeId && (!lq || p.name.toLowerCase().includes(lq)))
  }, [q, people, excludeId])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.pickerOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={s.pickerSheet}>
          <View style={s.pickerHandle} />
          <Text style={s.pickerTitle}>Choose a person</Text>
          <TextInput
            style={s.pickerSearch}
            value={q}
            onChangeText={setQ}
            placeholder="Search name…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.pickerRow, pressed && s.pressed]}
                onPress={() => { onSelect(item); setQ(''); onClose() }}
              >
                <Avatar name={item.name} photo={item.photo} size={36} />
                <View style={s.pickerRowText}>
                  <Text style={s.pickerRowName}>{item.name}</Text>
                  {item.birthday && (
                    <Text style={s.pickerRowSub}>{item.birthday.slice(0, 4)}</Text>
                  )}
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        </View>
      </View>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RelateScreen() {
  const router = useRouter()
  const { graph, currentUserId } = useFamilyStore()

  const meId    = currentUserId ?? null
  const me      = meId && graph ? graph.people[meId] : null
  const allPeople = useMemo(() => Object.values(graph?.people ?? {}), [graph])

  const [personA, setPersonA] = useState<Person | null>(me)
  const [personB, setPersonB] = useState<Person | null>(null)
  const [pickerFor, setPickerFor] = useState<'A' | 'B' | null>(null)

  const result = useMemo(() => {
    if (!graph || !personA || !personB) return null
    const engine = createEngine(graph)
    return engine.getRelationship(personA.id, personB.id)
  }, [graph, personA, personB])

  if (!graph) return null

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.back}>← Back</Text>
          </Pressable>
          <Text style={s.title}>How are we related?</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Two person slots */}
        <View style={s.slots}>
          {([['A', personA, setPersonA], ['B', personB, setPersonB]] as const).map(
            ([label, person, setPerson]) => (
              <Pressable
                key={label}
                style={({ pressed }) => [s.slot, pressed && s.pressed]}
                onPress={() => setPickerFor(label as 'A' | 'B')}
              >
                {person ? (
                  <>
                    <Avatar name={person.name} photo={person.photo} size={52} amber={label === 'A'} />
                    <Text style={s.slotName} numberOfLines={1}>{person.name}</Text>
                    <Text style={s.slotTap}>Tap to change</Text>
                  </>
                ) : (
                  <>
                    <View style={s.slotEmpty}>
                      <Text style={s.slotEmptyPlus}>+</Text>
                    </View>
                    <Text style={s.slotName}>Choose person</Text>
                    <Text style={s.slotTap}>Tap to select</Text>
                  </>
                )}
              </Pressable>
            )
          )}
        </View>

        {/* Connector icon */}
        <View style={s.connector}>
          <Text style={s.connectorText}>↔</Text>
        </View>

        {/* Result */}
        {result && (
          <View style={s.resultCard}>
            {result.found ? (
              <>
                <Text style={s.resultLabel}>
                  {personA?.name.split(' ')[0]} is{' '}
                  {personB?.name.split(' ')[0]}'s
                </Text>
                <Text style={s.resultRelLabel}>{result.path.label}</Text>
                {result.path.distance > 1 && (
                  <>
                    <Text style={s.pathSectionLabel}>Connection path</Text>
                    <PathExplainer path={result.path} people={graph.people} />
                  </>
                )}
              </>
            ) : (
              <Text style={s.noResultText}>
                {result.reason === 'same_person'
                  ? 'That's the same person!'
                  : 'No connection found in this tree.'}
              </Text>
            )}
          </View>
        )}

        {!personA || !personB ? (
          <Text style={s.hint}>Select two people above to see their relationship.</Text>
        ) : null}
      </ScrollView>

      <PersonPicker
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(p) => {
          if (pickerFor === 'A') setPersonA(p)
          else setPersonB(p)
        }}
        excludeId={pickerFor === 'A' ? personB?.id ?? null : personA?.id ?? null}
        people={allPeople}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.cream },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },
  back:         { ...Typography.body, color: Colors.textMid },
  title:        { ...Typography.heading2, color: Colors.textDark, flex: 1, textAlign: 'center' },

  slots:        { flexDirection: 'row', gap: Spacing.md },
  slot:         { flex: 1, backgroundColor: Colors.cream2, borderRadius: Radius.lg,
                  padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, ...Shadow.card },
  slotEmpty:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2,
                  borderColor: Colors.border, borderStyle: 'dashed',
                  alignItems: 'center', justifyContent: 'center' },
  slotEmptyPlus:{ ...Typography.heading2, color: Colors.textMuted, lineHeight: 28 },
  slotName:     { ...Typography.label, color: Colors.textDark, textAlign: 'center' },
  slotTap:      { ...Typography.bodySmall, color: Colors.textMuted },
  pressed:      { opacity: 0.75 },

  connector:    { alignItems: 'center', marginVertical: Spacing.lg },
  connectorText:{ fontSize: 28, color: Colors.amber },

  resultCard:   { backgroundColor: Colors.bark, borderRadius: Radius.lg, padding: Spacing.xl,
                  alignItems: 'center', ...Shadow.strong },
  resultLabel:  { ...Typography.body, color: Colors.sand, opacity: 0.75, marginBottom: Spacing.xs },
  resultRelLabel:{ ...Typography.display, fontSize: 26, color: Colors.amber, textAlign: 'center',
                   marginBottom: Spacing.lg },
  noResultText: { ...Typography.body, color: Colors.sand, opacity: 0.65, textAlign: 'center' },
  pathSectionLabel: { ...Typography.mono, fontSize: 10, color: Colors.sand, opacity: 0.5,
                      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.sm },

  // Path explainer
  pathScroll:   { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  pathItem:     { flexDirection: 'row', alignItems: 'center' },
  pathNode:     { alignItems: 'center', width: 64 },
  pathAvatar:   {},
  pathAvatarTarget: {},
  pathName:     { ...Typography.mono, color: Colors.sand, fontSize: 9, textAlign: 'center',
                  marginTop: 4, opacity: 0.7 },
  pathConnector:{ alignItems: 'center', paddingHorizontal: Spacing.xs },
  pathConnLabel:{ ...Typography.mono, color: Colors.sand, fontSize: 8, letterSpacing: 0.4, opacity: 0.5 },
  pathConnArrow:{ fontSize: 18, color: Colors.sand, lineHeight: 22, opacity: 0.5 },

  hint: { ...Typography.body, color: Colors.textMuted, textAlign: 'center',
          marginTop: Spacing.xxl },

  // Picker modal
  pickerOverlay:{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,16,8,0.5)' },
  pickerSheet:  { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.xl,
                  borderTopRightRadius: Radius.xl, maxHeight: '80%',
                  paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  pickerHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2,
                  alignSelf: 'center', marginBottom: Spacing.lg },
  pickerTitle:  { ...Typography.heading2, color: Colors.textDark, marginBottom: Spacing.md },
  pickerSearch: { height: 44, backgroundColor: Colors.cream2, borderWidth: 1,
                  borderColor: Colors.border, borderRadius: Radius.full,
                  paddingHorizontal: Spacing.lg, ...Typography.body,
                  color: Colors.textDark, marginBottom: Spacing.md },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                  paddingVertical: Spacing.md },
  pickerRowText:{ flex: 1 },
  pickerRowName:{ ...Typography.nameTag, color: Colors.textDark },
  pickerRowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  sep:          { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderFaint },
})
