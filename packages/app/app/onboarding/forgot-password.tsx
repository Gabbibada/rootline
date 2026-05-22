import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
    setLoading(false)

    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.sentContainer}>
          <Text style={s.heading}>Check your inbox</Text>
          <Text style={s.sentBody}>
            {'We sent password reset instructions to\n'}
            <Text style={s.emailHighlight}>{email}</Text>
          </Text>
          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
            onPress={() => router.replace('/onboarding/sign-in')}
          >
            <Text style={s.btnText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>

          <Text style={s.heading}>Reset password</Text>
          <Text style={s.sub}>Enter your email and we'll send you a reset link.</Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.btn, loading && s.btnDisabled, pressed && s.pressed]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.cream} />
              : <Text style={s.btnText}>Send reset link</Text>}
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
  back:           { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  backText:       { ...Typography.body, color: Colors.textMid },
  heading:        { ...Typography.heading1, color: Colors.textDark, marginBottom: Spacing.xs },
  sub:            { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.xxl },
  field:          { marginBottom: Spacing.lg },
  label:          { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  input:          { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  error:          { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:            { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  btnDisabled:    { opacity: 0.6 },
  pressed:        { opacity: 0.85 },
  btnText:        { ...Typography.label, fontSize: 15, color: Colors.cream },
  sentContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  sentBody:       { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xxl },
  emailHighlight: { ...Typography.body, color: Colors.textDark, fontWeight: '600' },
})
