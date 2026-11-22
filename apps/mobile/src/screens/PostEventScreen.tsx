import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { ChunkyButton } from '../components/ChunkyButton';
import { EventCard } from '../components/EventCard';
import { InterestBubble } from '../components/InterestBubble';
import { ProgressDots } from '../components/ProgressDots';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { TextField } from '../components/TextField';
import { TrolleyMascot } from '../components/TrolleyMascot';
import type { Card } from '../api';
import { usePostEvent } from '../hooks/usePostEvent';
import { useTags } from '../theme/tags';
import { colors, fonts } from '../theme';

const STEPS = ['What', 'When & where', 'Vibe', 'Preview'];
const TIMES = [
  { label: 'Morning', h: 10 },
  { label: 'Afternoon', h: 14 },
  { label: 'Evening', h: 18 },
  { label: 'Night', h: 21 },
];
const MAX_TAGS = 3;

/** A time slot is open unless it's already past today. */
function slotOpen(dayOffset: number, hour: number) {
  return dayOffset > 0 || hour > new Date().getHours();
}

function nextDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { offset: i, label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.getDate() };
  });
}

export function PostEventScreen({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const TAGS = useTags();
  const { post, posting, error, clearError } = usePostEvent();
  const [step, setStep] = useState(0);
  const [posted, setPosted] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const firstDay = TIMES.some((t) => slotOpen(0, t.h)) ? 0 : 1;
  const [day, setDay] = useState(firstDay);
  const [time, setTime] = useState((TIMES.find((t) => slotOpen(firstDay, t.h)) ?? TIMES[0]).h);
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [free, setFree] = useState(true);
  const [price, setPrice] = useState('');

  const startsAtDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + day);
    d.setHours(time, 0, 0, 0);
    return d;
  })();
  const startsAt = startsAtDate.toISOString();

  const pickDay = (offset: number) => {
    setDay(offset);
    if (!slotOpen(offset, time)) setTime((TIMES.find((t) => slotOpen(offset, t.h)) ?? TIMES[0]).h);
  };

  const draft: Card = {
    id: 'draft',
    title: title.trim() || 'Your event',
    description: description.trim() || 'No description yet.',
    tags,
    startsAt,
    location: location.trim() || 'Somewhere in Boston',
    lat: null,
    lng: null,
    imageUrl: null,
    sourceUrl: null,
    priceMin: free ? 0 : Number(price) || null,
    priceMax: free ? 0 : Number(price) || null,
    creatorId: null,
    friendsGoing: 0,
    expired: false,
  };

  const canNext = [title.trim().length > 2, location.trim().length > 1, tags.length > 0, true][step];

  const reset = () => {
    setStep(0);
    setPosted(false);
    setTitle('');
    setDescription('');
    setLocation('');
    clearError();
    setTags([]);
    setFree(true);
    setPrice('');
  };

  if (posted) {
    return (
      <Screen style={styles.center}>
        <Animated.View entering={ZoomIn.duration(250)} style={{ alignItems: 'center', gap: 8 }}>
          <SpeechBubble text="Posted! It's in everyone's feed now 🚀" />
          <TrolleyMascot size={200} mood="excited" sign="POSTED" />
          <ChunkyButton label="Back to swiping" variant="green" onPress={() => { reset(); onDone(); }} style={{ alignSelf: 'stretch', marginTop: 12 }} />
          <ChunkyButton label="Post another" variant="paper" size="sm" onPress={reset} style={{ alignSelf: 'stretch' }} />
        </Animated.View>
      </Screen>
    );
  }

  const cardW = Math.min(width - 60, 340);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text style={styles.title}>Post an event</Text>
          <ProgressDots count={STEPS.length} index={step} />
        </View>
        <Text style={styles.stepName}>{STEPS[step]}</Text>

        <ScrollView key={step} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInRight.duration(250)} style={{ gap: 16 }}>
            {step === 0 && (
              <>
                <TextField label="Event name" placeholder="Rooftop jam session" value={title} onChangeText={setTitle} />
                <TextField
                  label="What's the plan?"
                  placeholder="Tell people what to expect…"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }}
                />
              </>
            )}

            {step === 1 && (
              <>
                <Text style={styles.label}>Day</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {nextDays().map((d) => (
                    <Pressable
                      key={d.offset}
                      disabled={!TIMES.some((t) => slotOpen(d.offset, t.h))}
                      onPress={() => pickDay(d.offset)}
                      style={[styles.dayChip, day === d.offset && styles.chipOn, !TIMES.some((t) => slotOpen(d.offset, t.h)) && styles.disabled]}
                    >
                      <Text style={[styles.dayLabel, day === d.offset && styles.chipOnText]}>{d.label}</Text>
                      <Text style={[styles.dayNum, day === d.offset && styles.chipOnText]}>{d.date}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>Time</Text>
                <View style={styles.wrapRow}>
                  {TIMES.map((t) => (
                    <Pressable
                      key={t.h}
                      disabled={!slotOpen(day, t.h)}
                      onPress={() => setTime(t.h)}
                      style={[styles.chip, time === t.h && styles.chipOn, !slotOpen(day, t.h) && styles.disabled]}
                    >
                      <Text style={[styles.chipText, time === t.h && styles.chipOnText]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextField label="Neighborhood" placeholder="Allston, Back Bay, Somerville…" value={location} onChangeText={setLocation} />
                <Text style={styles.label}>Price</Text>
                <View style={styles.wrapRow}>
                  <Pressable onPress={() => setFree(true)} style={[styles.chip, free && styles.chipOn]}>
                    <Text style={[styles.chipText, free && styles.chipOnText]}>Free</Text>
                  </Pressable>
                  <Pressable onPress={() => setFree(false)} style={[styles.chip, !free && styles.chipOn]}>
                    <Text style={[styles.chipText, !free && styles.chipOnText]}>Paid</Text>
                  </Pressable>
                </View>
                {!free && <TextField placeholder="$ amount" keyboardType="numeric" value={price} onChangeText={setPrice} />}
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.label}>Pick up to {MAX_TAGS} tags so the right people see it</Text>
                <View style={styles.bubbles}>
                  {TAGS.map((t, i) => {
                    const on = tags.includes(t.id);
                    return (
                      <InterestBubble
                        key={t.id}
                        index={i}
                        label={t.label}
                        emoji={t.emoji}
                        color={t.color}
                        selected={on}
                        onToggle={() =>
                          setTags((cur) => (on ? cur.filter((x) => x !== t.id) : cur.length < MAX_TAGS ? [...cur, t.id] : cur))
                        }
                      />
                    );
                  })}
                </View>
              </>
            )}

            {step === 3 && (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Text style={styles.label}>This is how it'll look in people's feeds:</Text>
                <EventCard event={draft} width={cardW} height={cardW * 1.4} />
                {error ? <Text style={[styles.label, { color: colors.red.base }]}>{error}</Text> : null}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.nav}>
          {step > 0 && <ChunkyButton label="←" variant="paper" onPress={() => setStep(step - 1)} style={{ width: 64 }} />}
          <ChunkyButton
            label={step === STEPS.length - 1 ? (posting ? 'Posting…' : 'Post it! 🚀') : 'Next →'}
            variant={step === STEPS.length - 1 ? 'orange' : 'green'}
            disabled={!canNext || posting}
            onPress={() => {
              if (step < STEPS.length - 1) setStep(step + 1);
              else {
                post({ title, description, tags, startsAt: startsAtDate, location, free, price }).then((ok) => ok && setPosted(true));
              }
            }}
            style={{ flex: 1 }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.ink },
  stepName: { fontFamily: fonts.pencil, fontSize: 20, color: colors.inkSoft, marginBottom: 10 },
  body: { paddingBottom: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.paper },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  disabled: { opacity: 0.35 },
  chipOn: { backgroundColor: colors.ink },
  chipOnText: { color: colors.cream },
  dayChip: {
    width: 58,
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  dayLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  dayNum: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nav: { flexDirection: 'row', gap: 10, paddingBottom: 100, paddingTop: 6 },
});
