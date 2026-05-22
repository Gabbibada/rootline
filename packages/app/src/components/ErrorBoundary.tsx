import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'

interface State { hasError: boolean; message: string }

interface Props {
  children: React.ReactNode
  /** Optional override label shown above the error message. */
  label?: string
}

/**
 * Catches JS errors anywhere in the subtree and shows a recovery screen
 * instead of crashing the whole app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? 'Unknown error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <View style={s.container}>
        <Text style={s.icon}>⚠</Text>
        <Text style={s.title}>{this.props.label ?? 'Something went wrong'}</Text>
        <Text style={s.body} numberOfLines={4}>{this.state.message}</Text>
        <Pressable
          style={({ pressed }) => [s.btn, pressed && s.pressed]}
          onPress={this.reset}
        >
          <Text style={s.btnText}>Try again</Text>
        </Pressable>
      </View>
    )
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center',
               backgroundColor: Colors.cream, padding: Spacing.xl },
  icon:      { fontSize: 40, marginBottom: Spacing.lg },
  title:     { ...Typography.heading2, color: Colors.textDark, textAlign: 'center',
               marginBottom: Spacing.sm },
  body:      { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center',
               lineHeight: 20, marginBottom: Spacing.xxl },
  btn:       { height: 48, paddingHorizontal: Spacing.xxl, backgroundColor: Colors.amber,
               borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed:   { opacity: 0.8 },
  btnText:   { ...Typography.label, color: Colors.cream, fontSize: 14 },
})
