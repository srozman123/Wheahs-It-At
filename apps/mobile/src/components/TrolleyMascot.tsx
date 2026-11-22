import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts, springs } from '../theme';

export type Mood = 'happy' | 'excited' | 'peek' | 'sleepy' | 'oops' | 'wink';

type Props = {
  size?: number;
  mood?: Mood;
  /** Text on the little destination sign above the windshield. */
  sign?: string;
  /** Gentle rocking, like a trolley idling at the stop. */
  idle?: boolean;
};

const INK = colors.ink;
const BODY = colors.green.base;
const BODY_DARK = colors.green.dark;

/**
 * "Woody" (working name) — our original Green Line–style trolley mascot.
 * Drawn entirely in SVG so it scales crisply and its face can change.
 */
export function TrolleyMascot({ size = 160, mood = 'happy', sign = 'WHEAHS', idle = true }: Props) {
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!idle) return;
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [idle, bob]);

  // Little bounce whenever the mood changes.
  useEffect(() => {
    pop.value = withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, springs.bouncy));
  }, [mood, pop]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * bob.value },
      { rotate: `${(bob.value - 0.5) * 3}deg` },
      { scale: pop.value },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size * 0.95 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 190">
        {/* track */}
        <Line x1="6" y1="178" x2="194" y2="178" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        {[24, 60, 96, 132, 168].map((x) => (
          <Rect key={x} x={x} y={176} width={12} height={8} rx={2} fill={INK} />
        ))}

        {/* pantograph (the arm that touches the overhead wire) */}
        <Path d="M100 30 L84 14 L100 2 L116 14 Z" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <Line x1="78" y1="3" x2="122" y2="3" stroke={INK} strokeWidth={4} strokeLinecap="round" />

        {/* destination sign */}
        <Rect x="62" y="26" width="76" height="20" rx="6" fill={INK} />
        <SvgText
          x="100"
          y="41"
          fontSize={sign.length > 7 ? 11 : 13}
          fontFamily={fonts.bold}
          fill={colors.yellow.base}
          textAnchor="middle"
          letterSpacing={sign.length > 7 ? 0.5 : 1}
        >
          {sign}
        </SvgText>

        {/* roof */}
        <Rect x="30" y="42" width="140" height="16" rx="8" fill={BODY_DARK} stroke={INK} strokeWidth={4} />

        {/* body */}
        <Rect x="20" y="52" width="160" height="104" rx="24" fill={BODY} stroke={INK} strokeWidth={4} />
        {/* cream belt line */}
        <Rect x="22" y="122" width="156" height="12" fill={colors.cream} />
        <Line x1="22" y1="122" x2="178" y2="122" stroke={INK} strokeWidth={3} />
        <Line x1="22" y1="134" x2="178" y2="134" stroke={INK} strokeWidth={3} />

        {/* windshield = face */}
        <Rect x="40" y="64" width="120" height="52" rx="16" fill={colors.paper} stroke={INK} strokeWidth={4} />
        {/* windshield glare */}
        <Path d="M50 72 Q56 68 64 68" stroke={colors.sand} strokeWidth={4} strokeLinecap="round" fill="none" />

        <Face mood={mood} />

        {/* headlights */}
        <Circle cx="40" cy="145" r="7" fill={colors.yellow.base} stroke={INK} strokeWidth={3} />
        <Circle cx="160" cy="145" r="7" fill={colors.yellow.base} stroke={INK} strokeWidth={3} />

        {/* bumper */}
        <Rect x="34" y="152" width="132" height="9" rx="4.5" fill={INK} />

        {/* wheels */}
        <G>
          <Circle cx="62" cy="166" r="12" fill={INK} />
          <Circle cx="62" cy="166" r="4.5" fill={colors.inkFaint} />
          <Circle cx="138" cy="166" r="12" fill={INK} />
          <Circle cx="138" cy="166" r="4.5" fill={colors.inkFaint} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function Face({ mood }: { mood: Mood }) {
  const cheeks = (
    <>
      <Ellipse cx="60" cy="102" rx="8" ry="5" fill={colors.cheek} opacity={0.8} />
      <Ellipse cx="140" cy="102" rx="8" ry="5" fill={colors.cheek} opacity={0.8} />
    </>
  );

  switch (mood) {
    case 'excited':
      return (
        <G>
          {/* ^ ^ eyes */}
          <Path d="M70 90 L78 81 L86 90" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M114 90 L122 81 L130 90" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {cheeks}
          <Path d="M88 96 Q100 114 112 96 Z" fill={colors.red.base} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </G>
      );
    case 'peek':
      // Looking down at what you're typing.
      return (
        <G>
          <Circle cx="78" cy="88" r="8" fill={INK} />
          <Circle cx="122" cy="88" r="8" fill={INK} />
          <Circle cx="80" cy="91" r="2.5" fill={colors.white} />
          <Circle cx="124" cy="91" r="2.5" fill={colors.white} />
          {cheeks}
          <Circle cx="100" cy="105" r="4" fill={INK} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M70 86 Q78 92 86 86" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
          <Path d="M114 86 Q122 92 130 86" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
          {cheeks}
          <Ellipse cx="100" cy="103" rx="5" ry="4" fill={INK} />
          <SvgText x="150" y="40" fontSize="18" fontFamily={fonts.bold} fill={INK}>z</SvgText>
          <SvgText x="164" y="26" fontSize="13" fontFamily={fonts.bold} fill={INK}>z</SvgText>
        </G>
      );
    case 'oops':
      return (
        <G>
          <Circle cx="78" cy="85" r="7" fill={INK} />
          <Circle cx="122" cy="85" r="7" fill={INK} />
          <Path d="M68 74 L86 78" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <Path d="M132 74 L114 78" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          {cheeks}
          <Path d="M88 106 Q100 96 112 106" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'wink':
      return (
        <G>
          <Circle cx="78" cy="85" r="7.5" fill={INK} />
          <Circle cx="80" cy="82" r="2.5" fill={colors.white} />
          <Path d="M114 86 Q122 80 130 86" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
          {cheeks}
          <Path d="M88 98 Q100 110 112 98" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'happy':
    default:
      return (
        <G>
          <Circle cx="78" cy="85" r="7.5" fill={INK} />
          <Circle cx="122" cy="85" r="7.5" fill={INK} />
          <Circle cx="80" cy="82" r="2.5" fill={colors.white} />
          <Circle cx="124" cy="82" r="2.5" fill={colors.white} />
          {cheeks}
          <Path d="M88 98 Q100 110 112 98" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}
