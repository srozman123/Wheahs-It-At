import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { ChunkyButton } from '../components/ChunkyButton';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { TextField } from '../components/TextField';
import { TrolleyMascot, type Mood } from '../components/TrolleyMascot';
import { useAppState } from '../hooks/useAppState';
import { colors, fonts, outline } from '../theme';

type Mode = 'signup' | 'login';

export function AuthScreen({ initialMode, onBack }: { initialMode: Mode; onBack: () => void }) {
  const { signUp, logIn } = useAppState();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shake = useSharedValue(0);

  const mood: Mood = error ? 'oops' : focus === 'password' ? 'sleepy' : focus === 'email' ? 'peek' : 'happy';
  const line = error
    ? error
    : focus === 'password'
      ? "I'm not looking, promise 🙈"
      : focus === 'email'
        ? 'Ooh, what\'s your email?'
        : mode === 'signup'
          ? 'Welcome aboard!'
          : 'Welcome back, rider!';

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Mock auth: any valid-looking email + 6-char password works. Swap for src/api/auth later.
  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Hmm, that email doesn't look right.");
    if (password.length < 6) return fail('Password needs 6+ characters.');
    setError(null);
    if (mode === 'signup') signUp(email);
    else logIn(email);
  };

  const fail = (msg: string) => {
    setError(msg);
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
            <Icon name="back" size={24} />
          </Pressable>

          <View style={styles.mascot}>
            <SpeechBubble text={line} />
            <TrolleyMascot size={150} mood={mood} />
          </View>

          <Animated.View style={[styles.card, cardStyle]}>
            <View style={styles.toggle}>
              {(['signup', 'login'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  style={[styles.toggleBtn, mode === m && styles.toggleOn]}
                >
                  <Text style={[styles.toggleText, mode === m && { color: colors.white }]}>
                    {m === 'signup' ? 'Sign up' : 'Log in'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextField
              label="Email"
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
            />
            <TextField
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              onSubmitEditing={submit}
            />
            <ChunkyButton
              label={mode === 'signup' ? 'Create account' : 'Log in'}
              variant={mode === 'signup' ? 'green' : 'blue'}
              onPress={submit}
              style={{ marginTop: 6 }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24, gap: 12 },
  back: {
    position: 'absolute',
    top: 4,
    left: 0,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: { alignItems: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.paper,
    borderWidth: outline,
    borderColor: colors.ink,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.sand,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: colors.ink,
    padding: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  toggleOn: { backgroundColor: colors.ink },
  toggleText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});
