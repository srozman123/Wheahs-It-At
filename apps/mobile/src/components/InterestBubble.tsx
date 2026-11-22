import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, line, springs, type LineColor } from '../theme';

type Props = {
  label: string;
  emoji: string;
  color: LineColor;
  selected: boolean;
  onToggle: () => void;
  /** Index used to stagger the entrance animation. */
  index?: number;
};

/** Tap-to-select interest bubble. Pops and fills with its color when chosen. */
export function InterestBubble({ label, emoji, color, selected, onToggle, index = 0 }: Props) {
  const c = line[color];
  const scale = useSharedValue(1);
  const fill = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(selected ? 1 : 0, { duration: 160 });
  }, [selected, fill]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: fill.value * -2 }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(index * 35).springify()} style={style}>
      <Pressable
        onPress={() => {
          scale.value = withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, springs.bouncy));
          Haptics.selectionAsync().catch(() => {});
          onToggle();
        }}
        style={[
          styles.bubble,
          selected
            ? { backgroundColor: c.base, borderColor: colors.ink, shadowColor: c.dark }
            : { backgroundColor: colors.paper, borderColor: colors.ink, shadowColor: colors.ink },
          // solid offset shadow (iOS) — elevation can't do hard shadows on Android, so we fake it with the border
          { shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: selected ? 4 : 3 } },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.label, { color: selected && color !== 'yellow' ? colors.white : colors.ink }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 3,
  },
  emoji: { fontSize: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 16 },
});
