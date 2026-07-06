import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Share, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Gender, Direction, RelationshipPath, Person } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { useRelationship } from '../../src/hooks/useRelationship'
import { persist, saveMember, deleteMember, uploadPhoto } from '../../src/lib/db'
import { buildInviteUrl } from '../../src/lib/invite'
import { AddMemberModal } from '../../src/components/AddMemberModal'
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

function stepLabel(dir: Direction): string {
  if (dir === 'up')    return 'parent'
  if (dir === 'down')  return 'child'
  return 'spouse'
}

function PathExplainer({ path, people }: { path: RelationshipPath; people: Record<string, Person> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.pathScroll}
    >
      {path.personIds.map((pid, idx) => {
        const person  = people[pid]
        const initial = person?.name.charAt(0).toUpperCase() ?? '?'
        const name    = idx === 0 ? 'You' : (person?.name.split(' ')[0] ?? '?')
        const isFirst = idx === 0
        const isLast  = idx === path.personIds.length - 1
        const step    = path.steps[idx]

        return (
          <View key={pid} style={s.pathItem}>
            <View style={s.pathNode}>
              <View style={[s.pathAvatar, isFirst && s.pathAvatarYou, isLast && s.pathAvatarTarget]}>
                <Text style={s.pathInitial}>{initial}</Text>
              </View>
              <Text style={s.pathName} numberOfLines={1}>{name}</Text>
            </View>
            {step && (
              <View style={s.pathConnector}>
                <Text style={s.pathConnLabel}>{stepLabel(step.direction)}</Text>
                <Text style={s.pathConnArrow}>›</Text>
              </View>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

export default function MemberScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const { graph, currentUserId, updatePerson, removePerson, logActivity } = useFamilyStore()
  const member  = id ? graph?.people[id] : null
  const rel     = useRelationship(graph ?? null, currentUserId ?? null, id ?? null)
  const isMe    = id === currentUserId

  const [editing,     setEditing]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [addVisible,  setAddVisible]  = useState(false)
  const [toast,       setToast]       = useState(false)

  // Edit fields
  const [name,       setName]       = useState('')
  const [nickname,   setNickname]   = useState('')
  const [birthday,   setBirthday]   = useState('')
  const [birthplace, setBirthplace] = useState('')
  const [deathDate,  setDeathDate]  = useState('')
  const [gender,     setGender]     = useState<Gender>('M')
  const [location,   setLocation]   = useState('')
  const [occupation, setOccupation] = useState('')
  const [story,      setStory]      = useState('')
  const [error,      setError]      = useState('')
  const [deceased,   setDeceased]   = useState(false)
  const [editPhoto,  setEditPhoto]  = useState<string | null>(null)   // local URI during edit

  if (!member) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.notFound}>Member not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const relationLabel = rel?.found ? rel.path.label : null
  const initial       = member.name.charAt(0).toUpperCase()

  const startEditing = () => {
    setName(member.name)
    setNickname(member.nickname ?? '')
    setBirthday(member.birthday ?? '')
    setBirthplace(member.birthplace ?? '')
    setDeathDate(member.deathDate ?? '')
    setGender(member.gender)
    setLocation(member.location ?? '')
    setOccupation((member as any).occupation ?? '')
    setStory(member.story ?? '')
    setDeceased(member.deceased)
    setEditPhoto(null)
    setError('')
    setEditing(true)
  }

  const cancel = () => { setEditing(false); setError('') }

  const save = async () => {
    setError('')
    if (!name.trim()) { setError('Name cannot be empty.'); return }
    setSaving(true)

    // Upload new photo if the user picked one, otherwise keep existing
    let photoUrl = member.photo
    if (editPhoto) {
      const uploaded = await uploadPhoto(member.treeId, member.id, editPhoto)
      if (uploaded) {
        photoUrl = uploaded
      } else {
        Alert.alert('Photo upload failed', 'Your other changes were saved, but the photo could not be uploaded. Please check your connection and try again.')
      }
    }

    const updates = {
      name:       name.trim(),
      nickname:   nickname.trim() || null,
      birthday:   birthday || null,
      birthplace: birthplace.trim() || null,
      deathDate:  deathDate.trim() || null,
      gender,
      location:   location.trim() || null,
      occupation: occupation.trim() || null,
      story:      story.trim() || null,
      deceased,
      photo:      photoUrl,
    }
    updatePerson(id!, updates)
    persist(() => saveMember({ ...member, ...updates }), name.trim())
    logActivity('updated', { id: id!, name: name.trim() })
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

  const shareInvite = () => {
    const url = buildInviteUrl(member.treeId, member.id, member.name)
    Share.share({ message: `Join my family tree on Rootline: ${url}` })
  }

  const confirmDelete = () => {
    Alert.alert(
      'Remove member',
      `Remove ${member.name} from your tree? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removePerson(id!)
            persist(() => deleteMember(id!), `Removing ${member.name}`)
            router.back()
          },
        },
      ],
    )
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.editHeader}>
              <Pressable onPress={cancel} hitSlop={8}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={s.editTitle}>Edit member</Text>
              <Pressable onPress={save} disabled={saving} hitSlop={8}>
                {saving
                  ? <ActivityIndicator color={Colors.amber} size="small" />
                  : <Text style={s.saveText}>Save</Text>}
              </Pressable>
            </View>

            <Pressable style={s.avatarSmallWrap} onPress={pickPhoto}>
              {editPhoto ? (
                <Image
                  source={{ uri: editPhoto }}
                  style={s.avatarSmallImg}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Avatar name={member.name} photo={member.photo} size={64} style={s.avatarSmallImg} />
              )}
              <View style={s.photoEditBadge}>
                <Text style={s.photoEditText}>Edit</Text>
              </View>
            </Pressable>

            <View style={s.field}>
              <Text style={s.label}>Full name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Nickname <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={s.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="e.g. Nan, Big Dave"
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
              <Text style={s.label}>Story <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={s.textarea}
                value={story}
                onChangeText={setStory}
                placeholder="A few words about this person…"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.label}>Deceased</Text>
                <Text style={s.toggleHint}>Shows a † symbol on their profile</Text>
              </View>
              <Switch
                value={deceased}
                onValueChange={setDeceased}
                trackColor={{ false: Colors.border, true: Colors.amber }}
                thumbColor={Colors.cream}
              />
            </View>

            {deceased && (
              <View style={s.field}>
                <Text style={s.label}>Date of death <Text style={s.optional}>(optional)</Text></Text>
                <DatePickerField
                  value={deathDate || null}
                  onChange={iso => setDeathDate(iso ?? '')}
                  maxDate={new Date()}
                />
              </View>
            )}

            {!!error && <Text style={s.error}>{error}</Text>}

            {!isMe && (
              <Pressable
                style={({ pressed }) => [s.deleteBtn, pressed && s.pressed]}
                onPress={confirmDelete}
              >
                <Text style={s.deleteText}>Remove from tree</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── Read mode ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <Toast visible={toast} message="Changes saved ✓" onHide={() => setToast(false)} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.readHeader}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Pressable onPress={startEditing} hitSlop={8}>
            <Text style={s.editLink}>Edit</Text>
          </Pressable>
        </View>

        <View style={s.hero}>
          <Avatar name={member.name} photo={member.photo} size={88} style={s.avatar} amber={isMe} />
          <Text style={s.name}>{member.name}</Text>
          {member.nickname && <Text style={s.nickname}>"{member.nickname}"</Text>}
          {relationLabel && <Text style={s.relation}>{relationLabel}</Text>}
          {member.deceased && <Text style={s.deceasedTag}>† Deceased</Text>}
        </View>

        {rel?.found && rel.path.distance > 0 && graph && (
          <View style={s.card}>
            <Text style={s.pathSectionLabel}>How you're connected</Text>
            <PathExplainer path={rel.path} people={graph.people} />
          </View>
        )}

        {(member.birthday || member.birthplace || member.deathDate || member.gender || member.location || (member as any).occupation) && (
          <View style={s.card}>
            {member.birthday && (
              <InfoRow label="Born" value={displayDate(member.birthday)} />
            )}
            {member.birthplace && (
              <InfoRow label="Birthplace" value={member.birthplace} />
            )}
            {member.deathDate && (
              <InfoRow label="Died" value={displayDate(member.deathDate)} />
            )}
            {member.gender && (
              <InfoRow label="Gender" value={{ M: 'Man', F: 'Woman', NB: 'Non-binary' }[member.gender]} />
            )}
            {member.location && (
              <InfoRow label="Location" value={member.location} />
            )}
            {(member as any).occupation && (
              <InfoRow label="Occupation" value={(member as any).occupation} />
            )}
          </View>
        )}

        {member.story && (
          <View style={s.card}>
            <Text style={s.storyLabel}>Story</Text>
            <Text style={s.story}>{member.story}</Text>
          </View>
        )}

        {!isMe && (
          <>
            <Pressable
              style={({ pressed }) => [s.addRelBtn, pressed && s.pressed]}
              onPress={() => setAddVisible(true)}
            >
              <Text style={s.addRelText}>+ Add {member.name.split(' ')[0]}'s relative</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.inviteBtn, pressed && s.pressed]}
              onPress={shareInvite}
            >
              <Text style={s.inviteText}>Invite {member.name.split(' ')[0]} to join</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <AddMemberModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSuccess={name => setToast(`${name} added ✓`)}
        pivotId={id}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.cream },
  kav:          { flex: 1 },
  scroll:       { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:     { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.md },

  // Read mode header
  readHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg, marginBottom: Spacing.xl },
  backText:     { ...Typography.body, color: Colors.textMid },
  editLink:     { ...Typography.label, color: Colors.amber, fontSize: 15 },

  // Hero
  hero:         { alignItems: 'center', paddingBottom: Spacing.xxl },
  avatar:       { marginBottom: Spacing.lg },
  avatarText:   { ...Typography.display, color: Colors.sand, fontSize: 36 },
  name:         { ...Typography.heading1, color: Colors.textDark, textAlign: 'center' },
  nickname:     { ...Typography.body, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  relation:     { ...Typography.body, color: Colors.amber, marginTop: Spacing.xs },

  // Info card
  card:         { backgroundColor: Colors.cream2, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  infoLabel:    { ...Typography.label, color: Colors.textMuted },
  infoValue:    { ...Typography.body, color: Colors.textDark },
  storyLabel:   { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.sm },
  story:        { ...Typography.body, color: Colors.textDark, lineHeight: 24 },

  // Path explainer
  pathSectionLabel: { ...Typography.label, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  pathScroll:    { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  pathItem:      { flexDirection: 'row', alignItems: 'center' },
  pathNode:      { alignItems: 'center', width: 56 },
  pathAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bark2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pathAvatarYou: { backgroundColor: Colors.amber },
  pathAvatarTarget: { backgroundColor: Colors.bark },
  pathInitial:   { fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.sand },
  pathName:      { ...Typography.mono, color: Colors.textMuted, fontSize: 9, textAlign: 'center' },
  pathConnector: { alignItems: 'center', paddingHorizontal: Spacing.xs },
  pathConnLabel: { ...Typography.mono, color: Colors.textMuted, fontSize: 8, letterSpacing: 0.4 },
  pathConnArrow: { fontSize: 18, color: Colors.textMuted, lineHeight: 22 },

  // Add relative button
  addRelBtn:    { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  addRelText:   { ...Typography.label, color: Colors.amber, fontSize: 15 },
  inviteBtn:    { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  inviteText:   { ...Typography.label, color: Colors.textMid, fontSize: 15 },

  // Edit mode header
  editHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  cancelText:   { ...Typography.body, color: Colors.textMid },
  editTitle:    { ...Typography.nameTag, color: Colors.textDark },
  saveText:     { ...Typography.label, color: Colors.amber, fontSize: 15 },
  avatarSmallWrap:  { alignSelf: 'center', marginBottom: Spacing.xxl, position: 'relative' },
  avatarSmallImg:   { width: 64, height: 64, borderRadius: 32 },
  photoEditBadge:   { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.amber, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  photoEditText:    { fontFamily: 'Inter-Medium', fontSize: 9, color: Colors.cream, letterSpacing: 0.4 },

  // Edit fields
  field:        { marginBottom: Spacing.lg },
  label:        { ...Typography.label, color: Colors.textMid, marginBottom: Spacing.xs },
  optional:     { ...Typography.label, color: Colors.textMuted, fontWeight: '400' },
  input:        { height: 52, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, ...Typography.body, color: Colors.textDark },
  textarea:     { minHeight: 100, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, ...Typography.body, color: Colors.textDark },
  chipRow:      { flexDirection: 'row', gap: Spacing.sm },
  chip:         { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream2 },
  chipActive:   { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipText:     { ...Typography.label, color: Colors.textMid },
  chipTextActive:{ color: Colors.cream },
  error:        { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.md },

  // Deceased
  deceasedTag:  { ...Typography.mono, fontSize: 11, color: Colors.textMuted, marginTop: Spacing.xs, letterSpacing: 1 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg, paddingVertical: Spacing.xs },
  toggleInfo:   { flex: 1, marginRight: Spacing.md },
  toggleHint:   { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  // Delete / shared
  deleteBtn:    { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  deleteText:   { ...Typography.label, color: Colors.error, fontSize: 15 },
  pressed:      { opacity: 0.7 },
})
