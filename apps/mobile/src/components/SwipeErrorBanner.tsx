import { Pressable, StyleSheet, Text } from 'react-native';
import { useLibrary } from '../hooks/useLibrary';
import { colors, fonts } from '../theme';

/** Dismissible banner for a failed swipe (the library has already reverted it). */
export function SwipeErrorBanner() {
  const { error, clearError } = useLibrary();
  if (!error) return null;
  return (
    <Pressable onPress={clearError} style={styles.banner}>
      <Text style={styles.text}>{error} (tap to dismiss)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.red.soft, borderWidth: 2.5, borderColor: colors.red.dark, borderRadius: 14, padding: 8, marginBottom: 8 },
  text: { fontFamily: fonts.medium, fontSize: 13, color: colors.red.dark },
});
