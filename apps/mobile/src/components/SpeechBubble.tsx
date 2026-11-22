import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

/** What the trolley is "saying". Re-mounts (and re-pops) whenever `text` changes. */
export function SpeechBubble({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View key={text} entering={ZoomIn.duration(220)} style={[styles.wrap, style]}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 280,
  },
  text: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  tail: {
    width: 16,
    height: 16,
    backgroundColor: colors.paper,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    transform: [{ rotate: '45deg' }],
    marginTop: -9,
  },
});
