import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Gender } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { signOut, supabase } from '../../src/lib/supabase'
import { persist, saveMember, uploadPhoto, syncTreeToCloud } from '../../src/lib/db'
import {
  getNotificationPermissionStatus,
  scheduleAllBirthdayNotifications,
  cancelAllBirthdayNotifications,
} from '../../src/lib/notifications'
import { Avatar } from '../../src/components/Avatar'
import { DatePickerField, displayDate } from '../../src/components/DatePickerField'
import { Toast } from '../../src/components/Toast'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Man',        value: 'M'  },
  { label: 'Woman',      value: 'F'  },
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
  const [syncing,     setSyncing]     = useState(false)
  const [notifStatus, setNotifStatus] = useState<string | null>(null)
  const [toast,       setToast]       = useState(false)
  // "Back up tree to cloud" is an owner-only repair tool — for a claimed
  // member in someone else's tree the trees upsert is (correctly) blocked
  // by RLS, so don't offer the button at all.
  const [ownsTree,    setOwnsTree]    = useState(false)

  // Edit fields
  const [name,       setName]       = useState('')
  const [birthday,   setBirthday]   = useState('')
  const [birthplace, setBirthplace] = useState('')
  const [occupation, setOccupation] = useState('')
  const [gender,     setGender]     = useState<Gender>('M')
  const [location,   setLocation]   = useState('')
  const [story,      setStory]      = useState('')
  const [error,      setError]      = useState('')
  const [editPhoto,  setEditPhoto]  = useState<string | null>(null)

  useEffect(() => {
    if (!editing) getNotificationPermissionStatus().then(s => setNotifStatus(s))
  }, [editing])

  useEffect(() => {
    let cancelled = false
    const treeId = me?.treeId
    if (!treeId) { setOwnsTree(false); return }
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('trees').select('owner_id').eq('id', treeId).single(),
    ]).then(([{ data: auth }, { data: tree }]) => {
      if (!cancelled) setOwnsTree(!!auth.user && !!tree && tree.owner_id === auth.user.id)
    }).catch(() => { if (!cancelled) setOwnsTree(false) })
    return () => { cancelled = true }
  }, [me?.treeId])

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
    setBirthplace(me.birthplace ?? '')
    setOccupation((me as any).occupation ?? '')
    setGender(me.gender)
    setLocation(me.location ?? '')
    setStory(me.story ?? '')
    setEditPhoto(null)
    setError('')
    setEditing(true)
  }

  const cancel = () => { setEditing(false); setError('') }

  const save = async () => {
    setError('')
    if (!name.trim()) { setError('Name cannot be empty.'); return }
    if (!me || !currentUserId) return

    setSaving(true)

    let photoUrl = me.photo
    if (editPhoto) {
      const uploaded = await uploadPhoto(me.treeId, me.id, editPhoto)
      if (uploaded) {
        photoUrl = uploaded
      } else {
        Alert.alert('Photo upload failed', 'Your other changes were saved, but the photo could not be uploaded. Please check your connection and try again.')
      }
    }

    const updates = {
      name:       name.trim(),
      birthday:   birthday || null,
      birthplace: birthplace.trim() || null,
      occupation: occupation.trim() || null,
      gender,
      location:   location.trim() || null,
      story:      story.trim() || null,
      photo:      photoUrl,
    }

    updatePerson(currentUserId, updates)
    persist(() => saveMember({ ...me, ...updates } as any), 'Your profile')

    setSaving(false)
    setEditing(false)
    setToast(true)
  }

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setEditPhoto(result.assets[0].uri)
    }
  }

  const backUpTree = async () => {
    if (!graph || !currentUserId || syncing) return
    setSyncing(true)
    try {
      const res = await syncTreeToCloud(graph, treeName, currentUserId)
      Alert.alert(
        'Backup complete',
        `${res.members} member${res.members === 1 ? '' : 's'} and ${res.relationships} relationship${res.relationships === 1 ? '' : 's'} are safely in the cloud.`,
      )
    } catch (e) {
      const err = e as { message?: string } | null
      Alert.alert('Backup failed', err?.message ?? String(e))
    } finally {
      setSyncing(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  // ── Read mode ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <SafeAreaView style={s.safe}>
        <Toast visible={toast} message="Profile saved ✓" onHide={() => setToast(false)} />
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.heroSection}>
            <Avatar
              name={me?.name ?? '?'}
              photo={me?.photo}
              size={88}
              amber
              style={s.avatar}
            />
            <Text style={s.name}>{me?.name ?? 'Your profile'}</Text>
            {treeName && <Text style={s.treeBadge}>{treeName}</Text>}

            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && s.pressed]}
              onPress={startEditing}
            >
              <Text style={s.editBtnText}>Edit profile</Text>
            </Pressable>
          </View>

          {(me?.birthday || me?.birthplace || me?.gender || me?.location || (me as any)?.occupation) && (
            <View style={s.card}>
              {me.birthday              && <InfoRow label="Born"       value={displayDate(me.birthday)} />}
              {me.birthplace            && <InfoRow label="Birthplace" value={me.birthplace} />}
              {(me as any).occupation   && <InfoRow label="Occupation" value={(me as any).occupation} />}
              {me.gender                && <InfoRow label="Gender"     value={{ M: 'Man', F: 'Woman', NB: 'Non-binary' }[me.gender]} />}
              {me.location              && <InfoRow label="Location"   value={me.location} />}
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
              <View style={s.notifInfo}>
                <Text style={s.notifTitle}>Birthday reminders</Text>
                <Text style={s.notifSub}>7 days, 3 days, and on the day</Text>
              </View>
              <Switch
                value={notifStatus === 'granted'}
                onValueChange={toggleNotifications}
                trackColor={{ false: Colors.border, true: Colors.amber }}
                thumbColor={Colors.cream}
              />
            </View>
          </View>

          {ownsTree && (
            <Pressable
              style={({ pressed }) => [s.syncBtn, pressed && s.pressed]}
              onPress={backUpTree}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator color={Colors.amber} size="small" />
                : <Text style={s.syncText}>Back up tree to cloud</Text>}
            </Pressable>
          )}

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

          {/* Photo picker */}
          <Pressable style={s.avatarWrap} onPress={pickPhoto}>
            {editPhoto ? (
              <Image
                source={{ uri: editPhoto }}
                style={s.avatarImg}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Avatar name={me?.name ?? '?'} photo={me?.photo} size={72} amber style={s.avatarImg} />
            )}
            <View style={s.photoBadge}>
              <Text style={s.photoBadgeText}>Edit</Text>
            </View>
          </Pressable>

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
            <DatePickerField
              value={birthday || null}
              onChange={iso => setBirthday(iso ?? '')}
              maxDate={new Date()}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Birthplace <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={birthplace}
              onChangeText={setBirthplace}
              placeholder="e.g. Accra, Ghana"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Occupation <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="e.g. Teacher, Engineer"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
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
  avatar:         { marginBottom: Spacing.lg },
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

  // Notifications
  notifRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifInfo:      { flex: 1, marginRight: Spacing.md },
  notifTitle:     { ...Typography.label, color: Colors.textDark, marginBottom: 2 },
  notifSub:       { ...Typography.bodySmall, color: Colors.textMuted },

  // Edit mode
  editHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  cancelText:     { ...Typography.body, color: Colors.textMid },
  editTitle:      { ...Typography.nameTag, color: Colors.textDark },
  saveText:       { ...Typography.label, color: Colors.amber, fontSize: 15 },

  avatarWrap:     { alignSelf: 'center', marginBottom: Spacing.xxl, position: 'relative' },
  avatarImg:      { width: 72, height: 72, borderRadius: 36 },
  photoBadge:     { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.amber, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  photoBadgeText: { fontFamily: 'Inter-Medium', fontSize: 9, color: Colors.cream, letterSpacing: 0.4 },

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

  // Shared
  pressed:        { opacity: 0.7 },
  syncBtn:        { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  syncText:       { ...Typography.label, color: Colors.amber, fontSize: 15 },
  signOutBtn:     { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  signOutText:    { ...Typography.label, color: Colors.error, fontSize: 15 },
})
