/**
 * TEMPORARY front-end types that mirror docs/DESIGN.md's schema.
 * When the backend lands, these should be replaced by the shared types in
 * packages/shared (User, Event, Swipe, Friend).
 */

export type SwipeAction = 'pass' | 'save' | 'going' | 'removed';

export type ContactKind = 'instagram' | 'snapchat' | 'phone' | 'email';

export type User = {
  id: string;
  name: string;
  contacts: Partial<Record<ContactKind, string>>;
  interests: string[];
};

export type Event = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  startsAt: string; // ISO timestamp
  location: string; // neighborhood, shown on the card front
  address: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  priceMin: number | null; // both 0 = free, both null = unknown
  priceMax: number | null;
  creatorId: string | null;
  /** ids of app users who marked Going (the API will compute this). */
  goingUserIds: string[];
};

export type Friend = {
  id: string;
  name: string;
  status: 'requested' | 'accepted' | 'incoming';
  contacts: Partial<Record<ContactKind, string>>;
  color: string;
};
