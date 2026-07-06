import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getSession } from '../src/lib/supabase'
import { loadTreeById, claimMember, persist } from '../src/lib/db'
import { savePendingInvite, clearPendingInvite } from '../src/lib/invite'
import { useFamilyStore } from '../src/store/familyStore'
import { Colors, Typography, Spacing, Radius } from '../src/theme'

export default function InviteScreen() {
  const router     = useRouter()
  const loadGraph  = useFamilyStore(s => s.loadGraph)
  const { treeId, personId, name } = useLocalSearchParams<{
    treeId: string; personId: string; name: string
  }>()

  const personName = name ?? 'Your profile'
  const initial    = personName.charAt(0).toUpperCase()

  const [authed,   setAuthed]   = useState<boolean | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!treeId || !personId) return
    savePendingInvite({ treeId, personId, personName })
    getSession().then(({ data }) => setAuthed(!!data.session))
  // params are stable after mount — intentional single-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, personId])

  const claim = async () => {
    setError('')
    setClaiming(true)
    try {
      const { data } = await getSession()
      if (!data.session) { setError('Please sign in first.'); setClaiming(false); return }

      const treeData = await loadTreeById(treeId!)
      if (!treeData) { setError('Could not load this family tree.'); setClaiming(false); return }

      loadGraph(treeData.graph, treeData.treeName, personId!)
      persist(() => claimMember(personId!, data.session.user.id), 'Your profile claim')
      await clearPendingInvite()
      router.replace('/(tabs)/')
    } catch {
      setError('Something went wrong. Please try again.')
      setClaiming(false)
    }
  }

  if (authed === null) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.amber} style={s.loader} />
      </SafeAreaView>
    )
  }

  // ── Not signed in — landing page ──────────────────────────────────────────
  if (!authed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <View style={s.avatarLg}>
            <Text style={s.avatarLgText}>{initial}</Text>
          </View>
          <Text style={s.heading}>You've been invited</Text>
          <Text style={s.claimAs}>Claim your profile as</Text>
          <Text style={s.personName}>{personName}</Text>
          <Text style={s.body}>
            Create an account to join your family tree and see how everyone is connected.
          </Text>
        </View>

        <View style={s.footer}>
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
            onPress={() => router.push('/onboarding/sign-up')}
          >
            <Text style={s.btnText}>Create account</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.outlineBtn, pressed && s.pressed]}
            onPress={() => router.push('/onboarding/sign-in')}
          >
            <Text style={s.outlineBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ── Signed in — claim page ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <View style={s.avatarLg}>
          <Text style={s.avatarLgText}>{initial}</Text>
        </View>
        <Text style={s.heading}>Is this you?</Text>
        <Text style={s.personName}>{personName}</Text>
        <Text style={s.body}>
          Claim this profile to link your account and explore your full family tree.
        </Text>
      </View>

      <View style={s.footer}>
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable
          style={({ pressed }) => [s.btn, claiming && s.btnDisabled, pressed && s.pressed]}
          onPress={claim}
          disabled={claiming}
        >
          {claiming
            ? <ActivityIndicator color={Colors.cream} />
            : <Text style={s.btnText}>Claim profile</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.outlineBtn, pressed && s.pressed]}
          onPress={() => router.back()}
        >
          <Text style={s.outlineBtnText}>Not me — go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bark },
  loader:         { flex: 1 },
  content:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  avatarLg:       { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.bark2, borderWidth: 2, borderColor: Colors.amber, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl },
  avatarLgText:   { ...Typography.display, color: Colors.sand },
  heading:        { ...Typography.heading1, color: Colors.cream, textAlign: 'center', marginBottom: Spacing.sm },
  claimAs:        { ...Typography.body, color: Colors.sand, textAlign: 'center' },
  personName:     { ...Typography.heading2, color: Colors.amber, textAlign: 'center', marginBottom: Spacing.lg },
  body:           { ...Typography.body, color: Colors.sand, textAlign: 'center', lineHeight: 24, opacity: 0.8 },
  footer:         { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  error:          { ...Typography.bodySmall, color: Colors.error, textAlign: 'center' },
  btn:            { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:    { opacity: 0.6 },
  pressed:        { opacity: 0.85 },
  btnText:        { ...Typography.label, fontSize: 15, color: Colors.cream },
  outlineBtn:     { height: 52, borderWidth: 1, borderColor: Colors.bark3, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { ...Typography.label, fontSize: 15, color: Colors.sand },
})
