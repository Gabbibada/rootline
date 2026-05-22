import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { signUpWithEmail } from '../../src/lib/supabase'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

export default function SignUpScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error: err } = await signUpWithEmail(email.trim(), password)
    setLoading(false)

    if (err) { setError(err.message); return }
    router.replace({ pathname: '/onboarding/verify', params: { email: email.trim() } })
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>

          <Text style={s.heading}>Create account</Text>
          <Text style={s.sub}>Start building your family tree.</Text>

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

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirm password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
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
              : <Text style={s.btnText}>Create Account</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/onboarding/sign-in')}>
            <Text style={s.switchText}>Already have an account? <Text style={s.switchLink}>Sign in</Text></Text>
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
  back:       { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  backText:   { ...Typography.body, color: Colors.textMid },
  heading:    { ...Typography.heading1, color: Colors.textDark, marginBottom: Spacing.xs },
  sub:        { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.xxl },
  field:      { marginBottom: Spacing.lg },
  label:      { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  input:      { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  error:      { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },
  btn:        { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  btnDisabled:{ opacity: 0.6 },
  pressed:    { opacity: 0.85 },
  btnText:    { ...Typography.label, fontSize: 15, color: Colors.cream },
  switchText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  switchLink: { color: Colors.amber },
})
