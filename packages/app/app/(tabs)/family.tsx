import { useState, useMemo } from 'react'
import { View, Text, FlatList, Pressable, TextInput, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFamilyStore } from '../../src/store/familyStore'
import { useAllRelationships } from '../../src/hooks/useRelationship'
import { AddMemberModal } from '../../src/components/AddMemberModal'
import { TreeMark } from '../../src/components/TreeMark'
import { Person } from '@rootline/engine'
import { Avatar } from '../../src/components/Avatar'
import { Colors, Typography, Spacing, Radius } from '../../src/theme'

interface RowData {
  person: Person
  label:  string
  isMe:   boolean
}

function MemberRow({ data, onPress }: { data: RowData; onPress: () => void }) {
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
  const [query, setQuery]               = useState('')
  const { graph, currentUserId }        = useFamilyStore()

  const sorted = useAllRelationships(graph ?? null, currentUserId ?? null)

  const rows = useMemo<RowData[]>(() => {
    if (!graph) return []

    const connectedIds = new Set(sorted.map(r => r.personId))
    const result: RowData[] = []

    // Current user first
    if (currentUserId && graph.people[currentUserId]) {
      result.push({ person: graph.people[currentUserId], label: 'You', isMe: true })
    }

    // Connected members sorted by distance
    for (const { personId, result: rel } of sorted) {
      const person = graph.people[personId]
      if (!person) continue
      result.push({
        person,
        label: rel.found ? rel.path.label : 'Unconnected',
        isMe:  false,
      })
    }

    // Disconnected members — append at end
    for (const person of Object.values(graph.people)) {
      if (person.id === currentUserId) continue
      if (connectedIds.has(person.id)) continue
      result.push({ person, label: 'Unconnected', isMe: false })
    }

    return result
  }, [graph, currentUserId, sorted])

  // Filter by search query (case-insensitive name match)
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.person.name.toLowerCase().includes(q))
  }, [rows, query])

  const hasMembers = rows.length > 1  // more than just "You"

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Family</Text>
        <Pressable
          style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

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
      />

      <AddMemberModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  title:          { ...Typography.heading1, color: Colors.textDark },
  addBtn:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: Colors.amber, borderRadius: Radius.full },
  addBtnText:     { ...Typography.label, color: Colors.cream, fontSize: 13 },

  // Search bar
  searchBar:      { marginHorizontal: Spacing.xl, marginBottom: Spacing.md },
  searchInput:    { height: 44, backgroundColor: Colors.cream2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingRight: Spacing.xxxl, ...Typography.body, color: Colors.textDark },
  clearBtn:       { position: 'absolute', right: Spacing.md, top: 12 },
  clearText:      { ...Typography.body, color: Colors.textMuted, fontSize: 14 },

  // List
  list:           { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  pressed:        { opacity: 0.7 },
  avatar:         { marginRight: Spacing.md },
  rowText:        { flex: 1 },
  name:           { ...Typography.nameTag, color: Colors.textDark },
  deceasedMark:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: Colors.textMuted },
  rel:            { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  relMe:          { color: Colors.amber },
  year:           { ...Typography.bodySmall, color: Colors.textMuted, marginRight: Spacing.sm },
  chevron:        { ...Typography.heading2, color: Colors.textMuted },
  sep:            { height: 1, backgroundColor: Colors.borderFaint },

  // Empty states
  empty:          { paddingTop: Spacing.xxxl, alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyTitle:     { ...Typography.nameTag, color: Colors.textDark, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptyBody:      { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
  emptyLink:      { color: Colors.amber },
  emptyHighlight: { color: Colors.textDark },
  emptyBtn:       { marginTop: Spacing.xl, height: 48, paddingHorizontal: Spacing.xxl, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  emptyBtnPressed:{ opacity: 0.8 },
  emptyBtnText:   { ...Typography.label, fontSize: 14, color: Colors.cream },
})
