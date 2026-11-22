import { line } from '../theme/colors';

const PALETTE = [line.orange.base, line.blue.base, line.purple.base, line.red.base, line.green.base];

/** Deterministic avatar colour from a user id (the server stores no colour). */
export function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
