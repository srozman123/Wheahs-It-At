import type { LineColor } from '../theme/colors';

/**
 * TEMPORARY copy of the fixed tag list. DESIGN.md says this lives once in
 * packages/shared; agree the final list with the backend and move it there.
 * The emoji + color are front-end only and can stay in the app.
 */
export const TAGS = [
  { id: 'music', label: 'Live Music', emoji: '🎸', color: 'red' },
  { id: 'food', label: 'Food & Drink', emoji: '🍜', color: 'orange' },
  { id: 'sports', label: 'Sports', emoji: '🏀', color: 'green' },
  { id: 'art', label: 'Art', emoji: '🎨', color: 'purple' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌙', color: 'blue' },
  { id: 'campus', label: 'Campus', emoji: '🎓', color: 'yellow' },
  { id: 'outdoors', label: 'Outdoors', emoji: '🌳', color: 'green' },
  { id: 'tech', label: 'Tech', emoji: '💻', color: 'blue' },
  { id: 'comedy', label: 'Comedy', emoji: '😂', color: 'yellow' },
  { id: 'film', label: 'Film', emoji: '🎬', color: 'red' },
  { id: 'fitness', label: 'Fitness', emoji: '🏃', color: 'orange' },
  { id: 'markets', label: 'Markets', emoji: '🛍️', color: 'purple' },
  { id: 'theater', label: 'Theater', emoji: '🎭', color: 'red' },
  { id: 'networking', label: 'Meet People', emoji: '🤝', color: 'blue' },
  { id: 'history', label: 'History', emoji: '🏛️', color: 'orange' },
  { id: 'games', label: 'Games', emoji: '🎲', color: 'green' },
] as const satisfies readonly { id: string; label: string; emoji: string; color: LineColor }[];

export type TagId = (typeof TAGS)[number]['id'];

export function getTag(id: string) {
  return TAGS.find((t) => t.id === id) ?? { id, label: id, emoji: '✨', color: 'orange' as LineColor };
}
