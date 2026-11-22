import { request } from './client';
import type { PublicUser } from './types';

/** Server requires 2-100 characters after trimming. */
export async function searchUsers(q: string): Promise<PublicUser[]> {
  const { users } = await request<{ users: PublicUser[] }>('GET', '/users/search', {
    query: { q: q.trim() },
  });
  return users;
}
