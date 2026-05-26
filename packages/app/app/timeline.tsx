/**
 * Family Timeline
 *
 * Chronological view of family events — births and deaths —
 * sorted oldest → newest with year dividers.
 * Each card is tappable and links to the member's profile.
 */
import { useMemo } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { createEngine } from '@rootline/engine'
import { useFamilyStore } from '../src/store/familyStore'
import { Avatar } from '../src/components/Avatar'
import { displayDate } from '../src/components/DatePickerField'
import { Colors, Typography, Spacing, Radius, Shadow } from '../src/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  key:         string
  type:        'born' | 'died'
  date:        string        // YYYY-MM-DD
  year:        number
  personId:    string
  name:        string
  photo:       string | null
  relLabel:    string | null
  ageAtDeath?: number
}

type ListItem =
  | { kind: 'year';  year: number; key: string }
  | { kind: 'event'; event: TimelineEvent; key: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAgeAtDeath(birthday: string, deathDate: string): number | null {
  const [by, bm, bd] = birthday.split('-').map(Number)
  const [dy, dm, dd] = deathDate.split('-').map(Number)
  if (!by || !bm || !bd || !dy || !dm || !dd) return null
  let age = dy - by
  if (dm < bm || (dm === bm && dd < bd)) age--
  return age >= 0 ? age : null
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const router = useRouter()
  const { graph, currentUserId } = useFamilyStore()

  const listItems = useMemo<ListItem[]>(() => {
    if (!graph || !currentUserId) return []

    // Build relationship label map
    const relMap = new Map<string, string>()
    relMap.set(currentUserId, 'You')
    try {
      const engine = createEngine(graph)
      for (const { personId, result } of engine.getAllRelationships(currentUserId)) {
        if (result.found) relMap.set(personId, result.path.label)
      }
    } catch {}

    // Collect events from every person
    const events: TimelineEvent[] = []

    for (const person of Object.values(graph.people)) {
      if (person.birthday) {
        const year = Number(person.birthday.split('-')[0])
        if (year > 0) {
          events.push({
            key:      `born-${person.id}`,
            type:     'born',
            date:     person.birthday,
            year,
            personId: person.id,
            name:     person.name,
            photo:    person.photo ?? null,
            relLabel: relMap.get(person.id) ?? null,
          })
        }
      }

      if (person.deceased && person.deathDate) {
        const year = Number(person.deathDate.split('-')[0])
        if (year > 0) {
          const age = person.birthday
            ? calcAgeAtDeath(person.birthday, person.deathDate)
            : null
          events.push({
            key:        `died-${person.id}`,
            type:       'died',
            date:       person.deathDate,
            year,
            personId:   person.id,
            name:       person.name,
            photo:      person.photo ?? null,
            relLabel:   relMap.get(person.id) ?? null,
            ageAtDeath: age ?? undefined,
          })
        }
      }
    }

    // Sort oldest → newest
    events.sort((a, b) => a.date.localeCompare(b.date))

    // Interleave year dividers
    const items: ListItem[] = []
    let lastYear = -1
    for (const event of events) {
      if (event.year !== lastYear) {
        items.push({ kind: 'year', year: event.year, key: `year-${event.year}-${event.date}` })
        lastYear = event.year
      }
      items.push({ kind: 'event', event, key: event.key })
    }
    return items
  }, [graph, currentUserId])

  // Summary counts for the sub-header
  const counts = useMemo(() => {
    const births = listItems.filter(i => i.kind === 'event' && i.event.type === 'born').length
    const deaths = listItems.filter(i => i.kind === 'event' && i.event.type === 'died').length
    return { births, deaths }
  }, [listItems])

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (item.kind === 'year') {
      return (
        <View style={s.yearDivider}>
          <View style={s.yearLine} />
          <Text style={s.yearText}>{item.year}</Text>
          <View style={s.yearLine} />
        </View>
      )
    }

    const { event } = item
    const isBorn  = event.type === 'born'

    // Is this the last event? (no connector line below)
    const isLast = index === listItems.length - 1
      || (index < listItems.length - 1 && listItems[index + 1].kind === 'year')

    return (
      <Pressable
        style={({ pressed }) => [s.eventRow, pressed && s.pressed]}
        onPress={() => router.push(`/member/${event.personId}`)}
      >
        {/* Timeline spine */}
        <View style={s.spineCol}>
          <View style={[s.dot, isBorn ? s.dotBorn : s.dotDied]} />
          {!isLast && <View style={s.spine} />}
        </View>

        {/* Event card */}
        <View style={s.card}>
          <Avatar name={event.name} photo={event.photo} size={40} style={s.avatar} />
          <View style={s.cardBody}>
            <View style={s.cardTopRow}>
              <Text style={[s.eventTag, isBorn ? s.tagBorn : s.tagDied]}>
                {isBorn ? '✦ Born' : '† Died'}
              </Text>
              <Text style={s.eventDate}>{displayDate(event.date)}</Text>
            </View>
            <Text style={s.personName}>{event.name}</Text>
            {event.relLabel && (
              <Text style={s.relLabel}>{event.relLabel}</Text>
            )}
            {!isBorn && event.ageAtDeath !== undefined && (
              <Text style={s.ageLabel}>Aged {event.ageAtDeath}</Text>
            )}
          </View>
          <Text style={s.chevron}>›</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.back}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Family Timeline</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Sub-header summary */}
      {listItems.length > 0 && (
        <View style={s.summary}>
          <Text style={s.summaryItem}>
            <Text style={s.summaryDot}>✦ </Text>
            {counts.births} {counts.births === 1 ? 'birth' : 'births'}
          </Text>
          {counts.deaths > 0 && (
            <Text style={s.summaryItem}>
              <Text style={s.summaryDotDied}>† </Text>
              {counts.deaths} {counts.deaths === 1 ? 'death' : 'deaths'}
            </Text>
          )}
        </View>
      )}

      {/* List */}
      {listItems.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📜</Text>
          <Text style={s.emptyTitle}>No dates recorded yet</Text>
          <Text style={s.emptyBody}>
            Add birthdays and death dates to your family members to build a timeline of your family's history.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={item => item.key}
          contentContainerStyle={s.list}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.cream },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  back:   { ...Typography.body, color: Colors.textMid, width: 60 },
  title:  { ...Typography.heading2, color: Colors.textDark },

  summary: {
    flexDirection: 'row', gap: Spacing.lg,
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md,
  },
  summaryItem:    { ...Typography.bodySmall, color: Colors.textMuted },
  summaryDot:     { color: Colors.amber },
  summaryDotDied: { color: Colors.textMuted },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, paddingTop: Spacing.xs },

  // Year divider
  yearDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing.xl, marginBottom: Spacing.md,
  },
  yearLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  yearText: {
    ...Typography.mono, fontSize: 12, color: Colors.amber,
    paddingHorizontal: Spacing.md, letterSpacing: 1,
  },

  // Event row
  eventRow:  { flexDirection: 'row', marginBottom: Spacing.sm },
  pressed:   { opacity: 0.72 },

  // Spine (left column with dot + vertical line)
  spineCol:  { width: 24, alignItems: 'center', paddingTop: 14 },
  dot:       { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  dotBorn:   { backgroundColor: Colors.amber },
  dotDied:   { backgroundColor: Colors.textMuted },
  spine:     { flex: 1, width: 1.5, backgroundColor: Colors.borderFaint, marginTop: 4 },

  // Card
  card: {
    flex: 1, marginLeft: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.cream2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.card,
    marginBottom: Spacing.xs,
  },
  avatar:      { flexShrink: 0 },
  cardBody:    { flex: 1 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  eventTag:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, letterSpacing: 0.8,
                 textTransform: 'uppercase' },
  tagBorn:     { color: Colors.amber },
  tagDied:     { color: Colors.textMuted },
  eventDate:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: Colors.textMuted },
  personName:  { ...Typography.nameTag, color: Colors.textDark, fontSize: 14 },
  relLabel:    { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  ageLabel:    { ...Typography.caption, color: Colors.textMuted, marginTop: 1, fontStyle: 'italic' },
  chevron:     { fontSize: 18, color: Colors.textMuted, lineHeight: 24 },

  // Empty state
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  emptyIcon:  { fontSize: 52, marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.heading2, color: Colors.textDark, textAlign: 'center',
                marginBottom: Spacing.sm },
  emptyBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
})
