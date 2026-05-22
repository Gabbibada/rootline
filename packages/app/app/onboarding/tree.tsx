import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { createTree, saveMember } from '../../src/lib/db'
import { useFamilyStore } from '../../src/store/familyStore'
import { Gender, Person } from '@rootline/engine'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

function StepDots() {
  return (
    <View style={d.dots}>
      <View style={[d.dot, d.dotActive]} />
      <View style={[d.dot, d.dotActive]} />
    </View>
  )
}

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default function TreeScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ name: string; birthday: string; gender: string }>()
  const initGraph = useFamilyStore(s => s.initGraph)
  const [treeName, setTreeName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    setError('')
    if (!treeName.trim()) { setError('Please name your family tree.'); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const personId = uid()
      const treeId   = user ? await createTree(treeName.trim(), user.id).catch(() => uid()) : uid()

      const person: Person = {
        id:         personId,
        name:       params.name ?? '',
        nickname:   null,
        gender:     (params.gender as Gender) ?? 'M',
        birthday:   params.birthday || null,
        birthplace: null,
        deathDate:  null,
        photo:      null,
        location:   null,
        story:      null,
        treeId,
        deceased:   false,
      }

      initGraph(person, treeName.trim())

      // Best-effort Supabase save — not blocking
      saveMember(person).catch(() => undefined)

      router.replace('/(tabs)/')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>

          <StepDots />
          <Text style={s.heading}>Name your family tree</Text>
          <Text style={s.sub}>This is what your family will see when they join.</Text>

          <View style={s.field}>
            <Text style={s.label}>Tree name</Text>
            <TextInput
              style={s.input}
              value={treeName}
              onChangeText={setTreeName}
              placeholder="e.g. The Santos Family"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.btn, loading && s.btnDisabled, pressed && s.pressed]}
            onPress={create}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.cream} />
              : <Text style={s.btnText}>Create Tree</Text>}
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.divider} /><Text style={s.dividerText}>or</Text><View style={s.divider} />
          </View>

          <Pressable style={s.joinBtn} disabled>
            <Text style={s.joinText}>Join an existing tree</Text>
            <Text style={s.joinSub}>Invite codes — coming soon</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.cream },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  back:       { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  backText:   { ...Typography.body, color: Colors.textMid },
  heading:    { ...Typography.heading1, color: Colors.textDark, marginBottom: Spacing.xs },
  sub:        { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.xxl },
  field:      { marginBottom: Spacing.lg },
  label:      { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  input:      { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  error:      { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:        { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  btnDisabled:{ opacity: 0.6 },
  pressed:    { opacity: 0.85 },
  btnText:    { ...Typography.label, fontSize: 15, color: Colors.cream },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  divider:    { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:{ ...Typography.bodySmall, color: Colors.textMuted },
  joinBtn:    { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', opacity: 0.5 },
  joinText:   { ...Typography.label, color: Colors.textMid, marginBottom: 2 },
  joinSub:    { ...Typography.caption, color: Colors.textMuted },
})

const d = StyleSheet.create({
  dots:     { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xxl },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive:{ backgroundColor: Colors.amber },
})
