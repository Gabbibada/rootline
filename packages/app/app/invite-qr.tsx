/**
 * QR Code Invite screen
 *
 * Shows a scannable QR code for the current family tree's deep link.
 * Anyone who scans it gets taken to the invite flow via the rootline:// scheme.
 * Also has a tap-to-share button for sending the link via any messenger.
 */
import { View, Text, Pressable, StyleSheet, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import { useFamilyStore } from '../src/store/familyStore'
import { buildInviteUrl } from '../src/lib/invite'
import { Colors, Typography, Spacing, Radius, Shadow } from '../src/theme'

export default function InviteQRScreen() {
  const router        = useRouter()
  const { graph, currentUserId, treeName } = useFamilyStore()
  const me            = currentUserId ? graph?.people[currentUserId] : null
  const treeId        = me?.treeId

  // Hosted invite page — opens in any browser/messenger, then hands off to
  // the app via intent:// (or shows a Google Play fallback).
  const inviteUrl     = treeId
    ? buildInviteUrl(treeId)
    : null

  const shareLink = async () => {
    if (!inviteUrl) return
    await Share.share({
      message: `Join my family on Rootline — scan the QR code or tap the link:\n${inviteUrl}`,
      url:     inviteUrl,
    })
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.back}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Invite to your tree</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.body}>
        {inviteUrl ? (
          <>
            <View style={s.qrCard}>
              <QRCode
                value={inviteUrl}
                size={220}
                color={Colors.bark}
                backgroundColor={Colors.cream}
              />
            </View>

            <Text style={s.treeLabel}>{treeName ?? 'Your family tree'}</Text>
            <Text style={s.sub}>
              Ask a family member to scan this code with their camera app.
              They'll be guided through creating an account and claiming their profile.
            </Text>

            <Pressable
              style={({ pressed }) => [s.shareBtn, pressed && s.pressed]}
              onPress={shareLink}
            >
              <Text style={s.shareBtnText}>Share link via…</Text>
            </Pressable>

            <View style={s.linkBox}>
              <Text style={s.linkText} numberOfLines={2} selectable>{inviteUrl}</Text>
            </View>
          </>
        ) : (
          <Text style={s.noTree}>Set up your family tree first.</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.cream },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  back:     { ...Typography.body, color: Colors.textMid, width: 60 },
  title:    { ...Typography.heading2, color: Colors.textDark },
  body:     { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl },

  qrCard:   { backgroundColor: Colors.cream, borderRadius: Radius.xl, padding: Spacing.xl,
              ...Shadow.strong, borderWidth: 1, borderColor: Colors.border,
              marginBottom: Spacing.xl },

  treeLabel:{ ...Typography.heading2, color: Colors.textDark, marginBottom: Spacing.sm,
              textAlign: 'center' },
  sub:      { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24,
              marginBottom: Spacing.xxl },

  shareBtn: { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md,
              alignItems: 'center', justifyContent: 'center',
              alignSelf: 'stretch', marginBottom: Spacing.lg },
  pressed:  { opacity: 0.8 },
  shareBtnText: { ...Typography.label, color: Colors.cream, fontSize: 15 },

  linkBox:  { backgroundColor: Colors.cream2, borderRadius: Radius.md, padding: Spacing.md,
              alignSelf: 'stretch', borderWidth: 1, borderColor: Colors.border },
  linkText: { ...Typography.mono, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.4 },

  noTree:   { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
})
