import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts, lift, line, outline, radius, springs, type LineColor } from '../theme';

type Variant = LineColor | 'ink' | 'paper';

const VARIANTS: Record<Variant, { bg: string; edge: string; text: string }> = {
  ...(Object.fromEntries(
    Object.entries(line).map(([k, v]) => [k, { bg: v.base, edge: v.dark, text: k === 'yellow' ? colors.ink : colors.white }]),
  ) as Record<LineColor, { bg: string; edge: string; text: string }>),
  ink: { bg: colors.ink, edge: '#000000', text: colors.cream },
  paper: { bg: colors.paper, edge: colors.ink, text: colors.ink },
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const HEIGHT = { sm: 42, md: 52, lg: 60 };
const FONT = { sm: 15, md: 18, lg: 20 };

/**
 * The signature button: thick ink outline + a solid (unblurred) shadow
 * underneath. Pressing pushes the face down into its shadow.
 */
export function ChunkyButton({ label, onPress, variant = 'green', size = 'md', icon, disabled, style, accessibilityLabel = label }: Props) {
  const v = VARIANTS[variant];
  const press = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * (lift - 1) }],
  }));

  const h = HEIGHT[size];

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 70 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => {
        press.value = withSpring(0, springs.bouncy);
      }}
      onPress={onPress}
      style={[{ height: h + lift, opacity: disabled ? 0.45 : 1 }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* the solid shadow / "edge" */}
      <View style={[styles.base, { height: h, top: lift, backgroundColor: v.edge, borderColor: colors.ink }]} />
      {/* the face */}
      <Animated.View style={[styles.base, styles.face, { height: h, backgroundColor: v.bg, borderColor: colors.ink }, faceStyle]}>
        {icon}
        <Text style={[styles.label, { color: v.text, fontSize: FONT[size] }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.md,
    borderWidth: outline,
  },
  face: {
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
});
