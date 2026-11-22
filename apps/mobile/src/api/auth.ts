import { request } from './client';
import type { Me } from './types';

/** Does not persist anything; the caller stores the returned id. */
export async function signup(name: string, email: string, password: string): Promise<Me> {
  const { user } = await request<{ user: Me }>('POST', '/auth/signup', {
    auth: false,
    body: { name, email, password },
  });
  return user;
}

export async function login(email: string, password: string): Promise<Me> {
  const { user } = await request<{ user: Me }>('POST', '/auth/login', {
    auth: false,
    body: { email, password },
  });
  return user;
}
