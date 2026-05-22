import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, Modal, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Gender, Person, Relationship } from '@rootline/engine'
import { useFamilyStore } from '../store/familyStore'
import { saveMember, saveRelationship } from '../lib/db'
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
  { label: 'Non-binary', value: 'NB' },
]

const REL_OPTIONS: { label: string; value: RelChoice }[] = [
  { label: 'Parent',  value: 'parent'  },
  { label: 'Child',   value: 'child'   },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Spouse',  value: 'spouse'  },
]

export interface AddMemberModalProps {
  visible:  boolean
  onClose:  () => void
  pivotId?: string   // defaults to currentUserId when omitted
}

export function AddMemberModal({ visible, onClose, pivotId }: AddMemberModalProps) {
  const { graph, currentUserId, addPerson, addRelationship: storeAddRel } = useFamilyStore()
  const me = currentUserId ? graph?.people[currentUserId] : null

  const [name,      setName]      = useState('')
  const [birthday,  setBirthday]  = useState('')
  const [gender,    setGender]    = useState<Gender>('M')
  const [relChoice, setRelChoice] = useState<RelChoice>('parent')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  // The person this new member is being added relative to
  const effectivePivotId = pivotId ?? currentUserId
  const pivot = effectivePivotId ? graph?.people[effectivePivotId] : null
  const pivotFirstName = pivot?.name.split(' ')[0] ?? 'them'

  // IDs of pivot's parents — needed to wire up siblings
  const pivotParentIds = effectivePivotId
    ? (graph?.relationships ?? []).filter(r => r.type === 'parent' && r.to === effectivePivotId).map(r => r.from)
    : []
  const siblingAvailable = pivotParentIds.length > 0

  const reset = () => {
    setName('')
    setBirthday('')
    setGender('M')
    setRelChoice('parent')
    setError('')
  }

  const close = () => { reset(); onClose() }

  const submit = async () => {
    setError('')
    if (!name.trim()) { setError('Please enter a name.'); return }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError('Birthday format: YYYY-MM-DD'); return
    }
    if (!me || !effectivePivotId) { setError('No current user found.'); return }
    if (relChoice === 'sibling' && !siblingAvailable) {
      setError(`Add a parent first to connect siblings.`); return
    }

    setLoading(true)

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
      story:      null,
      treeId:     me.treeId,
      deceased:   false,
    }

    // parent edge: from = parent, to = child
    let rel: Relationship | null = null
    const treeId = me.treeId
    if (relChoice === 'parent') {
      rel = { id: uid(), from: personId,            to: effectivePivotId, type: 'parent', subtype: 'biological', treeId }
    } else if (relChoice === 'child') {
      rel = { id: uid(), from: effectivePivotId,    to: personId,         type: 'parent', subtype: 'biological', treeId }
    } else if (relChoice === 'sibling') {
      // Connect new person as child of pivot's first parent — engine derives sibling from shared parent
      rel = { id: uid(), from: pivotParentIds[0],   to: personId,         type: 'parent', subtype: 'biological', treeId }
    } else if (relChoice === 'spouse') {
      rel = { id: uid(), from: effectivePivotId,    to: personId,         type: 'spouse', subtype: 'biological', treeId }
    }

    addPerson(newPerson)
    if (rel) storeAddRel(rel)

    // Best-effort Supabase persist — don't block UI
    saveMember(newPerson).catch(() => undefined)
    if (rel) saveRelationship(rel).catch(() => undefined)

    setLoading(false)
    close()
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
                  onChangeText={setName}
                  placeholder="e.g. Maria Santos"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Birthday <Text style={s.optional}>(optional)</Text></Text>
                <TextInput
                  style={s.input}
                  value={birthday}
                  onChangeText={setBirthday}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
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
                  : <Text style={s.btnText}>Add member</Text>}
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
  error:           { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:             { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  btnDisabled:     { opacity: 0.6 },
  pressed:         { opacity: 0.85 },
  btnText:         { ...Typography.label, fontSize: 15, color: Colors.cream },
})
