import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ChunkyButton } from '../components/ChunkyButton';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { TrolleyMascot } from '../components/TrolleyMascot';
import { colors, fonts } from '../theme';

export function WelcomeScreen({ onSignUp, onLogIn }: { onSignUp: () => void; onLogIn: () => void }) {
  return (
    <Screen edges={['top', 'bottom']} style={styles.page}>
      <View style={styles.hero}>
        <SpeechBubble text="Next stop: something fun this week!" />
        <TrolleyMascot size={220} mood="happy" />
        <Animated.View entering={FadeInUp.delay(150).duration(250)} style={{ alignItems: 'center' }}>
          <Text style={styles.brand}>
            Wheahs <Text style={{ color: colors.green.base }}>It</Text> At
          </Text>
          <Text style={styles.tag}>Swipe through what's happening in Boston.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(300).duration(250)} style={styles.actions}>
        <ChunkyButton label="Let's ride →" variant="green" size="lg" onPress={onSignUp} />
        <ChunkyButton label="I already have an account" variant="paper" onPress={onLogIn} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'space-between', paddingBottom: 12 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  brand: { fontFamily: fonts.bold, fontSize: 42, color: colors.ink, letterSpacing: -0.5 },
  tag: { fontFamily: fonts.medium, fontSize: 17, color: colors.inkSoft, textAlign: 'center' },
  actions: { gap: 12 },
});
