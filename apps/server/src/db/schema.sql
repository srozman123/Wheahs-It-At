DROP TABLE IF EXISTS friends, swipes, events, users CASCADE;
DROP TYPE IF EXISTS swipe_action, friend_status;

CREATE TYPE swipe_action  AS ENUM ('pass', 'save', 'going', 'removed');
CREATE TYPE friend_status AS ENUM ('requested', 'accepted');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,          -- always stored lowercased + trimmed
  password_hash TEXT NOT NULL,
  contacts      JSONB NOT NULL DEFAULT '{}',   -- {"instagram": "...", "snapchat": "...", "phone": "...", "email": "..."}
  interests     TEXT[] NOT NULL DEFAULT '{}',  -- picked at onboarding
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE INDEX ON friends (friend_id, status); -- incoming requests
