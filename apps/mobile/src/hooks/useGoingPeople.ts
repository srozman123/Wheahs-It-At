import { useEffect, useState } from 'react';
import { getEvent } from '../api';
import { avatarColor } from '../utils/avatarColor';

export type Person = { id: string; name: string; color: string; isFriend: boolean };

type GoingPeople = { friends: Person[]; others: Person[]; loading: boolean };

const EMPTY: GoingPeople = { friends: [], others: [], loading: true };
const NONE: GoingPeople = { friends: [], others: [], loading: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who's going to an event: friends first, then other app users, from GET /events/:id.
 * Preview cards (ids that aren't server UUIDs, e.g. 'draft') are skipped; failures yield empty lists.
 */
export function useGoingPeople(eventId: string): GoingPeople {
  const [people, setPeople] = useState<GoingPeople>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!UUID.test(eventId)) {
      setPeople(NONE);
      return;
    }
    setPeople(EMPTY);
    getEvent(eventId)
      .then(({ going }) => {
        if (cancelled) return;
        const all = going.map((u) => ({ id: u.id, name: u.name, color: avatarColor(u.id), isFriend: u.isFriend }));
        setPeople({ friends: all.filter((p) => p.isFriend), others: all.filter((p) => !p.isFriend), loading: false });
      })
      .catch(() => {
        if (!cancelled) setPeople(NONE);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return people;
}
