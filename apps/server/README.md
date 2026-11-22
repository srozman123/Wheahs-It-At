# @wheahs/server

Hono + Postgres API. TypeScript run directly with `tsx` (no build step). Production setup: [../../INSTALL.md](../../INSTALL.md).

## Run locally

```bash
npm ci
cp .env.example .env     # set DATABASE_URL (Tiger Data / any Postgres)
npm run db:setup -- --yes
npm run db:seed          # optional demo data
npm run dev              # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start (used in production) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the vitest suite |
| `npm run db:setup -- --yes` | **Destructive:** drop and recreate all tables (refuses without `--yes`) |
| `npm run db:seed` | Replace the fake seed data with a fresh set |
| `npm run db:clear-seed` | Remove only seed data (`seed://` events, `@seed.test` users) |

## Tests

Tests run against the database in `DATABASE_URL` but never touch the real tables. Each run creates its own schema named `wia_test_<pid>`, loads `src/db/schema.sql` into it, points the app's pool at it through `DB_SCHEMA`, and drops it at the end. Guards refuse to drop or truncate anything outside a `wia_test_` schema. Without `DATABASE_URL`, database tests are skipped.

## Endpoints

JSON in and out; errors are `{ "error": "..." }`. Authenticated routes need an `x-user-id: <uuid>` header (401 otherwise).

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /health` | no | Liveness |
| `GET /tags` | no | Allowed event tags |
| `POST /auth/signup` | no | Create account |
| `POST /auth/login` | no | Log in |
| `GET /me`, `PATCH /me` | yes | Read or update profile (name, contacts, interests) |
| `GET /me/saved`, `GET /me/going` | yes | Saved and Going events |
| `GET /feed?exclude=id,id` | yes | Next batch of ranked events |
| `GET /events/:id` | yes | Event and who is going |
| `POST /events` | yes | Post an event (creator is marked Going) |
| `POST /swipes` | yes | Pass, save, going or removed |
| `GET /friends` | yes | Friends, with contacts |
| `GET /friends/requests` | yes | Incoming and outgoing requests |
| `POST /friends/requests` | yes | Send a request (accepts if they already asked) |
| `POST /friends/requests/:userId/accept` | yes | Accept a request |
| `GET /friends/events` | yes | Upcoming events friends are going to |
| `GET /users/search?q=` | yes | Find users by name or exact email |
