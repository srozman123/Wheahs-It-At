// Shapes mirror the server's JSON (apps/server/src/db/*.ts, services/friends.ts).

export type ContactKind = 'instagram' | 'snapchat' | 'phone' | 'email';

export type Contacts = Partial<Record<ContactKind, string>>;

export type SwipeAction = 'pass' | 'save' | 'going' | 'removed';

export type RequestStatus = 'requested' | 'accepted';

export type Me = {
  id: string;
  name: string;
  email: string;
  contacts: Contacts;
  interests: string[];
  createdAt: string;
};

export type MeUpdate = {
  name?: string;
  contacts?: Contacts;
  interests?: string[];
};

/** `contacts` is present only when `isFriend` is true. */
export type PublicUser = {
  id: string;
  name: string;
  isFriend: boolean;
  contacts?: Contacts;
};

export type Card = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  startsAt: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  creatorId: string | null;
  friendsGoing: number;
  expired: boolean;
};

export type FriendsGoingEvent = Card & {
  goingFriends: { id: string; name: string }[];
};

export type NewEvent = {
  title: string;
  description?: string;
  tags: string[];
  /** ISO 8601 with offset, in the future. */
  startsAt: string;
  location?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  sourceUrl?: string;
  priceMin?: number;
  priceMax?: number;
};

export type EventDetail = {
  event: Card;
  going: PublicUser[];
};
