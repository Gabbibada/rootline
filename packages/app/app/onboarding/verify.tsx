import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Svg, { Rect, Path } from 'react-native-svg'
import { supabase } from '../../src/lib/supabase'
import { loadPendingInvite } from '../../src/lib/invite'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

function EnvelopeIcon() {
  return (
    <Svg width={64} height={50} viewBox="0 0 64 50" fill="none">
      <Rect x="1" y="1" width="62" height="48" rx="6" stroke={Colors.amber} strokeWidth="2" />
      <Path d="M1 10L32 30L63 10" stroke={Colors.amber} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export default function VerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const afterAuth = async () => {
    const pending = await loadPendingInvite()
    if (pending) {
      router.replace({ pathname: '/invite', params: { treeId: pending.treeId, personId: pending.personId, name: pending.personName } } as any)
    } else {
      router.replace('/onboarding/profile')
    }
  }

  useEffect(() => {
    // If email confirmation is disabled in Supabase, the user is already signed in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) afterAuth()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') afterAuth()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    await supabase.auth.resend({ type: 'signup', email: email ?? '' })
    setResending(false)
    setResent(true)
    setCooldown(60)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <EnvelopeIcon />
        </View>
        <Text style={s.heading}>Check your inbox</Text>
        <Text style={s.body}>
          {'We sent a confirmation link to\n'}
          <Text style={s.emailHighlight}>{email}</Text>
        </Text>
        <Text style={s.hint}>Tap the link in the email to continue.</Text>
      </View>

      <View style={s.footer}>
        {resent && <Text style={s.resentNote}>Email resent!</Text>}
        <Pressable
          style={({ pressed }) => [s.resendBtn, (cooldown > 0 || resending) && s.resendDisabled, pressed && s.pressed]}
          onPress={resend}
          disabled={cooldown > 0 || resending}
        >
          {resending
            ? <ActivityIndicator color={Colors.amber} />
            : <Text style={s.resendText}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
              </Text>}
        </Pressable>
        <Pressable onPress={() => router.replace('/onboarding/sign-up')}>
          <Text style={s.backLink}>Wrong email? Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  content:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  iconWrap:       { marginBottom: Spacing.xxl },
  heading:        { ...Typography.heading1, color: Colors.textDark, textAlign: 'center', marginBottom: Spacing.lg },
  body:           { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.sm },
  emailHighlight: { ...Typography.body, color: Colors.textDark, fontWeight: '600' },
  hint:           { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },
  footer:         { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  resentNote:     { ...Typography.bodySmall, color: Colors.success, textAlign: 'center' },
  resendBtn:      { height: 52, borderWidth: 1.5, borderColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  resendDisabled: { opacity: 0.45 },
  pressed:        { opacity: 0.85 },
  resendText:     { ...Typography.label, fontSize: 15, color: Colors.amber },
  backLink:       { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
})
