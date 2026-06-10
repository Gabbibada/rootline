/**
 * Family Quiz screen
 *
 * The relationship engine picks a random relative and asks the user to
 * identify them from four avatar choices. Score accumulates until the user
 * quits or runs out of unique relatives to quiz on.
 */
import { useState, useMemo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { createEngine, Person } from '@rootline/engine'
import { useFamilyStore } from '../src/store/familyStore'
import { Avatar } from '../src/components/Avatar'
import { Colors, Typography, Spacing, Radius, Shadow } from '../src/theme'

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface Question {
  targetId:  string           // who the user must identify
  label:     string           // relationship label shown in the question
  choices:   Person[]         // 4 shuffled options (includes the correct one)
  correctId: string
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const router = useRouter()
  const { graph, currentUserId } = useFamilyStore()

  const [score,     setScore]     = useState(0)
  const [total,     setTotal]     = useState(0)
  const [answered,  setAnswered]  = useState<string | null>(null)   // chosen person id
  const [asked,     setAsked]     = useState<Set<string>>(new Set())
  const [done,      setDone]      = useState(false)

  // All relatives (excluding current user)
  const relatives = useMemo(() => {
    if (!graph || !currentUserId) return []
    const engine = createEngine(graph)
    return engine.getAllRelationships(currentUserId)
      .filter(r => r.result.found)
      .map(r => ({
        person: graph.people[r.personId],
        label:  (r.result as { found: true; path: { label: string } }).path.label,
      }))
      .filter(r => r.person)
  }, [graph, currentUserId])

  const allPeople = useMemo(() => Object.values(graph?.people ?? {}), [graph])

  const buildQuestion = useCallback((): Question | null => {
    const remaining = relatives.filter(r => !asked.has(r.person.id))
    if (remaining.length === 0) return null

    const target = pickRandom(remaining)

    // 3 random wrong choices (not the correct person)
    const pool    = allPeople.filter(p => p.id !== target.person.id)
    const wrongs  = shuffle(pool).slice(0, 3)

    return {
      targetId:  target.person.id,
      label:     target.label,
      choices:   shuffle([target.person, ...wrongs]),
      correctId: target.person.id,
    }
  }, [relatives, asked, allPeople])

  const [question, setQuestion] = useState<Question | null>(() => buildQuestion())

  const choose = (personId: string) => {
    if (answered || !question) return
    setAnswered(personId)
    const correct = personId === question.correctId
    if (correct) setScore(s => s + 1)
    setTotal(t => t + 1)
  }

  const next = () => {
    if (!question) return
    const newAsked  = new Set(asked).add(question.correctId)
    setAsked(newAsked)
    setAnswered(null)

    const remaining = relatives.filter(r => !newAsked.has(r.person.id))
    if (remaining.length === 0) {
      setDone(true)
    } else {
      const target = pickRandom(remaining)
      const pool   = allPeople.filter(p => p.id !== target.person.id)
      const wrongs = shuffle(pool).slice(0, 3)
      setQuestion({
        targetId:  target.person.id,
        label:     target.label,
        choices:   shuffle([target.person, ...wrongs]),
        correctId: target.person.id,
      })
    }
  }

  // ── Not enough people ──────────────────────────────────────────────────────
  if (relatives.length < 2) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.back}>← Back</Text>
          </Pressable>
          <Text style={s.title}>Family Quiz</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.center}>
          <Text style={s.doneScore}>🌱</Text>
          <Text style={s.doneTitle}>Add more family members</Text>
          <Text style={s.doneBody}>You need at least two relatives in your tree to play.</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Quiz complete ──────────────────────────────────────────────────────────
  if (done) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.back}>← Back</Text>
          </Pressable>
          <Text style={s.title}>Family Quiz</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.center}>
          <Text style={s.doneScore}>{pct >= 80 ? '🏆' : pct >= 50 ? '🌟' : '📚'}</Text>
          <Text style={s.doneTitle}>Quiz complete!</Text>
          <Text style={s.doneBody}>
            You scored {score} out of {total} ({pct}%)
          </Text>
          <Pressable
            style={({ pressed }) => [s.restartBtn, pressed && s.pressed]}
            onPress={() => {
              setScore(0); setTotal(0); setAnswered(null)
              setAsked(new Set()); setDone(false)
              setQuestion(buildQuestion())
            }}
          >
            <Text style={s.restartBtnText}>Play again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  if (!question) return null

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.back}>← Back</Text>
          </Pressable>
          <Text style={s.title}>Family Quiz</Text>
          <Text style={s.scoreChip}>{score}/{total}</Text>
        </View>

        {/* Progress */}
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${(asked.size / relatives.length) * 100}%` }]} />
        </View>

        {/* Question */}
        <View style={s.questionCard}>
          <Text style={s.questionPre}>Who is</Text>
          <Text style={s.questionLabel}>{question.label}?</Text>
        </View>

        {/* Choices */}
        <View style={s.grid}>
          {question.choices.map((person) => {
            const isChosen  = answered === person.id
            const isCorrect = person.id === question.correctId
            const showResult = answered !== null

            let cardStyle = s.choiceCard
            if (showResult && isCorrect) cardStyle = { ...cardStyle, ...s.choiceCorrect } as any
            else if (showResult && isChosen && !isCorrect) cardStyle = { ...cardStyle, ...s.choiceWrong } as any

            return (
              <Pressable
                key={person.id}
                style={({ pressed }) => [cardStyle, !showResult && pressed && s.pressed]}
                onPress={() => choose(person.id)}
                disabled={!!answered}
              >
                <Avatar name={person.name} photo={person.photo} size={52} />
                <Text style={s.choiceName} numberOfLines={2}>
                  {person.name.split(' ')[0]}
                </Text>
                {showResult && isCorrect && (
                  <Text style={s.checkmark}>✓</Text>
                )}
                {showResult && isChosen && !isCorrect && (
                  <Text style={s.cross}>✗</Text>
                )}
              </Pressable>
            )
          })}
        </View>

        {/* Next button appears after answering */}
        {answered && (
          <Pressable
            style={({ pressed }) => [s.nextBtn, pressed && s.pressed]}
            onPress={next}
          >
            <Text style={s.nextBtnText}>
              {asked.size + 1 >= relatives.length ? 'See results' : 'Next question →'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.cream },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  back:      { ...Typography.body, color: Colors.textMid, width: 60 },
  title:     { ...Typography.heading2, color: Colors.textDark },
  scoreChip: { ...Typography.mono, fontSize: 13, color: Colors.amber,
               backgroundColor: Colors.bark, paddingHorizontal: 10, paddingVertical: 4,
               borderRadius: Radius.full, overflow: 'hidden' },

  progressBar:  { height: 4, backgroundColor: Colors.cream2, borderRadius: 2, marginBottom: Spacing.xl },
  progressFill: { height: 4, backgroundColor: Colors.amber, borderRadius: 2 },

  questionCard: { backgroundColor: Colors.bark, borderRadius: Radius.lg, padding: Spacing.xl,
                  alignItems: 'center', marginBottom: Spacing.xl, ...Shadow.strong },
  questionPre:  { ...Typography.body, color: Colors.sand, opacity: 0.65 },
  questionLabel:{ ...Typography.display, fontSize: 26, color: Colors.amber, textAlign: 'center',
                  marginTop: Spacing.xs },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  choiceCard:   { width: '47%', backgroundColor: Colors.cream2, borderRadius: Radius.lg,
                  padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
                  borderWidth: 1.5, borderColor: Colors.border, ...Shadow.card },
  choiceCorrect:{ backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  choiceWrong:  { backgroundColor: '#FFEBEE', borderColor: '#EF5350', opacity: 0.7 },
  choiceName:   { ...Typography.label, color: Colors.textDark, textAlign: 'center' },
  checkmark:    { fontSize: 18, color: '#4CAF50', fontFamily: 'Inter-Medium' },
  cross:        { fontSize: 18, color: '#EF5350', fontFamily: 'Inter-Medium' },
  pressed:      { opacity: 0.75 },

  nextBtn:     { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md,
                 alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  nextBtnText: { ...Typography.label, color: Colors.cream, fontSize: 15 },

  // Done screen
  doneScore: { fontSize: 56, marginBottom: Spacing.lg },
  doneTitle: { ...Typography.heading1, color: Colors.textDark, textAlign: 'center',
               marginBottom: Spacing.sm },
  doneBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center',
               lineHeight: 24, marginBottom: Spacing.xxl },
  restartBtn:    { height: 52, paddingHorizontal: Spacing.xxl, backgroundColor: Colors.amber,
                   borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  restartBtnText:{ ...Typography.label, color: Colors.cream, fontSize: 15 },
})
