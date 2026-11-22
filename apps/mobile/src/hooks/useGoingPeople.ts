import { MOCK_PEOPLE } from '../mocks/events';
import type { Event } from '../mocks/types';
import { useAppState } from './useAppState';

export type Person = { id: string; name: string; color: string; isFriend: boolean };

/**
 * Who's going to an event: accepted friends first, then other app users.
 * (DESIGN.md: attendee lists only count app users who marked Going.)
 * Later this comes back from the API with the event.
 */
export function useGoingPeople(event: Event): { friends: Person[]; others: Person[] } {
  const { friends } = useAppState();
  const accepted = new Map(friends.filter((f) => f.status === 'accepted').map((f) => [f.id, f]));
  const result = { friends: [] as Person[], others: [] as Person[] };
  for (const id of event.goingUserIds) {
    if (id === 'me') continue;
    const f = accepted.get(id);
    if (f) result.friends.push({ id, name: f.name, color: f.color, isFriend: true });
    else {
      const p = MOCK_PEOPLE[id] ?? friends.find((x) => x.id === id);
      if (p) result.others.push({ id, name: p.name, color: p.color, isFriend: false });
    }
  }
  return result;
}
