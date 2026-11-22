import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, outline, radius } from '../theme';

type Props = TextInputProps & { label?: string };

/** Outlined input that lights up orange when focused. */
export function TextField({ label, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  input: {
    height: 52,
    borderWidth: outline,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  focused: { borderColor: colors.orange.base, backgroundColor: colors.white },
});
