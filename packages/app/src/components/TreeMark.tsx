import Svg, { Circle, Line } from 'react-native-svg'
import { Colors } from '../theme'

interface Props {
  /** Height in pixels. Width scales proportionally at the 180:140 natural ratio. */
  size?:  number
  color?: string
}

/**
 * Rootline tree-mark illustration — three generations of connected nodes.
 * Extracted as a shared component so the welcome screen, empty states,
 * and any future screen all render the same mark.
 */
export function TreeMark({ size = 140, color = Colors.amber }: Props) {
  const width = (size * 180) / 140
  const a = color

  return (
    <Svg width={width} height={size} viewBox="0 0 180 140">
      {/* ── Trunk & main branches ── */}
      <Line x1="90"  y1="140" x2="90"  y2="80"  stroke={a} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="90"  y1="110" x2="55"  y2="78"  stroke={a} strokeWidth={2}   strokeLinecap="round" />
      <Line x1="90"  y1="110" x2="125" y2="78"  stroke={a} strokeWidth={2}   strokeLinecap="round" />

      {/* ── Second-generation branches ── */}
      <Line x1="55"  y1="78"  x2="35"  y2="46"  stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="55"  y1="78"  x2="70"  y2="46"  stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="125" y1="78"  x2="110" y2="46"  stroke={a} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="125" y1="78"  x2="145" y2="46"  stroke={a} strokeWidth={1.5} strokeLinecap="round" />

      {/* ── Third-generation branches ── */}
      <Line x1="35"  y1="46"  x2="22"  y2="18"  stroke={a} strokeWidth={1}   strokeLinecap="round" />
      <Line x1="35"  y1="46"  x2="48"  y2="18"  stroke={a} strokeWidth={1}   strokeLinecap="round" />
      <Line x1="70"  y1="46"  x2="83"  y2="18"  stroke={a} strokeWidth={1}   strokeLinecap="round" />
      <Line x1="145" y1="46"  x2="132" y2="18"  stroke={a} strokeWidth={1}   strokeLinecap="round" />

      {/* ── Filled nodes (known members) ── */}
      <Circle cx="90"  cy="80" r="5.5" fill={a} />
      <Circle cx="55"  cy="78" r="4.5" fill={a} />
      <Circle cx="125" cy="78" r="4.5" fill={a} />
      <Circle cx="35"  cy="46" r="4"   fill={a} />
      <Circle cx="70"  cy="46" r="4"   fill={a} />
      <Circle cx="110" cy="46" r="4"   fill={a} />
      <Circle cx="145" cy="46" r="4"   fill={a} />

      {/* ── Outline nodes (ancestors not yet discovered) ── */}
      <Circle cx="22"  cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="48"  cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="83"  cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
      <Circle cx="132" cy="18" r="3.5" fill="none" stroke={a} strokeWidth={1.2} />
    </Svg>
  )
}
