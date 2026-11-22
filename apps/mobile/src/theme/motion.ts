import type { WithSpringConfig } from 'react-native-reanimated';

/** Spring presets. None of these overshoot — nothing in the app bounces past its resting point. */
export const springs = {
  bouncy: { damping: 26, stiffness: 220, overshootClamping: true },
  snappy: { damping: 26, stiffness: 260, overshootClamping: true },
  gentle: { damping: 24, stiffness: 120, overshootClamping: true },
  /** Near-critically damped: returns to rest with no visible wobble. Used for cards. */
  settle: { damping: 30, stiffness: 260, overshootClamping: true },
} satisfies Record<string, WithSpringConfig>;

/** Card flip: a plain eased turn (no spring) so it never overshoots the halfway point. */
export const FLIP_DURATION = 420;

export const durations = {
  press: 90,
  quick: 180,
  normal: 300,
  slow: 500,
} as const;
