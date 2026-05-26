import { useState, useMemo } from 'react'
import {
  View, Text, FlatList, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useFamilyStore } from '../../src/store/familyStore'
import { useAllRelationships } from '../../src/hooks/useRelationship'
import { AddMemberModal } from '../../src/components/AddMemberModal'
import { TreeMark } from '../../src/components/TreeMark'
import { saveMember, saveRelationship } from '../../src/lib/db'
import { Person } from '@rootline/engine'
import { parseGEDCOM, exportGEDCOM } from '../../src/lib/gedcom'
import { Avatar } from '../../src/components/Avatar'
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
  const [importing,    setImporting]    = useState(false)
  const [exporting,    setExporting]    = useState(false)

  const { graph, currentUserId, addPerson, addRelationship: storeAddRel, logActivity } = useFamilyStore()
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

  // ── GEDCOM import ─────────────────────────────────────────────────────────
  const importGedcom = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],   // .ged files have no registered MIME on iOS/Android
        copyToCacheDirectory: true,
      })
      if (result.canceled) return

      const file    = result.assets[0]
      const content = await FileSystem.readAsStringAsync(file.uri)
      const me      = currentUserId ? graph?.people[currentUserId] : null
      if (!me) { Alert.alert('No tree', 'Set up your tree first.'); return }

      setImporting(true)
      const parsed = parseGEDCOM(content, me.treeId)

      let added = 0
      for (const person of parsed.people) {
        addPerson(person as any)
        saveMember(person as any).catch(() => undefined)
        logActivity('added', person)
        added++
      }
      for (const rel of parsed.relationships) {
        storeAddRel(rel)
        saveRelationship(rel).catch(() => undefined)
      }

      setImporting(false)
      Alert.alert(
        'Import complete',
        `Added ${added} people${parsed.errors.length ? ` (${parsed.errors.length} warnings)` : ''}.`,
      )
    } catch {
      setImporting(false)
      Alert.alert('Import failed', 'Could not read the selected file.')
    }
  }

  // ── GEDCOM export ─────────────────────────────────────────────────────────
  const exportGedcom = async () => {
    if (!graph) return
    setExporting(true)
    try {
      const content = exportGEDCOM(graph)
      const uri     = (FileSystem.documentDirectory ?? '') + 'family_tree.ged'
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Export family tree' })
    } catch {
      Alert.alert('Export failed', 'Could not share the file.')
    } finally {
      setExporting(false)
    }
  }

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

      {/* Quick-action row — Relate & Quiz */}
      {hasMembers && (
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
            {/* GEDCOM import/export */}
            <View style={s.gedcomRow}>
              <Pressable
                style={({ pressed }) => [s.gedBtn, pressed && s.pressed, importing && s.gedBtnDisabled]}
                onPress={importGedcom}
                disabled={importing}
              >
                {importing
                  ? <ActivityIndicator size="small" color={Colors.amber} />
                  : <Text style={s.gedBtnText}>↓ Import GEDCOM</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.gedBtn, pressed && s.pressed, exporting && s.gedBtnDisabled]}
                onPress={exportGedcom}
                disabled={exporting}
              >
                {exporting
                  ? <ActivityIndicator size="small" color={Colors.amber} />
                  : <Text style={s.gedBtnText}>↑ Export GEDCOM</Text>}
              </Pressable>
            </View>
            {/* QR invite */}
            <Pressable
              style={({ pressed }) => [s.qrBtn, pressed && s.pressed]}
              onPress={() => router.push('/invite-qr')}
            >
              <Text style={s.qrBtnText}>Share QR invite code</Text>
            </Pressable>
          </View>
        ) : null}
      />

      <AddMemberModal visible={modalVisible} onClose={() => setModalVisible(false)} />
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
  quickRow:       { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl,
                    marginBottom: Spacing.md },
  quickBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                    backgroundColor: Colors.cream2, borderRadius: Radius.lg,
                    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                    borderWidth: 1, borderColor: Colors.border },
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

  // Footer (GEDCOM + QR)
  footer:         { marginTop: Spacing.xxl, gap: Spacing.sm },
  gedcomRow:      { flexDirection: 'row', gap: Spacing.sm },
  gedBtn:         { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.border,
                    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  gedBtnDisabled: { opacity: 0.5 },
  gedBtnText:     { ...Typography.label, color: Colors.textMid, fontSize: 12 },
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
