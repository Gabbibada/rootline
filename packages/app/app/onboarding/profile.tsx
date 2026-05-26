import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Gender } from '@rootline/engine'
import { DatePickerField } from '../../src/components/DatePickerField'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Man',        value: 'M'  },
  { label: 'Woman',      value: 'F'  },
  { label: 'Non-binary', value: 'NB' },
]

function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <View style={d.dots}>
      <View style={[d.dot, d.dotActive]} />
      <View style={[d.dot, current === 2 && d.dotActive]} />
    </View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [gender, setGender] = useState<Gender>('M')
  const [error, setError] = useState('')

  const next = () => {
    setError('')
    if (!name.trim()) { setError('Please enter your name.'); return }
    router.push({ pathname: '/onboarding/tree', params: { name: name.trim(), birthday, gender } })
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <StepDots current={1} />
          <Text style={s.heading}>Tell us about you</Text>
          <Text style={s.sub}>You'll be the starting point of your family tree.</Text>

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
            <DatePickerField
              value={birthday || null}
              onChange={iso => setBirthday(iso ?? '')}
              maxDate={new Date()}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Gender</Text>
            <View style={s.genderRow}>
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

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
            onPress={next}
          >
            <Text style={s.btnText}>Continue</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  kav:            { flex: 1 },
  scroll:         { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  heading:        { ...Typography.heading1, color: Colors.textDark, marginBottom: Spacing.xs },
  sub:            { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.xxl },
  field:          { marginBottom: Spacing.lg },
  label:          { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  optional:       { ...Typography.label, color: Colors.textMuted, fontWeight: '400' },
  input:          { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  genderRow:      { flexDirection: 'row', gap: Spacing.sm },
  chip:           { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream2 },
  chipActive:     { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipText:       { ...Typography.label, color: Colors.textMid },
  chipTextActive: { color: Colors.cream },
  error:          { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:            { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  pressed:        { opacity: 0.85 },
  btnText:        { ...Typography.label, fontSize: 15, color: Colors.cream },
})

const d = StyleSheet.create({
  dots:    { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xl, marginBottom: Spacing.xxl },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.amber },
})
