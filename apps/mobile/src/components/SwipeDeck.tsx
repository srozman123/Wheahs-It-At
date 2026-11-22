import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Event } from '../mocks/types';
import { EventCard } from './EventCard';
import { GoingConfirm } from './GoingConfirm';
import { SwipeCard, type DeckAction, type SwipeCardHandle } from './SwipeCard';

type Props = {
  deck: Event[];
  cardWidth: number;
  cardHeight: number;
  onSwipe: (event: Event, action: DeckAction) => void;
  empty: ReactNode;
};

/**
 * Card stack: the top card is draggable, the two behind it peek out and
 * grow into place as the top one leaves.
 */
export function SwipeDeck({ deck, cardWidth, cardHeight, onSwipe, empty }: Props) {
  const progress = useSharedValue(0);
  const topRef = useRef<SwipeCardHandle>(null);
  const [confirming, setConfirming] = useState<Event | null>(null);

  const top = deck[0];
  const visible = deck.slice(0, 3);

  const commit = (action: DeckAction) => {
    if (!top) return;
    Haptics.notificationAsync(
      action === 'going' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    progress.value = 0;
    onSwipe(top, action);
  };

  return (
    <View style={styles.wrap}>
      <View style={{ width: cardWidth, height: cardHeight + 8 }}>
        {top ? (
          // render back-to-front so the top card is drawn last
          [...visible].reverse().map((event) => {
            const depth = visible.indexOf(event);
            return depth === 0 ? (
              <View key={event.id} style={StyleSheet.absoluteFill}>
                <SwipeCard
                  ref={topRef}
                  event={event}
                  width={cardWidth}
                  height={cardHeight}
                  progress={progress}
                  onCommit={commit}
                  onRequestGoing={() => setConfirming(event)}
                />
              </View>
            ) : (
              <BehindCard key={event.id} depth={depth} progress={progress}>
                <EventCard event={event} width={cardWidth} height={cardHeight} />
              </BehindCard>
            );
          })
        ) : (
          empty
        )}
      </View>

      <GoingConfirm
        event={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          // let the modal close before the card flies up
          setTimeout(() => topRef.current?.fling('going'), 120);
        }}
      />
    </View>
  );
}

function BehindCard({ depth, progress, children }: { depth: number; progress: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    // as the top card leaves, everything behind moves up one slot
    const d = depth - progress.value;
    return {
      transform: [
        { translateY: interpolate(d, [0, 1, 2], [0, 14, 26]) },
        { scale: interpolate(d, [0, 1, 2], [1, 0.95, 0.9]) },
        { rotate: `${interpolate(d, [0, 1, 2], [0, depth % 2 ? 2 : -2, depth % 2 ? 2 : -2])}deg` },
      ],
      opacity: interpolate(d, [0, 1, 2], [1, 1, 0.85]),
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
