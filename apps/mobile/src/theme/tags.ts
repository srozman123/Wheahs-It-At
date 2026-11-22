import { useEffect, useState } from 'react';
import { getTags } from '../api';
import type { LineColor } from './colors';

/**
 * Display metadata (label, emoji, colour) for the server's fixed tag list
 * (apps/server/src/tags.ts). The ids must match the server; the look is app-only.
 */
export const TAGS = [
  { id: 'music', label: 'Live Music', emoji: '🎸', color: 'red' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌙', color: 'blue' },
  { id: 'food', label: 'Food', emoji: '🍜', color: 'orange' },
  { id: 'drinks', label: 'Drinks', emoji: '🍻', color: 'yellow' },
  { id: 'art', label: 'Art', emoji: '🎨', color: 'purple' },
  { id: 'theater', label: 'Theater', emoji: '🎭', color: 'red' },
  { id: 'comedy', label: 'Comedy', emoji: '😂', color: 'yellow' },
  { id: 'film', label: 'Film', emoji: '🎬', color: 'blue' },
  { id: 'sports', label: 'Sports', emoji: '🏀', color: 'green' },
  { id: 'fitness', label: 'Fitness', emoji: '🏃', color: 'orange' },
  { id: 'outdoors', label: 'Outdoors', emoji: '🌳', color: 'green' },
  { id: 'tech', label: 'Tech', emoji: '💻', color: 'blue' },
  { id: 'career', label: 'Career', emoji: '💼', color: 'orange' },
  { id: 'networking', label: 'Meet People', emoji: '🤝', color: 'purple' },
  { id: 'academic', label: 'Academic', emoji: '🎓', color: 'yellow' },
  { id: 'workshop', label: 'Workshop', emoji: '🛠️', color: 'red' },
  { id: 'community', label: 'Community', emoji: '🏘️', color: 'green' },
  { id: 'volunteering', label: 'Volunteering', emoji: '💛', color: 'orange' },
  { id: 'gaming', label: 'Gaming', emoji: '🎲', color: 'purple' },
  { id: 'wellness', label: 'Wellness', emoji: '🧘', color: 'green' },
] as const satisfies readonly { id: string; label: string; emoji: string; color: LineColor }[];

export type TagId = (typeof TAGS)[number]['id'];

export type TagInfo = { id: string; label: string; emoji: string; color: LineColor };

export function getTag(id: string): TagInfo {
  return TAGS.find((t) => t.id === id) ?? { id, label: id, emoji: '✨', color: 'orange' };
}

/**
 * Tags the server currently accepts, in display order. Starts with the local
 * list and swaps in GET /tags if it succeeds (unknown ids get the fallback look).
 */
export function useTags(): TagInfo[] {
  const [tags, setTags] = useState<TagInfo[]>([...TAGS]);

  useEffect(() => {
    let cancelled = false;
    getTags()
      .then((ids) => {
        if (!cancelled && ids.length > 0) setTags(ids.map(getTag));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return tags;
}
