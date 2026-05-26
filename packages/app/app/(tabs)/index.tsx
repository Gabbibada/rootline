import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { createEngine, buildAdjacency } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { AddMemberModal } from '../../src/components/AddMemberModal'
import { Avatar } from '../../src/components/Avatar'
import { Toast } from '../../src/components/Toast'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/theme'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysUntilBirthday(birthday: string): number {
  const [, m, d] = birthday.split('-').map(Number)
  const today    = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next       = new Date(today.getFullYear(), m - 1, d)
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

/** Compute current age in full years from a YYYY-MM-DD birthday string */
function computeAge(birthday: string): number | null {
  const [y, m, d] = birthday.split('-').map(Number)
  if (!y || !m || !d) return null
  const today = new Date()
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age >= 0 ? age : null
}

function computeGenerationSpan(graph: ReturnType<typeof useFamilyStore>['graph'], rootId: string): number {
  if (!graph) return 1
  const rels = Array.isArray(graph.relationships) ? graph.relationships : []
  const adj  = buildAdjacency(rels)
  const gen  = new Map<string, number>([[rootId, 0]])
  const queue: Array<{ id: string; g: number }> = [{ id: rootId, g: 0 }]
  while (queue.length) {
    const { id, g } = queue.shift()!
    for (const edge of (adj[id] ?? [])) {
      if (gen.has(edge.to)) continue
      const next = edge.direction === 'up' ? g - 1 : edge.direction === 'down' ? g + 1 : g
      gen.set(edge.to, next)
      queue.push({ id: edge.to, g: next })
    }
  }
  const vals = [...gen.values()]
  return Math.max(...vals) - Math.min(...vals) + 1
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const [modalVisible, setModalVisible] = useState(false)
  const [toast,        setToast]        = useState('')
  const { graph, currentUserId, treeName, activityLog } = useFamilyStore()
  const me        = currentUserId ? graph?.people[currentUserId] : null
  const firstName = me?.name.split(' ')[0] ?? 'there'

  const { todaysBirthdays, upcomingBirthdays, familyMembers, stats, missingBirthday } = useMemo(() => {
    if (!graph || !currentUserId) {
      return { todaysBirthdays: [], upcomingBirthdays: [], familyMembers: [], stats: null, missingBirthday: 0 }
    }
    const engine  = createEngine(graph)
    const allRels = engine.getAllRelationships(currentUserId)

    const withDays = allRels
      .map(({ personId, result }) => {
        const person = graph.people[personId]
        const days   = person.birthday ? getDaysUntilBirthday(person.birthday) : null
        return { person, label: result.found ? result.path.label : null, days }
      })
      .filter((item): item is typeof item & { days: number } => item.days !== null)

    const todaysBirthdays  = withDays.filter(b => b.days === 0)
    const upcomingBirthdays = withDays
      .filter(b => b.days > 0 && b.days <= 30)
      .sort((a, b) => a.days - b.days)

    const familyMembers = allRels.slice(0, 4).map(({ personId, result }) => ({
      person: graph.people[personId],
      label:  result.found ? result.path.label : null,
    }))

    // Stats
    const allPeople    = Object.values(graph.people)
    const memberCount  = allPeople.length
    const generations  = computeGenerationSpan(graph, currentUserId)
    const livingCount  = allPeople.filter(p => !p.deceased).length
    const deceasedCount= allPeople.filter(p =>  p.deceased).length

    // Average age — living members who have a birthday
    const livingAges = allPeople
      .filter(p => !p.deceased && p.birthday)
      .map(p => computeAge(p.birthday!))
      .filter((a): a is number => a !== null)
    const avgAge = livingAges.length > 1
      ? Math.round(livingAges.reduce((s, a) => s + a, 0) / livingAges.length)
      : null

    // Oldest living member (not self) with a known birthday
    const oldestLiving = allPeople
      .filter(p => !p.deceased && p.birthday && p.id !== currentUserId)
      .map(p => ({ ...p, age: computeAge(p.birthday!) }))
      .filter(p => p.age !== null)
      .sort((a, b) => a.birthday!.localeCompare(b.birthday!))
      [0] ?? null

    // Marriages = spouse-type relationships
    const rels         = Array.isArray(graph.relationships) ? graph.relationships : []
    const marriageCount= rels.filter(r => r.type === 'spouse').length

    // Profile completeness — % of members who have both a photo AND a birthday
    const withPhoto    = allPeople.filter(p => p.photo).length
    const withBirthday = allPeople.filter(p => p.birthday).length
    const completeness = memberCount > 1
      ? Math.round(((withPhoto + withBirthday) / (memberCount * 2)) * 100)
      : null

    const stats = memberCount > 1 ? {
      memberCount,
      generations,
      livingCount,
      deceasedCount,
      avgAge,
      marriageCount,
      oldestName:    oldestLiving?.name.split(' ')[0] ?? null,
      oldestYear:    oldestLiving?.birthday?.slice(0, 4) ?? null,
      oldestAge:     oldestLiving?.age ?? null,
      completeness,
    } : null

    // Missing birthday count (excluding self)
    const missingBirthday = Object.values(graph.people)
      .filter(p => p.id !== currentUserId && !p.birthday).length

    return { todaysBirthdays, upcomingBirthdays, familyMembers, stats, missingBirthday }
  }, [graph, currentUserId])

  const otherCount = Math.max(0, Object.keys(graph?.people ?? {}).length - 1)
  const recentActivity = activityLog.slice(0, 5)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.greeting}>Hello, {firstName}</Text>
          {treeName && <Text style={s.treeName}>{treeName}</Text>}
        </View>

        {/* ── On this day ── */}
        {todaysBirthdays.map(({ person, label }) => (
          <Pressable
            key={person.id}
            style={({ pressed }) => [s.todayCard, pressed && s.pressed]}
            onPress={() => router.push(`/member/${person.id}`)}
          >
            <View style={s.todayInner}>
              <Avatar name={person.name} photo={person.photo} size={52} style={s.todayAvatar} />
              <View style={s.todayText}>
                <Text style={s.todayLabel}>Birthday today</Text>
                <Text style={s.todayName}>{person.name}</Text>
                {label && <Text style={s.todayRel}>{label}</Text>}
              </View>
              <Text style={s.todayChevron}>›</Text>
            </View>
          </Pressable>
        ))}

        {/* ── Upcoming birthdays ── */}
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
                    <View style={s.daysPill}>
                      <Text style={s.daysText}>{daysLabel(days)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Your family ── */}
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

        {/* ── Tree stats dashboard ── */}
        {stats && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your tree</Text>
            </View>

            {/* Row 1 — size + shape */}
            <View style={s.statsRow}>
              <View style={[s.statCard, s.statCardHalf]}>
                <Text style={s.statNumber}>{stats.memberCount}</Text>
                <Text style={s.statLabel}>{stats.memberCount === 1 ? 'member' : 'members'}</Text>
              </View>
              <View style={[s.statCard, s.statCardHalf]}>
                <Text style={s.statNumber}>{stats.generations}</Text>
                <Text style={s.statLabel}>{stats.generations === 1 ? 'generation' : 'generations'}</Text>
              </View>
            </View>

            {/* Row 2 — living vs deceased */}
            <View style={s.statsRow}>
              <View style={[s.statCard, s.statCardHalf]}>
                <Text style={s.statNumber}>{stats.livingCount}</Text>
                <Text style={s.statLabel}>living</Text>
              </View>
              <View style={[s.statCard, s.statCardHalf]}>
                <Text style={s.statNumber}>{stats.deceasedCount}</Text>
                <Text style={s.statLabel}>deceased</Text>
              </View>
            </View>

            {/* Row 3 — avg age + marriages (only if data) */}
            {(stats.avgAge !== null || stats.marriageCount > 0) && (
              <View style={s.statsRow}>
                {stats.avgAge !== null && (
                  <View style={[s.statCard, s.statCardHalf]}>
                    <Text style={s.statNumber}>{stats.avgAge}</Text>
                    <Text style={s.statLabel}>avg age</Text>
                  </View>
                )}
                {stats.marriageCount > 0 && (
                  <View style={[s.statCard, s.statCardHalf]}>
                    <Text style={s.statNumber}>{stats.marriageCount}</Text>
                    <Text style={s.statLabel}>{stats.marriageCount === 1 ? 'marriage' : 'marriages'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Wide — oldest member */}
            {stats.oldestName && (
              <View style={[s.statCard, s.statCardWide]}>
                <View style={s.statWideRow}>
                  <View style={s.statWideText}>
                    <Text style={s.statWideLabel}>Oldest member</Text>
                    <Text style={s.statWideName}>{stats.oldestName}</Text>
                  </View>
                  <View style={s.statWideRight}>
                    {stats.oldestAge !== null && (
                      <Text style={s.statWideAge}>{stats.oldestAge} yrs</Text>
                    )}
                    {stats.oldestYear && (
                      <Text style={s.statWideYear}>b. {stats.oldestYear}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Wide — profile completeness */}
            {stats.completeness !== null && (
              <View style={[s.statCard, s.statCardWide, s.statCardLight]}>
                <View style={s.completenessHeader}>
                  <Text style={s.completenessLabel}>Profile completeness</Text>
                  <Text style={s.completenessPct}>{stats.completeness}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${stats.completeness}%` as any }]} />
                </View>
                <Text style={s.completenessHint}>Based on photos + birthdays added</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Missing birthday nudge ── */}
        {missingBirthday > 0 && (
          <Pressable
            style={({ pressed }) => [s.nudge, pressed && s.nudgePressed]}
            onPress={() => router.push('/(tabs)/family')}
          >
            <Text style={s.nudgeText}>
              🎂  {missingBirthday} member{missingBirthday > 1 ? 's' : ''} missing a birthday — tap to fill in
            </Text>
          </Pressable>
        )}

        {/* ── Recent activity ── */}
        {recentActivity.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent activity</Text>
            </View>
            <View style={s.card}>
              {recentActivity.map((entry, i) => (
                <View
                  key={entry.id}
                  style={[s.actRow, i < recentActivity.length - 1 && s.rowBorder]}
                >
                  <View style={s.actDot} />
                  <View style={s.actInfo}>
                    <Text style={s.actName}>{entry.personName}</Text>
                    <Text style={s.actDesc}>
                      {entry.type === 'added' ? 'added to tree' : entry.type === 'updated' ? 'profile updated' : 'removed'}
                    </Text>
                  </View>
                  <Text style={s.actTime}>{timeAgo(entry.timestamp)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Add members CTA ── */}
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
  scroll:         { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  header:         { paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  greeting:       { ...Typography.heading1, color: Colors.textDark },
  treeName:       { ...Typography.body, color: Colors.textMuted, marginTop: Spacing.xs },

  // On this day
  todayCard:      { backgroundColor: Colors.bark, borderRadius: Radius.lg, marginBottom: Spacing.xl, ...Shadow.strong },
  todayInner:     { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  todayAvatar:    { flexShrink: 0 },
  todayText:      { flex: 1 },
  todayLabel:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, letterSpacing: 1.2, color: Colors.amber, textTransform: 'uppercase', marginBottom: 4 },
  todayName:      { ...Typography.heading2, color: Colors.cream },
  todayRel:       { ...Typography.bodySmall, color: Colors.sand, marginTop: 2, opacity: 0.75 },
  todayChevron:   { fontSize: 24, color: Colors.sand, opacity: 0.5 },

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
  daysText:       { ...Typography.mono, fontSize: 10, color: Colors.textMid },

  // Stats dashboard
  statsRow:       { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard:       { backgroundColor: Colors.bark, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.bark3, ...Shadow.strong },
  statCardHalf:   { flex: 1, alignItems: 'center' },
  statCardFull:   { flex: 1, alignItems: 'center' },   // legacy alias
  statCardWide:   { width: '100%', marginBottom: Spacing.sm },
  statCardLight:  { backgroundColor: Colors.cream2, borderColor: Colors.border },
  statNumber:     { ...Typography.heading1, color: Colors.cream, lineHeight: 32 },
  statLabel:      { ...Typography.caption, color: Colors.sand, marginTop: 2, textAlign: 'center', opacity: 0.65 },

  // Oldest member — wide card
  statWideRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statWideText:   { flex: 1 },
  statWideLabel:  { ...Typography.caption, color: Colors.sand, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.55 },
  statWideName:   { ...Typography.nameTag, color: Colors.cream, marginTop: 2 },
  statWideRight:  { alignItems: 'flex-end' },
  statWideAge:    { ...Typography.heading2, color: Colors.amber, lineHeight: 24 },
  statWideYear:   { ...Typography.caption, color: Colors.sand, marginTop: 2, opacity: 0.55 },

  // Completeness — wide card (cream background)
  completenessHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  completenessLabel:  { ...Typography.label, color: Colors.textMid, flex: 1 },
  completenessPct:    { ...Typography.label, color: Colors.amber, fontSize: 15 },
  progressTrack:      { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginBottom: Spacing.sm },
  progressFill:       { height: 6, backgroundColor: Colors.amber, borderRadius: 3 },
  completenessHint:   { ...Typography.caption, color: Colors.textMuted },

  // Nudge
  nudge:          { backgroundColor: Colors.bark, borderRadius: Radius.md, padding: Spacing.md,
                    marginBottom: Spacing.xl },
  nudgePressed:   { opacity: 0.8 },
  nudgeText:      { ...Typography.bodySmall, color: Colors.sand, lineHeight: 20 },

  // Activity feed
  actRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
                    paddingHorizontal: Spacing.lg, gap: Spacing.md },
  actDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.amber, flexShrink: 0 },
  actInfo:        { flex: 1 },
  actName:        { fontFamily: 'DMSans-Medium', fontSize: 14, color: Colors.textDark },
  actDesc:        { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  actTime:        { ...Typography.mono, fontSize: 10, color: Colors.textMuted },

  addSection:         { backgroundColor: Colors.cream2, borderRadius: Radius.lg, padding: Spacing.xl },
  addSectionPressed:  { opacity: 0.8 },
  addRow:             { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  addText:            { flex: 1 },
  addTitle:           { ...Typography.nameTag, color: Colors.textDark, marginBottom: Spacing.xs },
  addBody:            { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },
  addCircle:          { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center' },
  addPlus:            { ...Typography.heading2, color: Colors.cream, lineHeight: 28 },
})
