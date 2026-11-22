import { request } from './client';
import type { Card } from './types';

/** Server accepts at most 200 excluded ids. */
const MAX_EXCLUDED = 200;

/** `excludeIds`: cards the app already holds. Only the most recent 200 are sent. */
export async function getFeed(excludeIds: string[] = []): Promise<Card[]> {
  const exclude = excludeIds.slice(-MAX_EXCLUDED);
  const { events } = await request<{ events: Card[] }>('GET', '/feed', {
    query: { exclude: exclude.length ? exclude.join(',') : undefined },
  });
  return events;
}
