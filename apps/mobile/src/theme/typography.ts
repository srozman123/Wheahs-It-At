import type { TextStyle } from 'react-native';
import { ink } from './colors';

/** Font family names as registered in App.tsx via useFonts. */
export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
  pencil: 'PatrickHand_400Regular',
} as const;

export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 40, color: ink },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, color: ink },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: ink },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: ink },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: ink },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: ink, letterSpacing: 0.3 },
  pencil: { fontFamily: fonts.pencil, fontSize: 20, lineHeight: 22, color: ink },
} satisfies Record<string, TextStyle>;
