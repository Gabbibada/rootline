import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { TreeMark } from '../../src/components/TreeMark'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

const FEATURES: { mark: string; text: string }[] = [
  { mark: '⌀', text: 'Know every name at every reunion' },
  { mark: '⌀', text: 'See exactly how you\'re related to anyone' },
  { mark: '⌀', text: 'Never miss a birthday again' },
]

export default function WelcomeScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.container}>
      <View style={s.hero}>
        <TreeMark size={140} />
        <Text style={s.wordmark}>Rootline</Text>
        <Text style={s.tagline}>Every name. Every branch.{'\n'}Every story.</Text>

        {/* ── Feature bullets ── */}
        <View style={s.bullets}>
          {FEATURES.map(({ text }, i) => (
            <View key={i} style={s.bullet}>
              <View style={s.bulletDot} />
              <Text style={s.bulletText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable
          style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
          onPress={() => router.push('/onboarding/sign-up')}
        >
          <Text style={s.btnText}>Get Started</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/sign-in')}>
          <Text style={s.linkText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bark, justifyContent: 'space-between' },
  hero:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl },
  wordmark:    { ...Typography.display, fontSize: 48, color: Colors.cream, marginTop: Spacing.xl, letterSpacing: 1 },
  tagline:     { ...Typography.body, color: Colors.sand, opacity: 0.75, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24 },

  // Feature bullets
  bullets:     { marginTop: Spacing.xxl, gap: Spacing.md, alignSelf: 'stretch' },
  bullet:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bulletDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.amber, flexShrink: 0 },
  bulletText:  { ...Typography.body, color: Colors.sand, opacity: 0.8, flex: 1, lineHeight: 22 },

  // CTAs
  actions:     { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  btnPrimary:  { height: 54, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed:     { opacity: 0.85 },
  btnText:     { ...Typography.label, fontSize: 15, color: Colors.cream },
  linkText:    { ...Typography.body, color: Colors.sand, textAlign: 'center', opacity: 0.8 },
})
