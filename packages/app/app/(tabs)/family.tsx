import { useState, useMemo } from 'react'
import {
  View, Text, FlatList, Pressable, TextInput,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFamilyStore } from '../../src/store/familyStore'
import { useAllRelationships } from '../../src/hooks/useRelationship'
import { AddMemberModal } from '../../src/components/AddMemberModal'
import { TreeMark } from '../../src/components/TreeMark'
import { saveMember } from '../../src/lib/db'
import { Person } from '@rootline/engine'
import { Avatar } from '../../src/components/Avatar'
import { Toast } from '../../src/components/Toast'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/theme'

interface RowData {
  person: Person
  label:  string
  isMe:   boolean
}

function MemberRow({ data, onPress }: { data: RowData; onPress: () => void }) {
  const first    = data.person.name.split(' ')[0]
  const nickname = data.person.nickname
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && s.pressed]} onPress={onPress}>
      <Avatar
        name={data.person.name}
        photo={data.person.photo}
        size={44}
        amber={data.isMe}
        style={s.avatar}
      />
      <View style={s.rowText}>
        <Text style={s.name}>
          {data.person.name}
          {data.person.deceased ? <Text style={s.deceasedMark}>  †</Text> : null}
        </Text>
        {nickname && (
          <Text style={s.nickname}>"{nickname}"</Text>
        )}
        <Text style={[s.rel, data.isMe && s.relMe]}>{data.label}</Text>
      </View>
      {data.person.birthday && (
        <Text style={s.year}>{data.person.birthday.slice(0, 4)}</Text>
      )}
      <Text style={s.chevron}>›</Text>
    </Pressable>
  )
}

export default function FamilyScreen() {
  const router = useRouter()
  const [modalVisible, setModalVisible] = useState(false)
  const [query,        setQuery]        = useState('')
  const [toast,        setToast]        = useState('')

  const { graph, currentUserId, addPerson, logActivity } = useFamilyStore()
  const sorted = useAllRelationships(graph ?? null, currentUserId ?? null)

  const rows = useMemo<RowData[]>(() => {
    if (!graph) return []
    const connectedIds = new Set(sorted.map(r => r.personId))
    const result: RowData[] = []

    if (currentUserId && graph.people[currentUserId]) {
      result.push({ person: graph.people[currentUserId] as unknown as Person, label: 'You', isMe: true })
    }

    for (const { personId, result: rel } of sorted) {
      const person = graph.people[personId]
      if (!person) continue
      result.push({ person: person as unknown as Person, label: rel.found ? rel.path.label : 'Unconnected', isMe: false })
    }

    for (const person of Object.values(graph.people)) {
      if (person.id === currentUserId) continue
      if (connectedIds.has(person.id)) continue
      result.push({ person: person as unknown as Person, label: 'Unconnected', isMe: false })
    }

    return result
  }, [graph, currentUserId, sorted])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.person.name.toLowerCase().includes(q))
  }, [rows, query])

  // Missing data: people with no birthday (excluding self)
  const missingBirthday = useMemo(() => {
    if (!graph) return 0
    return Object.values(graph.people).filter(
      p => p.id !== currentUserId && !p.birthday
    ).length
  }, [graph, currentUserId])

  const hasMembers = rows.length > 1

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Family</Text>
        <View style={s.headerRight}>
          <Pressable
            style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={s.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick-action rows */}
      {hasMembers && (
        <View style={s.quickActions}>
          <View style={s.quickRow}>
            <Pressable
              style={({ pressed }) => [s.quickBtn, pressed && s.pressed]}
              onPress={() => router.push('/relate')}
            >
              <Text style={s.quickBtnIcon}>↔</Text>
              <Text style={s.quickBtnText}>How are we related?</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.quickBtn, pressed && s.pressed]}
              onPress={() => router.push('/quiz')}
            >
              <Text style={s.quickBtnIcon}>🎯</Text>
              <Text style={s.quickBtnText}>Family quiz</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [s.quickBtn, s.quickBtnWide, pressed && s.pressed]}
            onPress={() => router.push('/timeline')}
          >
            <Text style={s.quickBtnIcon}>📜</Text>
            <Text style={s.quickBtnText}>Family timeline</Text>
          </Pressable>
        </View>
      )}

      {/* Missing birthday nudge */}
      {missingBirthday > 0 && (
        <View style={s.nudge}>
          <Text style={s.nudgeText}>
            🎂  {missingBirthday} member{missingBirthday > 1 ? 's are' : ' is'} missing a birthday — tap their name below to add it
          </Text>
        </View>
      )}

      {/* Search bar */}
      {hasMembers && (
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search members…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable style={s.clearBtn} onPress={() => setQuery('')} hitSlop={8}>
              <Text style={s.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Member list */}
      <FlatList
        data={filteredRows}
        keyExtractor={r => r.person.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <MemberRow
            data={item}
            onPress={() => router.push(`/member/${item.person.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            {query.trim() ? (
              <>
                <Text style={s.emptyTitle}>No results</Text>
                <Text style={s.emptyBody}>
                  No one named "<Text style={s.emptyHighlight}>{query.trim()}</Text>" in your tree.
                </Text>
              </>
            ) : (
              <>
                <TreeMark size={90} color={Colors.amber} />
                <Text style={s.emptyTitle}>Your family goes here</Text>
                <Text style={s.emptyBody}>
                  Start by adding a parent, sibling, or child.{'\n'}
                  Your tree builds itself from there.
                </Text>
                <Pressable
                  style={({ pressed }) => [s.emptyBtn, pressed && s.emptyBtnPressed]}
                  onPress={() => setModalVisible(true)}
                >
                  <Text style={s.emptyBtnText}>+ Add a family member</Text>
                </Pressable>
              </>
            )}
          </View>
        }
        ListFooterComponent={hasMembers ? (
          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [s.qrBtn, pressed && s.pressed]}
              onPress={() => router.push('/invite-qr')}
            >
              <Text style={s.qrBtnText}>Invite family to your tree</Text>
            </Pressable>
          </View>
        ) : null}
      />

      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
      <AddMemberModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={name => setToast(`${name} added to your tree ✓`)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title:          { ...Typography.heading1, color: Colors.textDark },
  headerRight:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  addBtn:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
                    backgroundColor: Colors.amber, borderRadius: Radius.full },
  addBtnText:     { ...Typography.label, color: Colors.cream, fontSize: 13 },

  // Quick actions
  quickActions:   { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md, gap: Spacing.sm },
  quickRow:       { flexDirection: 'row', gap: Spacing.sm },
  quickBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                    backgroundColor: Colors.cream2, borderRadius: Radius.lg,
                    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                    borderWidth: 1, borderColor: Colors.border },
  quickBtnWide:   { flex: 0 },   // overrides flex:1 so it sizes to content in full-width row
  quickBtnIcon:   { fontSize: 16 },
  quickBtnText:   { ...Typography.bodySmall, color: Colors.textMid, flex: 1 },

  // Missing data nudge
  nudge:          { marginHorizontal: Spacing.xl, marginBottom: Spacing.md,
                    backgroundColor: Colors.bark, borderRadius: Radius.md,
                    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  nudgeText:      { ...Typography.bodySmall, color: Colors.sand, lineHeight: 20 },

  // Search bar
  searchBar:      { marginHorizontal: Spacing.xl, marginBottom: Spacing.md },
  searchInput:    { height: 44, backgroundColor: Colors.cream2, borderWidth: 1,
                    borderColor: Colors.border, borderRadius: Radius.full,
                    paddingHorizontal: Spacing.lg, paddingRight: Spacing.xxxl,
                    ...Typography.body, color: Colors.textDark },
  clearBtn:       { position: 'absolute', right: Spacing.md, top: 12 },
  clearText:      { ...Typography.body, color: Colors.textMuted, fontSize: 14 },

  // List
  list:           { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  pressed:        { opacity: 0.7 },
  avatar:         { marginRight: Spacing.md },
  rowText:        { flex: 1 },
  name:           { ...Typography.nameTag, color: Colors.textDark },
  nickname:       { ...Typography.bodySmall, color: Colors.amber, marginTop: 1, fontStyle: 'italic' },
  deceasedMark:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: Colors.textMuted },
  rel:            { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  relMe:          { color: Colors.amber },
  year:           { ...Typography.bodySmall, color: Colors.textMuted, marginRight: Spacing.sm },
  chevron:        { fontSize: 18, color: Colors.textMuted, lineHeight: 24 },
  sep:            { height: 1, backgroundColor: Colors.borderFaint },

  // Footer
  footer:         { marginTop: Spacing.xxl },
  qrBtn:          { height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
                    alignItems: 'center', justifyContent: 'center' },
  qrBtnText:      { ...Typography.label, color: Colors.amber, fontSize: 13 },

  // Empty states
  empty:          { paddingTop: Spacing.xxxl, alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyTitle:     { ...Typography.nameTag, color: Colors.textDark, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptyBody:      { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
  emptyLink:      { color: Colors.amber },
  emptyHighlight: { color: Colors.textDark },
  emptyBtn:       { marginTop: Spacing.xl, height: 48, paddingHorizontal: Spacing.xxl,
                    backgroundColor: Colors.amber, borderRadius: Radius.md,
                    alignItems: 'center', justifyContent: 'center' },
  emptyBtnPressed:{ opacity: 0.8 },
  emptyBtnText:   { ...Typography.label, fontSize: 14, color: Colors.cream },
})
