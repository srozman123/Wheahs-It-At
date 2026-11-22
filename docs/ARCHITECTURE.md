# Wheahs-it-at: Architecture

## Overview
A monorepo with a mobile app, a small backend API, and shared code.

**Data flow:** Mobile app → Server API (Vultr) → Tiger Data (Postgres)

## Tech Stack
| Part | Choice | Lives on |
|---|---|---|
| Mobile app | React Native + Expo | 📱 Phone |
| Backend | Node + TypeScript (Hono or Express) | 🖥️ Vultr server |
| Database | Tiger Data (Postgres) | ☁️ Tiger Cloud |
| Shared code | TypeScript package | 🔁 Bundled into both |
| Auth | Email + password in the DB; `user_id` saved on the phone with AsyncStorage | 📱 + 🖥️ |

## Folder Structure

```
wheahs-it-at/
├── package.json                 # workspaces: ["apps/*", "packages/*"], root scripts
├── .gitignore                   # node_modules, .env, build output
├── README.md                    # setup + how to run
│
├── docs/                        # 📄 project documentation
│                                #   DESIGN.md (product + data), ARCHITECTURE.md (this file)
│
├── apps/
│   ├── mobile/                  # 📱 LIVES ON THE PHONE (Expo app)
│   │   │                        #   root: package.json, app.json, tsconfig.json (config only)
│   │   └── src/
│   │       ├── api/             # the ONLY code that talks to the server
│   │       │                    #   base client (server URL, attaches user_id) + one file per resource
│   │       ├── screens/         # one file per full screen
│   │       │                    #   Login, Onboarding, Feed, Saved, Going, Friends, PostEvent
│   │       ├── components/      # reusable UI pieces
│   │       │                    #   flip EventCard, SwipeDeck (left/right/up + confirm), list rows, TagPicker
│   │       ├── navigation/      # bottom tabs + screen routing
│   │       ├── hooks/           # screen logic kept out of the UI
│   │       │                    #   feed batching, session (user_id in AsyncStorage)
│   │       └── utils/           # small pure helpers (time formatting like "Tonight 8pm")
│   │
│   └── server/                  # 🖥️ LIVES ON THE VULTR SERVER (Node API)
│       │                        #   root: package.json, tsconfig.json, .env (DATABASE_URL, never committed)
│       └── src/
│           ├── routes/          # HTTP layer only: read request → call service → send response
│           │                    #   auth, events, swipes, feed, friends
│           ├── services/        # business rules, no SQL and no HTTP
│           │                    #   feed scoring + batching, swipe rules, friend/contact privacy
│           ├── db/              # data layer: the ONLY place with SQL
│           │                    #   connection pool to Tiger Data, schema.sql, one repo per table
│           ├── middleware/      # cross-cutting concerns
│           │                    #   requireUser (checks user_id), central error handler
│           └── import/          # one-time event pull (run on the server or a laptop)
│               │                #   entry script: fetch → normalize → dedupe → geocode → save
│               └── sources/     # one fetcher per site (Eventbrite, Meetup, university calendars)
│
└── packages/
    └── shared/                  # 🔁 USED BY BOTH mobile + server
        │                        #   root: package.json, tsconfig.json
        └── src/                 # tags list, feedConfig (weights), shared types (User, Event, Swipe, Friend)
```

## Principles
- **Separation of concerns:** on the server, routes handle HTTP, services hold the rules, and `db` holds the SQL. Each layer only calls the one below it.
- **Single source of truth:** the tag list, the feed weights and the types live once, in `packages/shared`.
- **One way in and out:** the phone only talks to the server through `apps/mobile/src/api/`. Only `apps/server/src/db/` talks to the database.
- **Dependency direction:** apps depend on `packages/shared`, and `shared` never depends on the apps.
- **Config apart from code:** each package root holds only config, and all code lives in `src/`.
- **Secrets stay on the server:** the database URL exists only in `apps/server/.env`, never in the app.
- **Business logic stays out of screens:** screens render, and the logic lives in hooks and the API layer.

## Note: `packages/shared` dropped (decided during backend work)
- **No `packages/shared`.** Each app is self-contained, so it can be deployed on its own (only `apps/server` runs on Vultr).
- **Tag list:** lives in `apps/server/src/tags.ts`. The server is the source of truth, and the app fetches it from `GET /tags` (for the onboarding TagPicker) instead of importing it.
- **Feed weights:** `apps/server/src/feedConfig.ts`. Only the server uses them.
- **Types** (`User`, `Event`, etc.): each app defines its own. The mobile app writes types that match the server's JSON responses.
- This replaces the "Single source of truth" and "Dependency direction" principles above, and the `packages/` part of the folder tree.