import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName = 'cards' | 'bookmark' | 'ticket' | 'friends' | 'plus' | 'x' | 'check' | 'star' | 'pin' | 'clock' | 'link' | 'back';

/** Hand-drawn-ish line icons with the same thick rounded stroke as everything else. */
export function Icon({ name, size = 26, color = colors.ink, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const p = { stroke: color, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'cards' && (
        <>
          <Rect x="7" y="3" width="12" height="16" rx="3" {...p} fill={fill} transform="rotate(8 13 11)" />
          <Rect x="4" y="5" width="12" height="16" rx="3" {...p} fill={filled ? colors.paper : 'none'} />
        </>
      )}
      {name === 'bookmark' && <Path d="M6 3h12v18l-6-4-6 4z" {...p} fill={fill} />}
      {name === 'ticket' && (
        <Path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z M14 6v12" {...p} fill={fill} />
      )}
      {name === 'friends' && (
        <>
          <Circle cx="9" cy="8" r="3.5" {...p} fill={fill} />
          <Path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" {...p} fill={fill} />
          <Circle cx="17" cy="9" r="2.6" {...p} />
          <Path d="M17 14.5c2.4 0 4 1.4 4.5 4" {...p} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} strokeWidth={3.2} />}
      {name === 'x' && <Path d="M6 6l12 12M18 6L6 18" {...p} strokeWidth={3} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7" {...p} strokeWidth={3} />}
      {name === 'star' && (
        <Path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" {...p} fill={fill} />
      )}
      {name === 'pin' && (
        <>
          <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...p} fill={fill} />
          <Circle cx="12" cy="9.5" r="2.5" {...p} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} fill={fill} />
          <Path d="M12 7.5V12l3 2" {...p} />
        </>
      )}
      {name === 'link' && <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...p} />}
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...p} strokeWidth={3} />}
    </Svg>
  );
}
