import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { createEngine } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { AddMemberModal } from '../../src/components/AddMemberModal'
import { Avatar } from '../../src/components/Avatar'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/theme'

function getDaysUntilBirthday(birthday: string): number {
  const [, m, d] = birthday.split('-').map(Number)
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < todayMid) next = new Date(today.getFullYear() + 1, m - 1, d)
  return Math.round((next.getTime() - todayMid.getTime()) / 86_400_000)
}

function formatBirthdayDate(birthday: string): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [, m, d] = birthday.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

function daysLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

export default function HomeScreen() {
  const router = useRouter()
  const [modalVisible, setModalVisible] = useState(false)
  const { graph, currentUserId, treeName } = useFamilyStore()
  const me = currentUserId ? graph?.people[currentUserId] : null
  const firstName = me?.name.split(' ')[0] ?? 'there'

  const { upcomingBirthdays, familyMembers } = useMemo(() => {
    if (!graph || !currentUserId) return { upcomingBirthdays: [], familyMembers: [] }
    const engine  = createEngine(graph)
    const allRels = engine.getAllRelationships(currentUserId)

    const upcomingBirthdays = allRels
      .map(({ personId, result }) => {
        const person = graph.people[personId]
        const days   = person.birthday ? getDaysUntilBirthday(person.birthday) : null
        return { person, label: result.found ? result.path.label : null, days }
      })
      .filter((item): item is typeof item & { days: number } => item.days !== null && item.days <= 30)
      .sort((a, b) => a.days - b.days)

    const familyMembers = allRels.slice(0, 4).map(({ personId, result }) => ({
      person: graph.people[personId],
      label:  result.found ? result.path.label : null,
    }))

    return { upcomingBirthdays, familyMembers }
  }, [graph, currentUserId])

  const otherCount = Math.max(0, Object.keys(graph?.people ?? {}).length - 1)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.greeting}>Hello, {firstName}</Text>
          {treeName && <Text style={s.treeName}>{treeName}</Text>}
        </View>

        {upcomingBirthdays.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Upcoming birthdays</Text>
            </View>
            <View style={s.card}>
              {upcomingBirthdays.map(({ person, label, days }, i) => (
                <Pressable
                  key={person.id}
                  style={({ pressed }) => [
                    s.row,
                    i < upcomingBirthdays.length - 1 && s.rowBorder,
                    pressed && s.pressed,
                  ]}
                  onPress={() => router.push(`/member/${person.id}`)}
                >
                  <Avatar name={person.name} photo={person.photo} size={40} style={s.avatar} />
                  <View style={s.rowInfo}>
                    <Text style={s.rowName}>{person.name}</Text>
                    {label && <Text style={s.rowLabel}>{label}</Text>}
                  </View>
                  <View style={s.bdayRight}>
                    <Text style={s.bdayDate}>{formatBirthdayDate(person.birthday!)}</Text>
                    <View style={[s.daysPill, days === 0 && s.daysPillToday]}>
                      <Text style={[s.daysText, days === 0 && s.daysTextToday]}>{daysLabel(days)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {familyMembers.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your family</Text>
              {otherCount > 0 && (
                <Pressable onPress={() => router.push('/(tabs)/family')}>
                  <Text style={s.seeAll}>{otherCount} {otherCount === 1 ? 'member' : 'members'} →</Text>
                </Pressable>
              )}
            </View>
            <View style={s.card}>
              {familyMembers.map(({ person, label }, i) => (
                <Pressable
                  key={person.id}
                  style={({ pressed }) => [
                    s.row,
                    i < familyMembers.length - 1 && s.rowBorder,
                    pressed && s.pressed,
                  ]}
                  onPress={() => router.push(`/member/${person.id}`)}
                >
                  <Avatar name={person.name} photo={person.photo} size={40} style={s.avatar} />
                  <View style={s.rowInfo}>
                    <Text style={s.rowName}>{person.name}</Text>
                    {label && <Text style={s.rowLabel}>{label}</Text>}
                  </View>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [s.addSection, pressed && s.addSectionPressed]}
          onPress={() => setModalVisible(true)}
        >
          <View style={s.addRow}>
            <View style={s.addText}>
              <Text style={s.addTitle}>Add family members</Text>
              <Text style={s.addBody}>
                Build out your tree by adding parents, siblings, children, and more.
              </Text>
            </View>
            <View style={s.addCircle}>
              <Text style={s.addPlus}>+</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      <AddMemberModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  scroll:         { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  header:         { paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  greeting:       { ...Typography.heading1, color: Colors.textDark },
  treeName:       { ...Typography.body, color: Colors.textMuted, marginTop: Spacing.xs },

  section:        { marginBottom: Spacing.xl },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle:   { ...Typography.label, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  seeAll:         { ...Typography.bodySmall, color: Colors.amber },

  card:           { backgroundColor: Colors.cream2, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  rowBorder:      { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  pressed:        { opacity: 0.7 },
  avatar:         { flexShrink: 0 },
  rowInfo:        { flex: 1 },
  rowName:        { fontFamily: 'DMSans-Medium', fontSize: 15, lineHeight: 22, color: Colors.textDark },
  rowLabel:       { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  chevron:        { fontSize: 20, color: Colors.textMuted, lineHeight: 24 },

  bdayRight:      { alignItems: 'flex-end', gap: Spacing.xs },
  bdayDate:       { ...Typography.caption, color: Colors.textMuted },
  daysPill:       { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.cream, borderWidth: 1, borderColor: Colors.border },
  daysPillToday:  { backgroundColor: Colors.amber, borderColor: Colors.amber },
  daysText:       { ...Typography.mono, fontSize: 10, color: Colors.textMid },
  daysTextToday:  { color: Colors.cream },

  addSection:         { backgroundColor: Colors.cream2, borderRadius: Radius.lg, padding: Spacing.xl },
  addSectionPressed:  { opacity: 0.8 },
  addRow:             { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  addText:            { flex: 1 },
  addTitle:           { ...Typography.nameTag, color: Colors.textDark, marginBottom: Spacing.xs },
  addBody:            { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },
  addCircle:          { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center' },
  addPlus:            { ...Typography.heading2, color: Colors.cream, lineHeight: 28 },
})
