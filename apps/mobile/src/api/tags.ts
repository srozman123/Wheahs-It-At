import { request } from './client';

export async function getTags(): Promise<string[]> {
  const { tags } = await request<{ tags: string[] }>('GET', '/tags', { auth: false });
  return tags;
}
