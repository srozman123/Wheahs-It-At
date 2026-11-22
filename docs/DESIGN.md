# Design: Boston Events App

A Tinder-style mobile app where people in Boston swipe through events happening this week, save the ones they like, mark the ones they're going to, and connect with others who are going.

---

## Core Features

- **Feed:** a swipeable card stack of events happening this week
- **Saved tab:** events the user saved; from here they can mark them Going, Pass, or remove them
- **Going tab:** events the user is going to; they can remove them from here
- **Friends:** add people and see which events your friends are going to
- **Post an event:** user-created events appear in other people's feeds (no approval needed)
- **Onboarding:** contact info, a tap-to-select interest list, and a short swipe tutorial

---

## Swiping

| Gesture | Action | Notes |
|---|---|---|
| Swipe left | **Pass** | Not interested |
| Swipe right | **Save** | Interested, maybe |
| Swipe up | **Going** | Shows a confirmation first |
| Tap card | **Flip** | Shows full details |

- No vertical scrolling. The feed is a card stack, not a reels-style feed.
- No undo. Users change their mind from the Saved or Going tabs.
- Onboarding shows one animated card demonstrating the three swipe directions.

---

## Card Layout (Flashcard)

**Front (quick look):**
- Image
- Title
- Time (e.g. "Tonight 8pm")
- Neighborhood / location
- Tags
- Number of friends going

**Back (tap to flip):**
- Full description
- Full address
- Price (Free, or a price range)
- Link to the source
- Who's going: friends first, then other app users who marked Going

---

## Feed Rules

- Shows only events happening **this week**
- Never shows expired events
- Never shows events the user has already acted on (pass, save, going, removed)
- **Expired** = `starts_at < now()`; calculated, never stored
- Expired events in the Saved and Going tabs are labeled **Expired**

### Building the feed
- When the user opens or refreshes the app, calculate a **batch** of cards (size set in the config file)
- When the user nears the end of the batch, fetch the next batch, scored again using their latest swipes
- Feels fresh without recalculating on every swipe

---

## Data Pulling

- A **one-time script** fills the database (it would run weekly in a real version; for the hackathon it runs once)
- **Sources:** Eventbrite, Meetup, university calendars (BU, Northeastern, MIT, Harvard; many have RSS or iCal feeds), The Boston Calendar, Do617
- Use APIs and feeds over scraping where possible
- **LLM step:** convert each raw event into our schema and assign tags **from our fixed tag list only**
- **Dedupe:** the same event found on several sites is merged into one event with one `source_url`
- **Location:** look up `lat` / `lng` from the location during import
- **Images:** the event's own image, or the page's preview image (`og:image`)

---

## Database Schema (Tiger Data / Postgres)

```sql
CREATE TYPE swipe_action  AS ENUM ('pass', 'save', 'going', 'removed');
CREATE TYPE friend_status AS ENUM ('requested', 'accepted');

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  contacts    JSONB NOT NULL DEFAULT '{}',    -- {"instagram": "...", "snapchat": "...", "phone": "...", "email": "..."}
  interests   TEXT[] NOT NULL DEFAULT '{}',   -- picked at onboarding
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  starts_at   TIMESTAMPTZ NOT NULL,
  location    TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  image_url   TEXT,
  source_url  TEXT,
  price_min   NUMERIC(8,2),                  -- both 0 = free, both NULL = unknown
  price_max   NUMERIC(8,2),
  creator_id  UUID REFERENCES users(id),     -- NULL = pulled from a site
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max)
);
CREATE INDEX ON events USING GIN (tags);     -- fast tag lookups
CREATE INDEX ON events (starts_at);          -- fast "this week, not expired"

CREATE TABLE swipes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action      swipe_action NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX ON swipes (event_id, action);   -- fast "who in the app is going to event X"

CREATE TABLE friends (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      friend_status NOT NULL DEFAULT 'requested',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
```

> **What `CREATE INDEX` does:** builds a lookup structure (like the index at the back of a book) so the database finds matching rows without reading the whole table. Reads get faster; writes get slightly slower.

### How swipes are stored
- One row per (user, event); this is the user's current status
- Swipe in the feed → `INSERT`
- Saved tab → Going or Pass → `UPDATE action`
- Remove from the Saved or Going tab → `UPDATE action = 'removed'`
  - Not a `DELETE`: deleting erases the swipe, so the event could reappear in the feed
- Saved tab = `action = 'save'`; Going tab = `action = 'going'`

### Design principles
- **Constraints in the database:** `NOT NULL`, foreign keys, enums, `CHECK` and `TIMESTAMPTZ` keep bad data out
- **A fixed tag list:** one constant in code; validate every tag against it
- **Indexes match real queries:** tag lookup, upcoming events, app users going to an event
- **One job per table:** entities (`users`, `events`), actions (`swipes`), relationships (`friends`)
- **No stored values that can be calculated:** expired status and tag scores are calculated when needed

---

## Friends

- **Add people you know:** search by contact and send a request (mutual accept)
- **Add people from events:** on an event you're Going to, see the other app users going and add them
- **Contact info** is visible **only to accepted friends** (enforced in the API)
- **Friend activity:** you see only the events your friends are **Going** to, never their Saved events
- **Attendee lists** count only app users who marked Going, not real-world attendance

---

## Personalization (Feed Ranking)

Each candidate event (this week, not expired, not yet acted on) gets a score:

```
score = interest_match + friend_boost + soonness + small_random
```

**Interest match:** the sum of the user's scores for the event's tags.

Tag scores are **calculated from the data, not stored**:
- Each onboarding interest starts with the `onboarding` weight
- Each swipe adds its action weight to every tag on that event

**Friend boost:** extra points for each friend going.

**Soonness:** events happening sooner rank higher.

**Variety:**
- A small random amount added to each score
- Every Nth card is a random wildcard, for exploration

No machine learning needed.

### Config file (`feedConfig.ts`)
All ranking values live in one file so they're easy to tweak and demo:

```ts
export const FEED_CONFIG = {
  weights: { onboarding: 2, pass: -1, save: 1, going: 3, removed: 0 },
  friendGoingBoost: 2,   // per friend going
  soonnessWeight: 1,
  randomness: 0.5,       // max random amount added to a score
  wildcardEvery: 5,      // every Nth card is random
  batchSize: 20,         // cards per feed batch
};
```

---

## Decisions

- Open to everyone, not just students
- Contact info visible to friends only
- User-posted events need no approval
- Feed time window: this week
- No undo; changes happen in the Saved and Going tabs
- One `source_url` per event (duplicates merged at import)

---

## Future Features (not a priority now)

- Search
- Filters: free/paid, distance (uses `lat` / `lng`), tags

---

## Out of Scope

- Database cleanup / clearing expired events
- UI and tech stack details (decided later; target is a mobile app)

---

## Implementation notes (backend)

- `users` gained `email` (unique, always stored lowercased and trimmed) and `password_hash` (bcrypt).
- "This week" in the feed means a rolling 7 days from now, not the calendar week.
- There is no way to decline a friend request yet.
- User search matches a name substring or an exact email only, never an email substring.
- Posting an event automatically marks the creator as Going.
- Seed data is identifiable by `source_url` starting with `seed://` and emails ending in `@seed.test`; `npm run db:clear-seed` removes exactly that.
- Feed ranking values live in `apps/server/src/feedConfig.ts`.
