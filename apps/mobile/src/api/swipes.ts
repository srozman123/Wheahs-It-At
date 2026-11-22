import { request } from './client';
import type { SwipeAction } from './types';

export async function postSwipe(eventId: string, action: SwipeAction): Promise<{ eventId: string; action: SwipeAction }> {
  const { swipe } = await request<{ swipe: { eventId: string; action: SwipeAction } }>('POST', '/swipes', {
    body: { eventId, action },
  });
  return swipe;
}
