import { useMemo, useState } from 'react'
import {
  View, Text, TextInput, Pressable, Modal, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { Gender, Person, Relationship } from '@rootline/engine'
import { useFamilyStore } from '../store/familyStore'
import { persist, saveMember, saveRelationship } from '../lib/db'
import { DatePickerField } from './DatePickerField'
import { Avatar } from './Avatar'
import { Colors, Typography, Spacing, Radius } from '../theme'

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

type RelChoice = 'parent' | 'child' | 'sibling' | 'spouse'

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Man',        value: 'M'  },
  { label: 'Woman',      value: 'F'  },
]

const REL_OPTIONS: { label: string; value: RelChoice }[] = [
  { label: 'Parent',  value: 'parent'  },
  { label: 'Child',   value: 'child'   },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Spouse',  value: 'spouse'  },
]

export interface AddMemberModalProps {
  visible:     boolean
  onClose:     () => void
  onSuccess?:  (name: string) => void   // called just before sheet closes
  pivotId?:    string                   // defaults to currentUserId when omitted
}

export function AddMemberModal({ visible, onClose, onSuccess, pivotId }: AddMemberModalProps) {
  const { graph, currentUserId, addPerson, addRelationship: storeAddRel } = useFamilyStore()
  const me = currentUserId ? graph?.people[currentUserId] : null

  const [name,      setName]      = useState('')
  const [birthday,  setBirthday]  = useState('')
  const [gender,    setGender]    = useState<Gender>('M')
  const [relChoice, setRelChoice] = useState<RelChoice>('parent')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  // When set, we link this existing member instead of creating a new person —
  // prevents duplicate people and missing shared edges (the "mother wired to
  // only one sibling" class of bug).
  const [linkedId,  setLinkedId]  = useState<string | null>(null)

  // The person this new member is being added relative to
  const effectivePivotId = pivotId ?? currentUserId
  const pivot = effectivePivotId ? graph?.people[effectivePivotId] : null
  const pivotFirstName = pivot?.name.split(' ')[0] ?? 'them'

  // IDs of pivot's parents — needed to wire up siblings
  const pivotParentIds = effectivePivotId
    ? (graph?.relationships ?? []).filter(r => r.type === 'parent' && r.to === effectivePivotId).map(r => r.from)
    : []
  const siblingAvailable = pivotParentIds.length > 0

  // Existing members matching the typed name — offered as link targets so
  // family already in the tree isn't re-created as a duplicate person.
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (!graph || linkedId || q.length < 2) return []
    return Object.values(graph.people)
      .filter(p => p.id !== effectivePivotId && p.name.toLowerCase().includes(q))
      .slice(0, 4)
  }, [name, graph, linkedId, effectivePivotId])

  const linked = linkedId ? graph?.people[linkedId] ?? null : null

  const rels = graph?.relationships ?? []
  const edgeExists = (from: string, to: string, type: 'parent' | 'spouse') =>
    rels.some(r => r.type === type && (
      type === 'spouse'
        ? (r.from === from && r.to === to) || (r.from === to && r.to === from)
        : r.from === from && r.to === to))

  // True when candidate is in root's descendant line (parent edges only)
  const isDescendant = (candidate: string, root: string): boolean => {
    const queue = [root]
    const seen  = new Set([root])
    while (queue.length) {
      const cur = queue.shift()!
      for (const r of rels) {
        if (r.type !== 'parent' || r.from !== cur || seen.has(r.to)) continue
        if (r.to === candidate) return true
        seen.add(r.to)
        queue.push(r.to)
      }
    }
    return false
  }

  const reset = () => {
    setName('')
    setBirthday('')
    setGender('M')
    setRelChoice('parent')
    setError('')
    setLinkedId(null)
  }

  const close = () => { reset(); onClose() }

  const buildRel = (targetId: string): Relationship | null => {
    const treeId = me!.treeId
    // parent edge: from = parent, to = child
    if (relChoice === 'parent')  return { id: uid(), from: targetId,          to: effectivePivotId!, type: 'parent', subtype: 'biological', treeId }
    if (relChoice === 'child')   return { id: uid(), from: effectivePivotId!, to: targetId,          type: 'parent', subtype: 'biological', treeId }
    // Sibling = child of pivot's first parent — engine derives sibling from shared parent
    if (relChoice === 'sibling') return { id: uid(), from: pivotParentIds[0], to: targetId,          type: 'parent', subtype: 'biological', treeId }
    if (relChoice === 'spouse')  return { id: uid(), from: effectivePivotId!, to: targetId,          type: 'spouse', subtype: 'biological', treeId }
    return null
  }

  const commit = () => {
    setLoading(true)

    if (linked) {
      const rel = buildRel(linked.id)
      if (rel) {
        storeAddRel(rel)
        persist(() => saveRelationship(rel), `${linked.name}'s relationship`)
      }
      setLoading(false)
      onSuccess?.(linked.name)
      close()
      return
    }

    const personId = uid()
    const newPerson: Person = {
      id:         personId,
      name:       name.trim(),
      nickname:   null,
      gender,
      birthday:   birthday || null,
      birthplace: null,
      deathDate:  null,
      photo:      null,
      location:   null,
      occupation: null,
      story:      null,
      treeId:     me!.treeId,
      deceased:   false,
    }

    const rel = buildRel(personId)
    addPerson(newPerson)
    if (rel) storeAddRel(rel)

    // Optimistic UI; persist retries in the background and alerts on failure
    persist(async () => {
      await saveMember(newPerson)
      if (rel) await saveRelationship(rel)
    }, newPerson.name)

    setLoading(false)
    onSuccess?.(name.trim())
    close()
  }

  const submit = () => {
    setError('')
    if (!name.trim()) { setError('Please enter a name.'); return }
    if (!me || !effectivePivotId) { setError('No current user found.'); return }
    if (relChoice === 'sibling' && !siblingAvailable) {
      setError(`Add a parent first to connect siblings.`); return
    }

    // Linking an existing member — validate before writing any edge
    if (linked) {
      if (relChoice === 'parent') {
        if (edgeExists(linked.id, effectivePivotId, 'parent')) {
          setError(`${linked.name} is already ${pivotFirstName}'s parent.`); return
        }
        if (isDescendant(linked.id, effectivePivotId)) {
          setError(`${linked.name} is a descendant of ${pivotFirstName} — that would loop the tree.`); return
        }
      } else if (relChoice === 'child') {
        if (edgeExists(effectivePivotId, linked.id, 'parent')) {
          setError(`${linked.name} is already ${pivotFirstName}'s child.`); return
        }
        if (isDescendant(effectivePivotId, linked.id)) {
          setError(`${linked.name} is an ancestor of ${pivotFirstName} — that would loop the tree.`); return
        }
      } else if (relChoice === 'sibling') {
        if (edgeExists(pivotParentIds[0], linked.id, 'parent')) {
          setError(`${linked.name} and ${pivotFirstName} are already siblings.`); return
        }
      } else if (relChoice === 'spouse') {
        if (edgeExists(effectivePivotId, linked.id, 'spouse')) {
          setError(`${linked.name} is already ${pivotFirstName}'s spouse.`); return
        }
      }
    }

    // Adding a second mother/father is legal (step/adoptive) but usually a
    // mistake — confirm before wiring it.
    if (relChoice === 'parent') {
      const g = linked ? linked.gender : gender
      const clash = pivotParentIds.some(id => graph?.people[id]?.gender === g)
      if (clash) {
        const word = g === 'M' ? 'father' : g === 'F' ? 'mother' : 'parent'
        Alert.alert(
          `Add another ${word}?`,
          `${pivotFirstName} already has a ${word} in the tree. Add ${(linked?.name ?? name).trim()} as an additional parent?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add anyway', onPress: commit },
          ],
        )
        return
      }
    }

    commit()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kavWrap}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{pivotId ? `Add ${pivotFirstName}'s relative` : 'Add family member'}</Text>
              <Pressable onPress={close} hitSlop={12}>
                <Text style={s.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Full name</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={t => { setName(t); if (linkedId) setLinkedId(null) }}
                  placeholder="e.g. Maria Santos"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoComplete="name"
                />
                {suggestions.length > 0 && (
                  <View style={s.suggestBox}>
                    <Text style={s.suggestHeader}>Already in this tree — link instead:</Text>
                    {suggestions.map(p => (
                      <Pressable
                        key={p.id}
                        style={({ pressed }) => [s.suggestRow, pressed && s.pressed]}
                        onPress={() => { setLinkedId(p.id); setName(p.name); setError('') }}
                      >
                        <Avatar name={p.name} photo={p.photo} size={28} />
                        <Text style={s.suggestName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.suggestLink}>Link</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {linked && (
                  <View style={s.linkedChip}>
                    <Text style={s.linkedText}>
                      Linking {linked.name.split(' ')[0]} — no duplicate will be created
                    </Text>
                    <Pressable onPress={() => setLinkedId(null)} hitSlop={8}>
                      <Text style={s.linkedClear}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {!linked && (<>
              <View style={s.field}>
                <Text style={s.label}>Birthday <Text style={s.optional}>(optional)</Text></Text>
                <DatePickerField
                  value={birthday || null}
                  onChange={iso => setBirthday(iso ?? '')}
                  maxDate={new Date()}
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Gender</Text>
                <View style={s.chipRow}>
                  {GENDERS.map(g => (
                    <Pressable
                      key={g.value}
                      style={[s.chip, gender === g.value && s.chipActive]}
                      onPress={() => setGender(g.value)}
                    >
                      <Text style={[s.chipText, gender === g.value && s.chipTextActive]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              </>)}

              <View style={s.field}>
                <Text style={s.label}>Relationship to {pivotId ? pivotFirstName : 'you'}</Text>
                <View style={s.chipRow}>
                  {REL_OPTIONS.map(r => {
                    const disabled = r.value === 'sibling' && !siblingAvailable
                    return (
                      <Pressable
                        key={r.value}
                        style={[s.chip, relChoice === r.value && s.chipActive, disabled && s.chipDisabled]}
                        onPress={() => !disabled && setRelChoice(r.value)}
                      >
                        <Text style={[s.chipText, relChoice === r.value && s.chipTextActive, disabled && s.chipTextDisabled]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {!siblingAvailable && (
                  <Text style={s.hint}>Add {pivotFirstName}'s parent first to connect siblings</Text>
                )}
              </View>

              {!!error && <Text style={s.error}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [s.btn, loading && s.btnDisabled, pressed && s.pressed]}
                onPress={submit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.cream} />
                  : <Text style={s.btnText}>{linked ? `Link ${linked.name.split(' ')[0]}` : 'Add member'}</Text>}
              </Pressable>

              <View style={{ height: Spacing.xxxl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,16,8,0.50)' },
  kavWrap:         { width: '100%' },
  sheet:           { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '88%', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  handle:          { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  sheetTitle:      { ...Typography.heading2, color: Colors.textDark },
  closeBtn:        { ...Typography.body, color: Colors.textMid, fontSize: 18 },
  field:           { marginBottom: Spacing.lg },
  label:           { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  optional:        { ...Typography.label, color: Colors.textMuted, fontWeight: '400' },
  input:           { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  chipRow:         { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip:            { height: 40, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream2 },
  chipActive:      { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipDisabled:    { opacity: 0.35 },
  chipText:        { ...Typography.label, color: Colors.textMid },
  chipTextActive:  { color: Colors.cream },
  chipTextDisabled:{ color: Colors.textMuted },
  hint:            { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.xs },
  suggestBox:      { marginTop: Spacing.xs, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  suggestHeader:   { ...Typography.caption, color: Colors.textMuted, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  suggestRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  suggestName:     { ...Typography.body, color: Colors.textDark, flex: 1 },
  suggestLink:     { ...Typography.label, color: Colors.amber },
  linkedChip:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.amber, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  linkedText:      { ...Typography.bodySmall, color: Colors.textMid, flexShrink: 1 },
  linkedClear:     { ...Typography.body, color: Colors.textMid, marginLeft: Spacing.sm },
  error:           { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:             { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  btnDisabled:     { opacity: 0.6 },
  pressed:         { opacity: 0.85 },
  btnText:         { ...Typography.label, fontSize: 15, color: Colors.cream },
})
