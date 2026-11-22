import type { WithSpringConfig } from 'react-native-reanimated';

/** Spring presets. "bouncy" overshoots a little, which is what makes things feel playful. */
export const springs = {
  bouncy: { damping: 11, stiffness: 180, mass: 0.8 },
  snappy: { damping: 18, stiffness: 260 },
  gentle: { damping: 20, stiffness: 120 },
  /** Near-critically damped: returns to rest with no visible wobble. Used for cards. */
  settle: { damping: 30, stiffness: 260 },
} satisfies Record<string, WithSpringConfig>;

/** Card flip: a plain eased turn (no spring) so it never overshoots the halfway point. */
export const FLIP_DURATION = 420;

export const durations = {
  press: 90,
  quick: 180,
  normal: 300,
  slow: 500,
} as const;
