import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Initial-in-a-circle avatar. `stack` overlaps a row of them. */
export function Avatar({ name, color, size = 32, label }: { name: string; color: string; size?: number; label?: string }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.letter, { fontSize: size * (label ? 0.36 : 0.45), color: label ? colors.ink : colors.white }]}>
        {label ?? name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function AvatarStack({ people, size = 28, max = 4 }: { people: { name: string; color: string }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((p, i) => (
        <View key={p.name + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
          <Avatar name={p.name} color={p.color} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View style={{ marginLeft: -size * 0.35 }}>
          <Avatar name="more" label={`+${extra}`} color={colors.sand} size={size} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.bold, color: colors.white },
});
