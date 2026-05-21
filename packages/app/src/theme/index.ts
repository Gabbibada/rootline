export const Colors = {
  bark: '#1C1008', bark2: '#2C1A0E', bark3: '#3A2218',
  amber: '#B07D4A', amberLight: '#C89560',
  sand: '#E8C99A', cream: '#F7F0E6', cream2: '#EDE4D8',
  forest: '#3A6B47', forestLight: '#4A7C59',
  textDark: '#1C1008', textMid: '#7A5C3A', textMuted: '#A8906F', textOnDark: '#E8C99A',
  error: '#C8503C', success: '#3A6B47', warning: '#C9973A',
  surface: '#F7F0E6', surfaceAlt: '#EDE4D8',
  border: 'rgba(176,125,74,0.25)', borderFaint: 'rgba(176,125,74,0.12)',
} as const

export const Typography = {
  display:   { fontFamily: 'CormorantGaramond-Medium',  fontSize: 36, lineHeight: 42 },
  heading1:  { fontFamily: 'CormorantGaramond-Medium',  fontSize: 28, lineHeight: 34 },
  heading2:  { fontFamily: 'CormorantGaramond-Medium',  fontSize: 22, lineHeight: 28 },
  nameTag:   { fontFamily: 'CormorantGaramond-Medium',  fontSize: 18, lineHeight: 22 },
  body:      { fontFamily: 'DMSans-Regular',            fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: 'DMSans-Regular',            fontSize: 13, lineHeight: 18 },
  label:     { fontFamily: 'DMSans-Medium',             fontSize: 13, lineHeight: 16 },
  caption:   { fontFamily: 'DMSans-Regular',            fontSize: 11, lineHeight: 14 },
  mono:      { fontFamily: 'IBMPlexMono-Regular',       fontSize: 10, lineHeight: 14, letterSpacing: 0.8 },
} as const

export const Spacing  = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48 } as const
export const Radius   = { sm:6, md:10, lg:14, xl:20, full:999 } as const
export const Shadow   = {
  card:   { shadowColor:'#1C1008', shadowOffset:{width:0,height:2},  shadowOpacity:0.08, shadowRadius:8,  elevation:3 },
  strong: { shadowColor:'#1C1008', shadowOffset:{width:0,height:8},  shadowOpacity:0.18, shadowRadius:24, elevation:8 },
} as const
