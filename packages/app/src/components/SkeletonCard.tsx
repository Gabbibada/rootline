import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '../theme'

interface Props {
  /** Number of text-line placeholders inside the card. Default 2. */
  lines?: number
  /** Height of the card. Default 80. */
  height?: number
}

/**
 * Animated shimmer placeholder shown while data loads.
 * Drop-in replacement for a real card — same border-radius, same background.
 */
export function SkeletonCard({ lines = 2, height = 80 }: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9,  duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View style={[s.card, { opacity, minHeight: height }]}>
      <View style={s.avatarPlaceholder} />
      <View style={s.lines}>
        {Array.from({ length: lines }).map((_, i) => (
          <View key={i} style={[s.line, i === lines - 1 && s.lineShort]} />
        ))}
      </View>
    </Animated.View>
  )
}

/** Row of N skeleton cards for list-loading states. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  )
}

const s = StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                     backgroundColor: Colors.cream2, borderRadius: Radius.lg,
                     padding: Spacing.lg, marginBottom: Spacing.sm },
  avatarPlaceholder:{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.border, flexShrink: 0 },
  lines:           { flex: 1, gap: Spacing.xs },
  line:            { height: 12, backgroundColor: Colors.border, borderRadius: 6 },
  lineShort:       { width: '60%' },
})
