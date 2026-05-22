import { useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { buildAdjacency, FamilyGraph } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { Colors, Typography, Spacing, Shadow } from '../../src/theme'

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_R      = 26    // circle radius
const H_GAP       = 120   // horizontal gap between unrelated nodes
const COUPLE_GAP  = 80    // tighter gap between adjacent spouses
const V_GAP       = 140   // vertical spacing between generations
const CANVAS      = 4000  // SVG canvas size
const OFFSET      = CANVAS / 2

// ── Pure layout computation ───────────────────────────────────────────────────
interface NodePos { x: number; y: number }

function computeLayout(
  graph: FamilyGraph,
  rootId: string,
): Map<string, NodePos> {
  const adj = buildAdjacency(graph.relationships)

  // BFS: assign a generation level to each reachable node
  const gen = new Map<string, number>([[rootId, 0]])
  const bfsQ: Array<{ id: string; g: number }> = [{ id: rootId, g: 0 }]
  while (bfsQ.length) {
    const { id, g } = bfsQ.shift()!
    for (const edge of (adj[id] ?? [])) {
      if (gen.has(edge.to)) continue
      const next = edge.direction === 'up'   ? g - 1
                 : edge.direction === 'down' ? g + 1
                 :                             g
      gen.set(edge.to, next)
      bfsQ.push({ id: edge.to, g: next })
    }
  }

  // Relationship maps (restricted to reachable nodes)
  const spouseOf  = new Map<string, string>()
  const parentsOf = new Map<string, string[]>()
  for (const rel of graph.relationships) {
    if (!gen.has(rel.from) || !gen.has(rel.to)) continue
    if (rel.type === 'spouse') {
      spouseOf.set(rel.from, rel.to)
      spouseOf.set(rel.to, rel.from)
    } else {
      // parent edge: from = parent, to = child
      if (!parentsOf.has(rel.to)) parentsOf.set(rel.to, [])
      parentsOf.get(rel.to)!.push(rel.from)
    }
  }

  // Group nodes by generation
  const rows = new Map<number, string[]>()
  for (const [id, g] of gen) {
    if (!rows.has(g)) rows.set(g, [])
    rows.get(g)!.push(id)
  }
  const genNums = [...rows.keys()].sort((a, b) => a - b)

  const positions = new Map<string, NodePos>()

  // Top-down: process each generation using already-placed ancestor positions
  for (const g of genNums) {
    const ids = rows.get(g)!

    // Build units: adjacent spouse pairs stay together, rest are singles
    const seen = new Set<string>()
    const units: string[][] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const sp = spouseOf.get(id)
      if (sp && ids.includes(sp) && !seen.has(sp)) {
        seen.add(sp)
        units.push([id, sp])
      } else {
        units.push([id])
      }
    }

    // Sort units by average x of their already-placed parents
    const anchorX = (unit: string[]) => {
      const xs: number[] = []
      for (const id of unit)
        for (const pid of (parentsOf.get(id) ?? []))
          if (positions.has(pid)) xs.push(positions.get(pid)!.x)
      return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : OFFSET
    }
    units.sort((a, b) => anchorX(a) - anchorX(b))

    // Lay out units: COUPLE_GAP inside a pair, H_GAP between units
    const slots: { id: string; relX: number }[] = []
    let cursor = 0
    for (let i = 0; i < units.length; i++) {
      if (i > 0) cursor += H_GAP
      slots.push({ id: units[i][0], relX: cursor })
      if (units[i].length === 2) {
        cursor += COUPLE_GAP
        slots.push({ id: units[i][1], relX: cursor })
      }
    }

    // Center the row around OFFSET
    const span    = slots.length > 0 ? slots[slots.length - 1].relX : 0
    const startX  = OFFSET - span / 2
    for (const { id, relX } of slots)
      positions.set(id, { x: startX + relX, y: OFFSET + g * V_GAP })
  }

  return positions
}

// ── Tree screen ───────────────────────────────────────────────────────────────
const HEADER_H = 80

export default function TreeScreen() {
  const router  = useRouter()
  const { graph, currentUserId } = useFamilyStore()
  const { width: sw, height: sh } = useWindowDimensions()

  // Gesture state
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const sc = useSharedValue(1)
  const stx = useSharedValue(0)
  const sty = useSharedValue(0)
  const ssc = useSharedValue(1)

  const layout = useMemo(() => {
    if (!graph || !currentUserId || !graph.people[currentUserId]) return null
    return computeLayout(graph, currentUserId)
  }, [graph, currentUserId])

  // Centre viewport on current user when layout is ready
  useEffect(() => {
    tx.value = sw / 2 - OFFSET
    ty.value = (sh - HEADER_H) / 2 - OFFSET
    sc.value = 1
  }, [layout, sw, sh])

  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => { stx.value = tx.value; sty.value = ty.value })
    .onUpdate(e => { tx.value = stx.value + e.translationX; ty.value = sty.value + e.translationY })

  const pinch = Gesture.Pinch()
    .onBegin(() => { ssc.value = sc.value; stx.value = tx.value; sty.value = ty.value })
    .onUpdate(e => {
      const next = Math.max(0.25, Math.min(4, ssc.value * e.scale))
      sc.value = next
      // Keep focal point fixed during zoom
      tx.value = e.focalX - (e.focalX - stx.value) * (next / ssc.value)
      ty.value = e.focalY - (e.focalY - sty.value) * (next / ssc.value)
    })

  const gesture = Gesture.Simultaneous(pan, pinch)

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ],
  }))

  if (!graph || !currentUserId || !layout) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>Tree</Text>
        </View>
        <View style={s.empty}>
          <Text style={s.emptyText}>Add family members to see your tree.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const people        = graph.people
  const relationships = graph.relationships

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Tree</Text>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={s.canvas}>
          <Animated.View style={[s.svgWrap, animStyle]}>
            <Svg width={CANVAS} height={CANVAS}>

              {/* ── Edges ── */}
              {relationships.map(rel => {
                const a = layout.get(rel.from)
                const b = layout.get(rel.to)
                if (!a || !b) return null

                if (rel.type === 'spouse') {
                  return (
                    <Line
                      key={rel.id}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={Colors.amber}
                      strokeWidth={1.5}
                      strokeDasharray="5,4"
                      opacity={0.6}
                    />
                  )
                }

                // parent edge: elbow routing — horizontal mid-line then drop
                const midY = (a.y + b.y) / 2
                const path = `M${a.x},${a.y} L${a.x},${midY} L${b.x},${midY} L${b.x},${b.y}`
                return (
                  <G key={rel.id}>
                    <Line x1={a.x} y1={a.y} x2={a.x} y2={midY}  stroke={Colors.sand} strokeWidth={1.5} opacity={0.3} />
                    <Line x1={a.x} y1={midY} x2={b.x} y2={midY} stroke={Colors.sand} strokeWidth={1.5} opacity={0.3} />
                    <Line x1={b.x} y1={midY} x2={b.x} y2={b.y}  stroke={Colors.sand} strokeWidth={1.5} opacity={0.3} />
                  </G>
                )
              })}

              {/* ── Nodes ── */}
              {Object.values(people).map(person => {
                const pos = layout.get(person.id)
                if (!pos) return null
                const isMe = person.id === currentUserId
                const initial = person.name.charAt(0).toUpperCase()
                const firstName = person.name.split(' ')[0]

                const isDeceased = person.deceased && !isMe

                return (
                  <G
                    key={person.id}
                    onPress={() => router.push(`/member/${person.id}`)}
                  >
                    {/* Outer ring for current user */}
                    {isMe && (
                      <Circle
                        cx={pos.x} cy={pos.y}
                        r={NODE_R + 5}
                        fill="none"
                        stroke={Colors.amber}
                        strokeWidth={1.5}
                        opacity={0.4}
                      />
                    )}
                    <Circle
                      cx={pos.x} cy={pos.y}
                      r={NODE_R}
                      fill={isMe ? Colors.amber : (isDeceased ? Colors.bark : Colors.bark2)}
                      stroke={isMe ? Colors.amberLight : Colors.bark3}
                      strokeWidth={isDeceased ? 1 : 1.5}
                      strokeDasharray={isDeceased ? '4,3' : undefined}
                      opacity={isDeceased ? 0.7 : 1}
                    />
                    {/* Initial letter */}
                    <SvgText
                      x={pos.x} y={pos.y + 5}
                      textAnchor="middle"
                      fill={isMe ? Colors.bark : Colors.sand}
                      fontSize={15}
                      fontFamily="DMSans-Medium"
                      opacity={isDeceased ? 0.55 : 1}
                    >
                      {initial}
                    </SvgText>
                    {/* Name label below node */}
                    <SvgText
                      x={pos.x} y={pos.y + NODE_R + 15}
                      textAnchor="middle"
                      fill={Colors.sand}
                      fontSize={11}
                      fontFamily="DMSans-Regular"
                      opacity={isDeceased ? 0.45 : 0.85}
                    >
                      {isDeceased ? `${firstName} †` : firstName}
                    </SvgText>
                  </G>
                )
              })}

            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendRow}>
          <View style={s.legendDot} />
          <Text style={s.legendLabel}>You</Text>
        </View>
        <View style={s.legendRow}>
          <View style={s.legendDash} />
          <Text style={s.legendLabel}>Spouse</Text>
        </View>
        <View style={s.legendRow}>
          <View style={s.legendDeceased} />
          <Text style={s.legendLabel}>Deceased</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bark },
  header:     { height: HEADER_H, paddingHorizontal: Spacing.xl, justifyContent: 'flex-end', paddingBottom: Spacing.lg },
  title:      { ...Typography.heading1, color: Colors.cream },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  emptyText:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  canvas:     { flex: 1, overflow: 'hidden' },
  svgWrap:    { position: 'absolute', left: 0, top: 0 },
  legend:     { position: 'absolute', bottom: 32, right: Spacing.xl, backgroundColor: Colors.bark2, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, ...Shadow.card },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.amber },
  legendDash:     { width: 16, height: 0, borderTopWidth: 1.5, borderTopColor: Colors.amber, borderStyle: 'dashed' },
  legendDeceased: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: Colors.bark3, borderStyle: 'dashed', opacity: 0.7 },
  legendLabel:    { ...Typography.caption, color: Colors.sand },
})
