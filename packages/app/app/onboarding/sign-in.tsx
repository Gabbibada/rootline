import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { signInWithEmail } from '../../src/lib/supabase'
import { loadUserTree } from '../../src/lib/db'
import { loadPendingInvite } from '../../src/lib/invite'
import { useFamilyStore } from '../../src/store/familyStore'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

export default function SignInScreen() {
  const router = useRouter()
  const graph = useFamilyStore(s => s.graph)
  const loadGraph = useFamilyStore(s => s.loadGraph)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return }

    setLoading(true)
    try {
      const { data, error: err } = await signInWithEmail(email.trim(), password)
      if (err) { setError(err.message); return }

      const pending = await loadPendingInvite()
      if (pending) {
        router.replace({ pathname: '/invite', params: { treeId: pending.treeId, personId: pending.personId, name: pending.personName } } as any)
        return
      }

      const userId = data.user?.id
      if (userId) {
        const treeData = await loadUserTree(userId)
        if (treeData) {
          const personIds = Object.keys(treeData.graph.people)
          const currentUserId = personIds.length === 1 ? personIds[0] : null
          loadGraph(treeData.graph, treeData.treeName, currentUserId)
          router.replace('/(tabs)/')
          return
        }
      }

      router.replace(graph ? '/(tabs)/' : '/onboarding/profile')
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

          <Text style={s.heading}>Welcome back</Text>
          <Text style={s.sub}>Sign in to your family tree.</Text>

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
              placeholder="Your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
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
              : <Text style={s.btnText}>Sign In</Text>}
          </Pressable>

          <Pressable onPress={() => router.push('/onboarding/forgot-password')}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/onboarding/sign-up')}>
            <Text style={s.switchText}>Don't have an account? <Text style={s.switchLink}>Sign up</Text></Text>
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
  forgotText: { ...Typography.body, color: Colors.textMid, textAlign: 'center' },
  switchText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  switchLink: { color: Colors.amber },
})
