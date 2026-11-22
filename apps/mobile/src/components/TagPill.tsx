import { StyleSheet, Text, View } from 'react-native';
import { getTag } from '../theme/tags';
import { colors, fonts, line } from '../theme';

/** Small colored tag on cards. Same color as the matching onboarding bubble. */
export function TagPill({ tag, compact }: { tag: string; compact?: boolean }) {
  const t = getTag(tag);
  const c = line[t.color];
  return (
    <View style={[styles.pill, { backgroundColor: c.soft, borderColor: c.dark }, compact && styles.compact]}>
      <Text style={[styles.text, { color: c.dark }, compact && { fontSize: 12 }]}>
        {t.emoji} {t.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
