import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, springs } from '../theme';

/** Onboarding progress: the current step stretches into a pill. */
export function ProgressDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} done={i < index} />
      ))}
    </View>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const w = useSharedValue(active ? 28 : 10);
  useEffect(() => {
    w.value = withSpring(active ? 28 : 10, springs.bouncy);
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active ? colors.green.base : done ? colors.green.dark : colors.sand },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.ink },
});
