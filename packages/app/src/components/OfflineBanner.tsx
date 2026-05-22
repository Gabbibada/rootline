import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Typography, Spacing } from '../theme'

/**
 * Slides in a thin amber banner at the top of the screen when the device
 * loses internet connectivity, and slides out when it reconnects.
 */
export function OfflineBanner() {
  const [offline, setOffline]   = useState(false)
  const slideY = useState(() => new Animated.Value(-40))[0]

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isOffline = !(state.isConnected && state.isInternetReachable !== false)
      setOffline(isOffline)
      Animated.spring(slideY, {
        toValue: isOffline ? 0 : -40,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start()
    })
    return unsub
  }, [])

  if (!offline) return null

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY: slideY }] }]}>
      <Text style={s.text}>No internet connection</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  banner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          9999,
    backgroundColor: Colors.bark,
    paddingVertical: Spacing.xs,
    alignItems:      'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.amber,
  },
  text: {
    ...Typography.mono,
    fontSize:      11,
    color:         Colors.amber,
    letterSpacing: 0.6,
  },
})
