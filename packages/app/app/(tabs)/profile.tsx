import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Gender } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { signOut } from '../../src/lib/supabase'
import { saveMember } from '../../src/lib/db'
import {
  getNotificationPermissionStatus,
  scheduleAllBirthdayNotifications,
  cancelAllBirthdayNotifications,
} from '../../src/lib/notifications'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Man',        value: 'M'  },
  { label: 'Woman',      value: 'F'  },
  { label: 'Non-binary', value: 'NB' },
]

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { graph, currentUserId, treeName, updatePerson } = useFamilyStore()
  const me = currentUserId ? graph?.people[currentUserId] : null

  const [editing,     setEditing]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [notifStatus, setNotifStatus] = useState<string | null>(null)

  // Editable field state — initialised from me when edit mode opens
  const [name,     setName]     = useState('')
  const [birthday, setBirthday] = useState('')
  const [gender,   setGender]   = useState<Gender>('M')
  const [location, setLocation] = useState('')
  const [story,    setStory]    = useState('')
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!editing) getNotificationPermissionStatus().then(s => setNotifStatus(s))
  }, [editing])

  const toggleNotifications = async () => {
    if (!graph || !currentUserId) return
    if (notifStatus === 'granted') {
      await cancelAllBirthdayNotifications()
      setNotifStatus('denied')
    } else {
      await scheduleAllBirthdayNotifications(graph, currentUserId)
      const s = await getNotificationPermissionStatus()
      setNotifStatus(s)
    }
  }

  const startEditing = () => {
    if (!me) return
    setName(me.name)
    setBirthday(me.birthday ?? '')
    setGender(me.gender)
    setLocation(me.location ?? '')
    setStory(me.story ?? '')
    setError('')
    setEditing(true)
  }

  const cancel = () => { setEditing(false); setError('') }

  const save = async () => {
    setError('')
    if (!name.trim()) { setError('Name cannot be empty.'); return }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError('Birthday format: YYYY-MM-DD'); return
    }
    if (!me || !currentUserId) return

    setSaving(true)
    const updates = {
      name:     name.trim(),
      birthday: birthday || null,
      gender,
      location: location.trim() || null,
      story:    story.trim() || null,
    }

    updatePerson(currentUserId, updates)

    // Best-effort Supabase save
    saveMember({ ...me, ...updates }).catch(() => undefined)

    setSaving(false)
    setEditing(false)
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const initial = me?.name.charAt(0).toUpperCase() ?? '?'

  // ── Read mode ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.heroSection}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <Text style={s.name}>{me?.name ?? 'Your profile'}</Text>
            {treeName && <Text style={s.treeBadge}>{treeName}</Text>}

            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && s.pressed]}
              onPress={startEditing}
            >
              <Text style={s.editBtnText}>Edit profile</Text>
            </Pressable>
          </View>

          {(me?.birthday || me?.gender || me?.location) && (
            <View style={s.card}>
              {me.birthday  && <InfoRow label="Birthday" value={me.birthday} />}
              {me.gender    && <InfoRow label="Gender"   value={{ M: 'Man', F: 'Woman', NB: 'Non-binary' }[me.gender]} />}
              {me.location  && <InfoRow label="Location" value={me.location} />}
            </View>
          )}

          {me?.story && (
            <View style={s.card}>
              <Text style={s.storyLabel}>Story</Text>
              <Text style={s.storyText}>{me.story}</Text>
            </View>
          )}

          <View style={s.card}>
            <View style={s.notifRow}>
              <View>
                <Text style={s.notifTitle}>Birthday reminders</Text>
                <Text style={s.notifSub}>Notified 7, 3, and 0 days before</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  s.notifBadge,
                  notifStatus === 'granted' ? s.notifBadgeOn : s.notifBadgeOff,
                  pressed && s.pressed,
                ]}
                onPress={toggleNotifications}
              >
                <Text style={[s.notifBadgeText, notifStatus === 'granted' && s.notifBadgeTextOn]}>
                  {notifStatus === 'granted' ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [s.signOutBtn, pressed && s.pressed]}
            onPress={handleSignOut}
          >
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.editHeader}>
            <Pressable onPress={cancel} hitSlop={8}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={s.editTitle}>Edit profile</Text>
            <Pressable onPress={save} disabled={saving} hitSlop={8}>
              {saving
                ? <ActivityIndicator color={Colors.amber} size="small" />
                : <Text style={s.saveText}>Save</Text>}
            </Pressable>
          </View>

          <View style={s.avatarSmall}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Birthday <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={birthday}
              onChangeText={setBirthday}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Gender</Text>
            <View style={s.chipRow}>
              {GENDERS.map(g => (
                <Pressable
                  key={g.value}
                  style={[s.chip, gender === g.value && s.chipActive]}
                  onPress={() => setGender(g.value)}
                >
                  <Text style={[s.chipText, gender === g.value && s.chipTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Location <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Lagos, Nigeria"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Story <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.textarea}
              value={story}
              onChangeText={setStory}
              placeholder="A few words about yourself…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.signOutBtn, pressed && s.pressed]}
            onPress={handleSignOut}
          >
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  kav:            { flex: 1 },
  scroll:         { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

  // Read mode — hero
  heroSection:    { alignItems: 'center', paddingTop: Spacing.xxxl, paddingBottom: Spacing.xxl },
  avatar:         { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.bark, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  avatarText:     { ...Typography.display, color: Colors.sand, fontSize: 36 },
  name:           { ...Typography.heading1, color: Colors.textDark, textAlign: 'center' },
  treeBadge:      { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.xs },
  editBtn:        { marginTop: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full },
  editBtnText:    { ...Typography.label, color: Colors.textMid, fontSize: 13 },

  // Info card
  card:           { backgroundColor: Colors.cream2, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  infoLabel:      { ...Typography.label, color: Colors.textMuted },
  infoValue:      { ...Typography.body, color: Colors.textDark },
  storyLabel:     { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.sm },
  storyText:      { ...Typography.body, color: Colors.textDark, lineHeight: 24 },

  // Edit mode
  editHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  cancelText:     { ...Typography.body, color: Colors.textMid },
  editTitle:      { ...Typography.nameTag, color: Colors.textDark },
  saveText:       { ...Typography.label, color: Colors.amber, fontSize: 15 },
  avatarSmall:    { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bark, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.xxl },
  field:          { marginBottom: Spacing.lg },
  label:          { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  optional:       { ...Typography.label, color: Colors.textMuted, fontWeight: '400' },
  input:          { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  textarea:       { minHeight: 100, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, ...Typography.body, color: Colors.textDark },
  chipRow:        { flexDirection: 'row', gap: Spacing.sm },
  chip:           { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream2 },
  chipActive:     { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipText:       { ...Typography.label, color: Colors.textMid },
  chipTextActive: { color: Colors.cream },
  error:          { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },

  // Notifications card
  notifRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle:         { ...Typography.label, color: Colors.textDark, marginBottom: 2 },
  notifSub:           { ...Typography.bodySmall, color: Colors.textMuted },
  notifBadge:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  notifBadgeOn:       { backgroundColor: Colors.amber, borderColor: Colors.amber },
  notifBadgeOff:      { backgroundColor: Colors.cream2 },
  notifBadgeText:     { ...Typography.label, color: Colors.textMid, fontSize: 12 },
  notifBadgeTextOn:   { color: Colors.cream },

  // Shared
  pressed:        { opacity: 0.7 },
  signOutBtn:     { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  signOutText:    { ...Typography.label, color: Colors.error, fontSize: 15 },
})
