import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft, ZoomIn } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { ChunkyButton } from '../components/ChunkyButton';
import { InterestBubble } from '../components/InterestBubble';
import { ProgressDots } from '../components/ProgressDots';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { SwipeCard, type DeckAction, type SwipeCardHandle } from '../components/SwipeCard';
import { TextField } from '../components/TextField';
import { TrolleyMascot } from '../components/TrolleyMascot';
import type { Card, ContactKind } from '../api';
import { ApiError } from '../api';
import { useSession } from '../hooks/useSession';
import { useTags } from '../theme/tags';
import { actionColor, colors, fonts } from '../theme';

const MIN_INTERESTS = 3;

export function OnboardingScreen() {
  const { updateProfile } = useSession();
  const [step, setStep] = useState(0);
  const [contactKind, setContactKind] = useState<ContactKind>('instagram');
  const [contact, setContact] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Saving interests flips `onboarded`, and the navigator then swaps this screen out.
  const finish = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ contacts: { [contactKind]: contact.trim() }, interests });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your profile. Try again.');
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <ProgressDots count={3} index={step} />
        <Text style={styles.stepLabel}>Stop {step + 1} of 3</Text>
      </View>

      {step === 0 && (
        <StepWho
          contactKind={contactKind}
          setContactKind={setContactKind}
          contact={contact}
          setContact={setContact}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <StepInterests
          interests={interests}
          toggle={(id) => setInterests((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && <StepTutorial onDone={finish} saving={saving} error={error} />}
    </Screen>
  );
}

/* ───────────── Step 1: who are you ───────────── */

const CONTACTS: { kind: ContactKind; label: string; placeholder: string }[] = [
  { kind: 'instagram', label: 'Instagram', placeholder: '@yourhandle' },
  { kind: 'snapchat', label: 'Snapchat', placeholder: 'username' },
  { kind: 'phone', label: 'Phone', placeholder: '617-555-0123' },
  { kind: 'email', label: 'Email', placeholder: 'you@email.com' },
];

function StepWho(props: {
  contactKind: ContactKind;
  setContactKind: (k: ContactKind) => void;
  contact: string;
  setContact: (s: string) => void;
  onNext: () => void;
}) {
  const current = CONTACTS.find((c) => c.kind === props.contactKind)!;
  const ready = props.contact.trim().length > 0;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Animated.View entering={FadeInRight.duration(250)} exiting={FadeOutLeft} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepBody} keyboardShouldPersistTaps="handled">
          <View style={styles.mascotRow}>
            <TrolleyMascot size={96} mood="wink" />
            <SpeechBubble text="How can friends reach you?" style={{ flex: 1 }} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Pick one to share with friends</Text>
            <View style={styles.chips}>
              {CONTACTS.map((c) => {
                const on = c.kind === props.contactKind;
                return (
                  <Pressable
                    key={c.kind}
                    onPress={() => props.setContactKind(c.kind)}
                    style={[styles.chip, on && { backgroundColor: colors.ink }]}
                  >
                    <Text style={[styles.chipText, on && { color: colors.cream }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              placeholder={current.placeholder}
              value={props.contact}
              onChangeText={props.setContact}
              autoCapitalize="none"
              keyboardType={props.contactKind === 'phone' ? 'phone-pad' : props.contactKind === 'email' ? 'email-address' : 'default'}
            />
            <Text style={styles.note}>🔒 Only friends you accept can see this. You can add more later.</Text>
          </View>
        </ScrollView>
        <ChunkyButton label="Next stop →" variant="green" disabled={!ready} onPress={props.onNext} />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/* ───────────── Step 2: interest bubbles ───────────── */

function StepInterests({ interests, toggle, onNext }: { interests: string[]; toggle: (id: string) => void; onNext: () => void }) {
  const TAGS = useTags();
  const left = MIN_INTERESTS - interests.length;
  const bubbleText =
    interests.length === 0 ? "What are you into? Tap a few!" : left > 0 ? `Nice! ${left} more…` : 'Ooh, great taste 😎';
  return (
    <Animated.View entering={FadeInRight.duration(250)} exiting={FadeOutLeft} style={{ flex: 1 }}>
      <View style={styles.mascotRow}>
        <TrolleyMascot size={96} mood={left > 0 ? 'happy' : 'excited'} />
        <SpeechBubble text={bubbleText} style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={styles.bubbles} showsVerticalScrollIndicator={false}>
        {TAGS.map((t, i) => (
          <InterestBubble
            key={t.id}
            index={i}
            label={t.label}
            emoji={t.emoji}
            color={t.color}
            selected={interests.includes(t.id)}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </ScrollView>
      <ChunkyButton
        label={left > 0 ? `Pick ${left} more` : `Next stop → (${interests.length} picked)`}
        variant="green"
        disabled={left > 0}
        onPress={onNext}
      />
    </Animated.View>
  );
}

/* ───────────── Step 3: learn the swipe by doing it ───────────── */

const PRACTICE_EVENT: Card = {
  id: 'practice',
  title: 'Practice Ride 🚋',
  description: 'This is a practice card. Flip it, swipe it, have fun with it.',
  tags: ['outdoors', 'networking'],
  startsAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  location: 'Park Street',
  lat: null,
  lng: null,
  imageUrl: null,
  sourceUrl: null,
  priceMin: 0,
  priceMax: 0,
  creatorId: null,
  friendsGoing: 0,
  expired: false,
};

const LESSONS: { action: DeckAction; arrow: string; text: string }[] = [
  { action: 'pass', arrow: '←', text: 'Swipe left to Pass' },
  { action: 'save', arrow: '→', text: 'Swipe right to Save' },
  { action: 'going', arrow: '↑', text: "Swipe up if you're Going" },
];

function StepTutorial({ onDone, saving, error }: { onDone: () => void; saving: boolean; error: string | null }) {
  const { width } = useWindowDimensions();
  const [done, setDone] = useState<DeckAction[]>([]);
  const [round, setRound] = useState(0);
  const progress = useSharedValue(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  const next = LESSONS.find((l) => !done.includes(l.action));
  const allDone = !next;

  const record = (action: DeckAction) => {
    setDone((d) => (d.includes(action) ? d : [...d, action]));
    progress.value = 0;
    setRound((r) => r + 1); // deal a fresh practice card
  };

  const cardW = Math.min(width - 72, 320);
  const cardH = Math.round(cardW * 1.2);

  return (
    <Animated.View entering={FadeInRight.duration(250)} style={{ flex: 1 }}>
      <View style={styles.mascotRow}>
        <TrolleyMascot size={96} mood={allDone ? 'excited' : 'peek'} />
        <SpeechBubble text={allDone ? "You're a pro! Let's go 🎉" : `${next.arrow}  ${next.text}`} style={{ flex: 1 }} />
      </View>

      <View style={styles.checklist}>
        {LESSONS.map((l) => {
          const ok = done.includes(l.action);
          const c = actionColor[l.action];
          return (
            <View key={l.action} style={[styles.check, { borderColor: ok ? c.dark : colors.ink, backgroundColor: ok ? c.soft : colors.paper }]}>
              <Text style={[styles.checkText, { color: ok ? c.dark : colors.ink }]}>
                {ok ? '✓' : l.arrow} {l.action === 'pass' ? 'Pass' : l.action === 'save' ? 'Save' : 'Going'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.practiceArea}>
        {allDone ? (
          <Animated.View entering={ZoomIn.duration(250)} style={{ alignItems: 'center', gap: 8 }}>
            <TrolleyMascot size={180} mood="excited" sign="LET'S GO" />
          </Animated.View>
        ) : (
          <Animated.View key={round} entering={FadeIn.duration(250)}>
            <SwipeCard
              ref={cardRef}
              event={PRACTICE_EVENT}
              width={cardW}
              height={cardH}
              progress={progress}
              onCommit={record}
              // no confirmation needed in practice — just send it up
              onRequestGoing={() => cardRef.current?.fling('going')}
            />
          </Animated.View>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ChunkyButton
        label={saving ? 'Saving…' : allDone ? 'Start swiping!' : 'Skip tutorial'}
        variant={allDone ? 'green' : 'paper'}
        size={allDone ? 'lg' : 'sm'}
        disabled={saving}
        onPress={onDone}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 12 },
  stepLabel: { fontFamily: fonts.pencil, fontSize: 18, color: colors.inkSoft },
  stepBody: { gap: 18, paddingBottom: 24 },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.paper,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.red.dark, textAlign: 'center', marginBottom: 8 },
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 8, paddingBottom: 24 },
  checklist: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  check: { borderWidth: 2.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  checkText: { fontFamily: fonts.bold, fontSize: 14 },
  practiceArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
