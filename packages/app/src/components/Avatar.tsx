import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../theme'

interface AvatarProps {
  name:   string
  photo?: string | null
  size?:  number
  /** Use amber background (current-user variant) */
  amber?: boolean
  style?: object
}

/**
 * Shared avatar component. Shows a photo when available,
 * falls back to the person's initial letter on a bark background.
 */
export function Avatar({ name, photo, size = 44, amber = false, style }: AvatarProps) {
  const initial  = name.charAt(0).toUpperCase()
  const fontSize = Math.round(size * 0.38)
  const radius   = size / 2

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        contentFit="cover"
        transition={200}
      />
    )
  }

  return (
    <View
      style={[
        s.base,
        { width: size, height: size, borderRadius: radius, backgroundColor: amber ? Colors.amber : Colors.bark },
        style,
      ]}
    >
      <Text style={[s.initial, { fontSize }]}>{initial}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  base:    { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'Inter-Medium', color: Colors.sand },
})
