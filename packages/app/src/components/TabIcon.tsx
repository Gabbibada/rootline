import React from 'react'
import Svg, { Path, Circle, Line } from 'react-native-svg'

type IconName = 'home'|'tree'|'family'|'profile'
interface Props { name: IconName; color: string; focused: boolean; size?: number }

export function TabIcon({ name, color, focused, size = 22 }: Props) {
  const w = focused ? 1.8 : 1.4
  switch (name) {
    case 'home':    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/><Path d="M9 22V12h6v10" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/></Svg>
    case 'tree':    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Line x1="12" y1="20" x2="12" y2="10" stroke={color} strokeWidth={w} strokeLinecap="round"/><Path d="M5 20v-6M12 10V4M19 20v-3" stroke={color} strokeWidth={w} strokeLinecap="round"/><Circle cx="12" cy="6" r="2" stroke={color} strokeWidth={w}/><Circle cx="5" cy="14" r="2" stroke={color} strokeWidth={w}/><Circle cx="19" cy="17" r="2" stroke={color} strokeWidth={w}/></Svg>
    case 'family':  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={w} strokeLinecap="round"/><Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={w}/><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>
    case 'profile': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={w}/><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>
  }
}
