import { request } from './client';
import type { Card, Me, MeUpdate } from './types';

export async function getMe(): Promise<Me> {
  const { user } = await request<{ user: Me }>('GET', '/me');
  return user;
}

export async function updateMe(update: MeUpdate): Promise<Me> {
  const { user } = await request<{ user: Me }>('PATCH', '/me', { body: update });
  return user;
}

export async function getSaved(): Promise<Card[]> {
  const { events } = await request<{ events: Card[] }>('GET', '/me/saved');
  return events;
}

export async function getGoing(): Promise<Card[]> {
  const { events } = await request<{ events: Card[] }>('GET', '/me/going');
  return events;
}
