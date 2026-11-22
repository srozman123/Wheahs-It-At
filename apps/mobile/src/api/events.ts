import { request } from './client';
import type { Card, EventDetail, NewEvent } from './types';

export function getEvent(id: string): Promise<EventDetail> {
  return request<EventDetail>('GET', `/events/${encodeURIComponent(id)}`);
}

export async function createEvent(event: NewEvent): Promise<Card> {
  const { event: created } = await request<{ event: Card }>('POST', '/events', { body: event });
  return created;
}
