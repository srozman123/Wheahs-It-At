import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Event } from '../mocks/types';
import { actionColor, FLIP_DURATION, fonts, springs } from '../theme';
import { EventCard } from './EventCard';

export type DeckAction = 'pass' | 'save' | 'going';

export type SwipeCardHandle = {
  /** Animate the card off-screen as if swiped, then commit the action. */
  fling: (action: DeckAction) => void;
};

type Props = {
  event: Event;
  width: number;
  height: number;
  /** 0 → 1 as the card is dragged away; the deck uses it to grow the next card. */
  progress: SharedValue<number>;
  onCommit: (action: DeckAction) => void;
  /** Swiping up asks for confirmation instead of committing straight away. */
  onRequestGoing: () => void;
};

const THRESHOLD = 110;
const VELOCITY = 900;

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { event, width, height, progress, onCommit, onRequestGoing },
  ref,
) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const flip = useSharedValue(0);

  const flyTo = (action: DeckAction) => {
    'worklet';
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onCommit, action);
    };
    progress.value = withTiming(1, { duration: 240 });
    if (action === 'pass') {
      tx.value = withTiming(-screenW * 1.5, { duration: 260 }, done);
    } else if (action === 'save') {
      tx.value = withTiming(screenW * 1.5, { duration: 260 }, done);
    } else {
      tx.value = withTiming(0, { duration: 260 });
      ty.value = withTiming(-screenH, { duration: 300 }, done);
    }
  };

  useImperativeHandle(ref, () => ({ fling: (action) => flyTo(action) }));

  const springBack = () => {
    'worklet';
    tx.value = withSpring(0, springs.settle);
    ty.value = withSpring(0, springs.settle);
    progress.value = withSpring(0, springs.settle);
  };

  const pan = usePanGesture({
    // big enough that a tap never turns into a tiny drag (which caused the wobble on press)
    minDistance: 14,
    onUpdate: (e) => {
      'worklet';
      tx.value = e.translationX;
      // a little resistance when dragging downward — down means nothing
      ty.value = e.translationY > 0 ? e.translationY * 0.25 : e.translationY;
      progress.value = Math.min(1, Math.hypot(tx.value, ty.value) / (THRESHOLD * 1.6));
    },
    onDeactivate: (e) => {
      'worklet';
      const goingUp = -e.translationY > Math.abs(e.translationX);
      if (goingUp && (e.translationY < -THRESHOLD || e.velocityY < -VELOCITY)) {
        springBack();
        scheduleOnRN(onRequestGoing);
      } else if (!goingUp && (e.translationX > THRESHOLD || e.velocityX > VELOCITY)) {
        flyTo('save');
      } else if (!goingUp && (e.translationX < -THRESHOLD || e.velocityX < -VELOCITY)) {
        flyTo('pass');
      } else {
        springBack();
      }
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION, easing: Easing.inOut(Easing.cubic) });
    },
  });

  const gesture = useCompetingGestures(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-screenW, screenW], [-16, 16])}deg` },
    ],
  }));

  // Stamps fade in as you drag toward each direction.
  const passStamp = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) * (-ty.value > Math.abs(tx.value) ? 0 : 1),
  }));
  const saveStamp = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) * (-ty.value > Math.abs(tx.value) ? 0 : 1),
  }));
  const goingStamp = useAnimatedStyle(() => ({
    opacity: interpolate(-ty.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) * (-ty.value > Math.abs(tx.value) ? 1 : 0),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, cardStyle]}>
        <EventCard event={event} width={width} height={height} flip={flip} />

        <Animated.View style={[styles.stamp, styles.stampRight, { borderColor: actionColor.pass.base }, passStamp]}>
          <Text style={[styles.stampText, { color: actionColor.pass.base }]}>NOPE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampLeft, { borderColor: actionColor.save.base }, saveStamp]}>
          <Text style={[styles.stampText, { color: actionColor.save.base }]}>SAVED</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampBottom, { borderColor: actionColor.going.base }, goingStamp]}>
          <Text style={[styles.stampText, { color: actionColor.going.base }]}>I'M GOING!</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    borderWidth: 5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,253,248,0.92)',
  },
  stampLeft: { top: 40, left: 24, transform: [{ rotate: '-14deg' }] },
  stampRight: { top: 40, right: 24, transform: [{ rotate: '14deg' }] },
  stampBottom: { bottom: 120, alignSelf: 'center', transform: [{ rotate: '-6deg' }] },
  stampText: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: 2 },
});
