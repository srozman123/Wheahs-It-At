import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { useAppState } from '../hooks/useAppState';
import { colors, fonts, springs } from '../theme';

const META: Record<string, { icon: IconName; label: string; color: string }> = {
  Feed: { icon: 'cards', label: 'Feed', color: colors.green.base },
  Saved: { icon: 'bookmark', label: 'Saved', color: colors.blue.base },
  Post: { icon: 'plus', label: 'Post', color: colors.orange.base },
  Going: { icon: 'ticket', label: 'Going', color: colors.red.base },
  Friends: { icon: 'friends', label: 'Friends', color: colors.purple.base },
};

/** Floating, outlined tab bar with a raised orange "Post" button in the middle. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { swipes, friends } = useAppState();
  const savedCount = Object.values(swipes).filter((a) => a === 'save').length;
  const requests = friends.filter((f) => f.status === 'incoming').length;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const meta = META[route.name];
          const badge = route.name === 'Saved' ? savedCount : route.name === 'Friends' ? requests : 0;
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (route.name === 'Post') {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.postSlot} accessibilityLabel="Post an event">
                {({ pressed }) => (
                  <View style={[styles.postBtn, pressed && { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } }]}>
                    <Icon name="plus" size={30} color={colors.white} />
                  </View>
                )}
              </Pressable>
            );
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
              <TabIcon focused={focused} icon={meta.icon} color={meta.color} />
              <Text style={[styles.label, focused && { color: colors.ink, fontFamily: fonts.bold }]}>{meta.label}</Text>
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ focused, icon, color }: { focused: boolean; icon: IconName; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(focused ? -3 : 0, springs.bouncy) }, { scale: withSpring(focused ? 1.12 : 1, springs.bouncy) }],
  }));
  return (
    <Animated.View style={[styles.iconPill, focused && { backgroundColor: color }, style]}>
      <Icon name={icon} size={24} color={focused ? colors.white : colors.inkSoft} filled={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 26,
    height: 70,
    paddingHorizontal: 6,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  iconPill: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkSoft },
  postSlot: { flex: 1, alignItems: 'center' },
  postBtn: {
    width: 62,
    height: 62,
    marginTop: -30,
    borderRadius: 31,
    backgroundColor: colors.orange.base,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orange.dark,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    transform: [{ rotate: '-4deg' }],
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.red.base,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
});
