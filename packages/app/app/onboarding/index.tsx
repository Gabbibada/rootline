import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Svg, { Circle, Line } from 'react-native-svg'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

function TreeMark() {
  const a = Colors.amber
  return (
    <Svg width={180} height={140} viewBox="0 0 180 140">
      <Line x1="90" y1="140" x2="90" y2="80" stroke={a} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="90" y1="110" x2="55" y2="78" stroke={a} strokeWidth={2} strokeLinecap="round" />
      <Line x1="90" y1="110" x2="125" y2="78" stroke={a} strokeWidth={2} strokeLinecap="round" />
      <Line x1="55" y1="78" x2="35" y2="46" stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="55" y1="78" x2="70" y2="46" stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="125" y1="78" x2="110" y2="46" stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="125" y1="78" x2="145" y2="46" stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="90" cy="80" r="5.5" fill={a} />
      <Circle cx="55" cy="78" r="4.5" fill={a} />
      <Circle cx="125" cy="78" r="4.5" fill={a} />
      <Circle cx="35" cy="46" r="4" fill={a} />
      <Circle cx="70" cy="46" r="4" fill={a} />
      <Circle cx="110" cy="46" r="4" fill={a} />
      <Circle cx="145" cy="46" r="4" fill={a} />
      <Circle cx="22" cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="48" cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="83" cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="132" cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Line x1="35" y1="46" x2="22" y2="18" stroke={a} strokeWidth={1} strokeLinecap="round" />
      <Line x1="35" y1="46" x2="48" y2="18" stroke={a} strokeWidth={1} strokeLinecap="round" />
      <Line x1="70" y1="46" x2="83" y2="18" stroke={a} strokeWidth={1} strokeLinecap="round" />
      <Line x1="145" y1="46" x2="132" y2="18" stroke={a} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  )
}

export default function WelcomeScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.container}>
      <View style={s.hero}>
        <TreeMark />
        <Text style={s.wordmark}>Rootline</Text>
        <Text style={s.tagline}>Every name. Every branch.{'\n'}Every story.</Text>
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
  hero:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxxl },
  wordmark:    { ...Typography.display, fontSize: 48, color: Colors.cream, marginTop: Spacing.xl, letterSpacing: 1 },
  tagline:     { ...Typography.body, color: Colors.sand, opacity: 0.75, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24 },
  actions:     { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  btnPrimary:  { height: 54, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed:     { opacity: 0.85 },
  btnText:     { ...Typography.label, fontSize: 15, color: Colors.cream },
  linkText:    { ...Typography.body, color: Colors.sand, textAlign: 'center', opacity: 0.8 },
})
