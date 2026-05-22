import { useMemo, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, useWindowDimensions,
  Animated, PanResponder, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { buildAdjacency, FamilyGraph } from '@rootline/engine'
import { useFamilyStore } from '../../src/store/familyStore'
import { Colors, Typography, Spacing, Shadow } from '../../src/theme'

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_R      = 26
const H_GAP       = 120
const COUPLE_GAP  = 80
const V_GAP       = 140
const CANVAS      = 4000
const OFFSET      = CANVAS / 2

// ── Pure layout computation ───────────────────────────────────────────────────
interface NodePos { x: number; y: number }

function computeLayout(graph: FamilyGraph, rootId: string): Map<string, NodePos> {
  const adj = buildAdjacency(graph.relationships)

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

  const spouseOf  = new Map<string, string>()
  const parentsOf = new Map<string, string[]>()
  for (const rel of graph.relationships) {
    if (!gen.has(rel.from) || !gen.has(rel.to)) continue
    if (rel.type === 'spouse') {
      spouseOf.set(rel.from, rel.to)
      spouseOf.set(rel.to, rel.from)
    } else {
      if (!parentsOf.has(rel.to)) parentsOf.set(rel.to, [])
      parentsOf.get(rel.to)!.push(rel.from)
    }
  }

  const rows = new Map<number, string[]>()
  for (const [id, g] of gen) {
    if (!rows.has(g)) rows.set(g, [])
    rows.get(g)!.push(id)
  }
  const genNums = [...rows.keys()].sort((a, b) => a - b)
  const positions = new Map<string, NodePos>()

  for (const g of genNums) {
    const ids = rows.get(g)!
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

    const anchorX = (unit: string[]) => {
      const xs: number[] = []
      for (const id of unit)
        for (const pid of (parentsOf.get(id) ?? []))
          if (positions.has(pid)) xs.push(positions.get(pid)!.x)
      return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : OFFSET
    }
    units.sort((a, b) => anchorX(a) - anchorX(b))

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

    const span   = slots.length > 0 ? slots[slots.length - 1].relX : 0
    const startX = OFFSET - span / 2
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

  // Pan/zoom using React Native's built-in Animated + PanResponder
  // (no reanimated needed — compatible with Expo Go)
  const pan    = useRef(new Animated.ValueXY()).current
  const scale  = useRef(new Animated.Value(1)).current
  const offsetX      = useRef(0)
  const offsetY      = useRef(0)
  const currentScale = useRef(1)

  const layout = useMemo(() => {
    if (!graph || !currentUserId || !graph.people[currentUserId]) return null
    return computeLayout(graph, currentUserId)
  }, [graph, currentUserId])

  // Centre viewport on the current user when layout first appears
  useEffect(() => {
    const x = sw / 2 - OFFSET
    const y = (sh - HEADER_H) / 2 - OFFSET
    offsetX.current = x
    offsetY.current = y
    pan.setValue({ x, y })
    scale.setValue(1)
    currentScale.current = 1
  }, [layout, sw, sh])

  const panResponder = useRef(
    PanResponder.create({
      // Don't claim touch on finger-down — lets SVG onPress fire for taps
      onStartShouldSetPanResponder: () => false,
      // Claim only when a clear drag is detected
      onMoveShouldSetPanResponder:  (_, gs) =>
        Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({ x: offsetX.current, y: offsetY.current })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, gs) => {
        offsetX.current += gs.dx
        offsetY.current += gs.dy
        pan.flattenOffset()
      },
    })
  ).current

  const zoom = (dir: 1 | -1) => {
    const next = Math.max(0.25, Math.min(4, currentScale.current * (dir > 0 ? 1.4 : 1 / 1.4)))
    currentScale.current = next
    Animated.spring(scale, {
      toValue: next,
      useNativeDriver: false,
      speed: 20,
      bounciness: 0,
    }).start()
  }

  const animStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale },
    ],
  }

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

      <View style={s.canvas} {...panResponder.panHandlers}>
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

              const midY = (a.y + b.y) / 2
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
              const isMe       = person.id === currentUserId
              const isDeceased = person.deceased && !isMe
              const initial    = person.name.charAt(0).toUpperCase()
              const firstName  = person.name.split(' ')[0]

              return (
                <G
                  key={person.id}
                  onPress={() => router.push(`/member/${person.id}`)}
                >
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

      {/* Zoom controls */}
      <View style={s.zoomControls}>
        <Pressable style={s.zoomBtn} onPress={() => zoom(1)}>
          <Text style={s.zoomText}>+</Text>
        </Pressable>
        <Pressable style={s.zoomBtn} onPress={() => zoom(-1)}>
          <Text style={s.zoomText}>−</Text>
        </Pressable>
      </View>

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
  safe:           { flex: 1, backgroundColor: Colors.bark },
  header:         { height: HEADER_H, paddingHorizontal: Spacing.xl, justifyContent: 'flex-end', paddingBottom: Spacing.lg },
  title:          { ...Typography.heading1, color: Colors.cream },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  emptyText:      { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  canvas:         { flex: 1, overflow: 'hidden' },
  svgWrap:        { position: 'absolute', left: 0, top: 0 },

  // Zoom controls
  zoomControls:   { position: 'absolute', bottom: 120, right: Spacing.xl, gap: Spacing.xs },
  zoomBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bark2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.bark3, ...Shadow.card },
  zoomText:       { fontFamily: 'DMSans-Medium', fontSize: 22, color: Colors.sand, lineHeight: 28 },

  // Legend
  legend:         { position: 'absolute', bottom: 32, left: Spacing.xl, backgroundColor: Colors.bark2, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, ...Shadow.card },
  legendRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.amber },
  legendDash:     { width: 16, height: 0, borderTopWidth: 1.5, borderTopColor: Colors.amber, borderStyle: 'dashed' },
  legendDeceased: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: Colors.bark3, borderStyle: 'dashed', opacity: 0.7 },
  legendLabel:    { ...Typography.caption, color: Colors.sand },
})
