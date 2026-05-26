/**
 * Toast — lightweight success / info banner.
 *
 * Slides up from the bottom, stays 2.2 s, then fades out.
 * Usage:
 *   const [toast, setToast] = useState(false)
 *   <Toast visible={toast} message="Saved!" onHide={() => setToast(false)} />
 */
import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'

interface ToastProps {
  message: string
  visible: boolean
  onHide:  () => void
}

export function Toast({ message, visible, onHide }: ToastProps) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(16)).current

  useEffect(() => {
    if (!visible) return

    // Reset first (in case re-triggered before previous finished)
    opacity.setValue(0)
    translateY.setValue(16)

    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 260, useNativeDriver: true }),
      ]).start(() => onHide())
    }, 2200)

    return () => clearTimeout(timer)
  }, [visible])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <Animated.View
      style={[s.toast, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position:        'absolute',
    bottom:          Spacing.xxl,
    alignSelf:       'center',
    backgroundColor: Colors.bark,
    borderRadius:    Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical:   Spacing.sm,
    // Subtle shadow so it lifts above content
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius:  6,
    elevation:     6,
  },
  text: {
    ...Typography.label,
    color:     Colors.sand,
    fontSize:  13,
    textAlign: 'center',
  },
})
