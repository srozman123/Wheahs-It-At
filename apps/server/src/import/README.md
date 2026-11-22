# Event importer

Pulls this week's Boston events from several sites into the `events` table, in three steps:

| Step | Command (run in `apps/server`) | Reads → writes |
|---|---|---|
| 1. Fetch | `npm run import:fetch` | websites + Boston Calendar file → `data/events_raw.json` |
| 2. Tag | `npm run import:normalize` **or** ask Claude Code | `events_raw.json` → `data/events_tags.json` |
| 3. Save | `npm run import:save` | both files → database |

Run everything from your laptop. It talks to the cloud database through `DATABASE_URL` in
`apps/server/.env`, the same way `npm run db:seed` does. The API server doesn't need to be running.

---

## Before each run: refresh the Boston Calendar file (optional, recommended)

thebostoncalendar.com blocks scripts, so this one source is saved by hand:

1. Open https://www.thebostoncalendar.com in Safari and scroll to load the week.
2. **File → Save As…**, Format **Page Source**, save as `boston.html` anywhere.
3. From `apps/server`:
   ```sh
   python3 -I src/import/tools/parse_bostoncalendar.py ~/Downloads/boston.html data/bostoncalendar_events.json
   ```

If you skip this, step 1 uses the old file (events that already happened are dropped automatically).

---

## Option A: tag with Claude Code (no API key)

```sh
cd apps/server
npm run import:fetch
```

Then paste this into Claude Code from the repo root:

> Tag the imported events. Read `apps/server/src/import/TAGGING.md` and follow it exactly.
> Input: `apps/server/data/events_raw.json`. Output: `apps/server/data/events_tags.json`, a JSON array of
> `{ "id", "description", "tags", "notAnEvent" }`, one per event, with `id` copied exactly. If the output file
> already exists, keep its entries and only tag events that aren't in it yet. Only add descriptions and tags:
> never change or invent event facts. Work in chunks of about 100 events and save after each chunk.
> When done, run `npm run import:save -- --dry-run` in `apps/server` and fix anything it reports.

Then save to the database:

```sh
npm run import:save
```

## Option B: tag with the API (one command)

1. Add your key to `apps/server/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Run everything:
   ```sh
   cd apps/server
   npm run import
   ```
   That's fetch → tag (Claude Haiku 5.5, about 50 events per request) → save.

You can also run the steps on their own: `import:fetch`, `import:normalize`, `import:save`.

---

## Good to know

- **Safe to re-run.** Tagging skips events already in `events_tags.json`, and saving skips events already in
  the database (same link + same start time).
- **Check before saving:** `npm run import:save -- --dry-run` shows what would be saved without touching
  the database.
- **Untagged events aren't saved.** Step 3 tells you how many it skipped. A bad entry in
  `events_tags.json` (unknown tag, empty description) is skipped and reported, not fatal; re-running the
  tag step fills it in.
- **Events with only a date** (no time on the source site) get **12:00 noon**, so today's all-day events
  aren't dropped as already started. Change `DATE_ONLY_TIME` in `config.ts` if you prefer otherwise.
- **Dropped automatically:** events already started, more than 7 days out, online/webinar events, notices
  that aren't events (recesses, deadlines, calls for proposals, "TBA"), and events outside Massachusetts
  (state in the location or description, or a venue that maps to another state). Step 1 prints how many and
  why. The tag step can also mark a listing `notAnEvent`, and save skips those.
- **Re-fetching keeps your tags** as long as the event's link and start time don't change (tags are matched
  by an id made from those two).
- **Undo an import:** `npm run import:clear -- --yes` deletes all imported events (not seed data, not
  events users posted). Their swipes go with them.
- **Missing images** get a Boston photo from `defaultImages.ts`. Most need credit to the photographer;
  the author and license are stored with each photo.
- **Settings** (sources, 7-day window, model, batch size, rate limits) live in `config.ts`.
- Generated files and caches live in `apps/server/data/`, which git ignores.

## Files

```
import/
  cli.ts            entry point for the npm scripts
  config.ts         all settings
  types.ts          the shape of each step's file (checked on every read)
  stages/           fetch.ts, normalize.ts, save.ts, clear.ts
  sources/          one fetcher per site + index.ts
  http.ts           polite fetching: browser user agent, cache, rate limit, robots.txt
  validate.ts       drops bad, online, and out-of-window events
  dedupe.ts         merges the same event found on several sites
  geocode.ts        fills missing coordinates (OpenStreetMap Nominatim, cached)
  images.ts         checks images, falls back to the page preview image, picks default photos
  normalize.ts      the API tagging step
  TAGGING.md        tagging instructions (used by the API step and by Claude Code)
  defaultImages.ts  Boston photos for events with no image
  tools/            parse_bostoncalendar.py
db/importedEvents.ts  the SQL for saving and clearing imported events
```
