import type { Contacts } from "../db/users.js";
import type { SwipeAction } from "../db/swipes.js";
import type { Tag } from "../tags.js";

export const SEED_PASSWORD = "password123";

export type SeedUser = { name: string; email: string; contacts: Contacts; interests: Tag[] };

export const SEED_USERS: SeedUser[] = [
  { name: "Alex Rivera", email: "alex@seed.test", contacts: { instagram: "@alexr", phone: "617-555-0101" }, interests: ["music", "nightlife", "food"] },
  { name: "Bailey Chen", email: "bailey@seed.test", contacts: { instagram: "@baileyc", snapchat: "baileyc" }, interests: ["art", "film", "theater"] },
  { name: "Casey Murphy", email: "casey@seed.test", contacts: { email: "casey.m@example.com" }, interests: ["sports", "fitness", "outdoors"] },
  { name: "Dana Okafor", email: "dana@seed.test", contacts: { snapchat: "danaok", phone: "617-555-0104" }, interests: ["tech", "career", "networking"] },
  { name: "Evan Silva", email: "evan@seed.test", contacts: { instagram: "@evans" }, interests: ["comedy", "drinks", "gaming"] },
  { name: "Fran Nowak", email: "fran@seed.test", contacts: { phone: "617-555-0106", email: "fran.n@example.com" }, interests: ["wellness", "community", "volunteering"] },
];

// Indexes into SEED_USERS. Each pair becomes two accepted rows.
export const SEED_FRIENDSHIPS: [number, number][] = [[0, 1], [0, 2], [1, 3]];
// [from, to]: Evan has asked Alex.
export const SEED_PENDING_REQUESTS: [number, number][] = [[4, 0]];

type Venue = { location: string; lat: number; lng: number };

const VENUES = {
  hob: { location: "House of Blues, 15 Lansdowne St, Boston", lat: 42.3470, lng: -71.0950 },
  paradise: { location: "Paradise Rock Club, 967 Commonwealth Ave, Boston", lat: 42.3519, lng: -71.1317 },
  berklee: { location: "Berklee Performance Center, 136 Massachusetts Ave, Boston", lat: 42.3470, lng: -71.0885 },
  common: { location: "Boston Common, Boston", lat: 42.3550, lng: -71.0656 },
  harvardArt: { location: "Harvard Art Museums, 32 Quincy St, Cambridge", lat: 42.3744, lng: -71.1142 },
  mediaLab: { location: "MIT Media Lab, 75 Amherst St, Cambridge", lat: 42.3604, lng: -71.0870 },
  curry: { location: "Curry Student Center, Northeastern University, Boston", lat: 42.3398, lng: -71.0892 },
  bu: { location: "George Sherman Union, BU, 775 Commonwealth Ave, Boston", lat: 42.3511, lng: -71.1085 },
  mfa: { location: "Museum of Fine Arts, 465 Huntington Ave, Boston", lat: 42.3394, lng: -71.0940 },
  wang: { location: "Citizens Bank Opera House, 539 Washington St, Boston", lat: 42.3503, lng: -71.0644 },
  improv: { location: "Improv Asylum, 216 Hanover St, Boston", lat: 42.3647, lng: -71.0542 },
  fenway: { location: "Fenway Park, 4 Jersey St, Boston", lat: 42.3467, lng: -71.0972 },
  garden: { location: "TD Garden, 100 Legends Way, Boston", lat: 42.3662, lng: -71.0621 },
  bpl: { location: "Boston Public Library, 700 Boylston St, Boston", lat: 42.3496, lng: -71.0783 },
  hatch: { location: "Hatch Memorial Shell, Charles River Esplanade, Boston", lat: 42.3563, lng: -71.0731 },
  science: { location: "Harvard Science Center, 1 Oxford St, Cambridge", lat: 42.3769, lng: -71.1167 },
  cic: { location: "Cambridge Innovation Center, 1 Broadway, Cambridge", lat: 42.3626, lng: -71.0843 },
  faneuil: { location: "Faneuil Hall Marketplace, Boston", lat: 42.3600, lng: -71.0568 },
  arboretum: { location: "Arnold Arboretum, 125 Arborway, Boston", lat: 42.3000, lng: -71.1230 },
  coolidge: { location: "Coolidge Corner Theatre, 290 Harvard St, Brookline", lat: 42.3426, lng: -71.1214 },
  seaport: { location: "Lawn on D, 420 D St, Boston", lat: 42.3467, lng: -71.0447 },
  somerville: { location: "Somerville Theatre, 55 Davis Sq, Somerville", lat: 42.3965, lng: -71.1229 },
  jamaica: { location: "Jamaica Pond, Boston", lat: 42.3156, lng: -71.1200 },
} satisfies Record<string, Venue>;

// null = price unknown; [0, 0] = free.
type Price = null | [number, number];
type EventTemplate = { title: string; venue: keyof typeof VENUES; tags: Tag[]; price: Price };

const e = (title: string, venue: keyof typeof VENUES, tags: Tag[], price: Price): EventTemplate => ({
  title, venue, tags, price,
});

const UPCOMING: EventTemplate[] = [
  e("Indie Rock Night", "paradise", ["music", "nightlife"], [18, 25]),
  e("Berklee Student Jazz Showcase", "berklee", ["music", "art"], [0, 0]),
  e("Comedy Open Mic", "improv", ["comedy", "nightlife"], [0, 5]),
  e("Sunrise Yoga on the Common", "common", ["wellness", "fitness", "outdoors"], [0, 0]),
  e("Intro to Pottery Workshop", "curry", ["workshop", "art"], [30, 30]),
  e("Startup Pitch Night", "cic", ["tech", "networking", "career"], [0, 0]),
  e("Red Sox vs. Yankees", "fenway", ["sports"], [45, 180]),
  e("Celtics Home Game", "garden", ["sports"], [60, 250]),
  e("Food Truck Friday", "seaport", ["food", "community"], null),
  e("Harvard Art Museums Late Night", "harvardArt", ["art", "community"], [0, 0]),
  e("AI Research Lightning Talks", "mediaLab", ["tech", "academic"], [0, 0]),
  e("Career Fair: Engineering and Biotech", "curry", ["career", "networking"], [0, 0]),
  e("Midnight Movie: Cult Classics", "coolidge", ["film", "nightlife"], [12, 12]),
  e("Boston Hip-Hop Showcase", "hob", ["music", "nightlife"], [20, 35]),
  e("Craft Beer Tasting", "faneuil", ["drinks", "food"], [25, 40]),
  e("Charles River Cleanup", "hatch", ["volunteering", "outdoors", "community"], [0, 0]),
  e("Board Game Social", "bu", ["gaming", "community"], [0, 0]),
  e("Esports Watch Party", "bu", ["gaming", "community"], [0, 0]),
  e("Hatch Shell Summer Concert", "hatch", ["music", "outdoors"], [0, 0]),
  e("Broadway Touring Show", "wang", ["theater"], [55, 150]),
  e("Stand-Up Showcase", "improv", ["comedy"], [15, 20]),
  e("Resume Review Hour", "bpl", ["career", "workshop"], [0, 0]),
  e("Author Talk: Boston History", "bpl", ["academic", "community"], [0, 0]),
  e("Photography Walk", "arboretum", ["art", "outdoors"], null),
  e("Sunset Run Club", "jamaica", ["fitness", "outdoors", "community"], [0, 0]),
  e("Meditation and Sound Bath", "arboretum", ["wellness"], [15, 15]),
  e("Hack Night", "cic", ["tech", "workshop", "networking"], [0, 0]),
  e("Physics Colloquium", "science", ["academic"], [0, 0]),
  e("Improv Beginner Class", "improv", ["comedy", "workshop"], [20, 20]),
  e("Classic Film Screening", "somerville", ["film"], [10, 14]),
  e("Salsa Night", "hob", ["nightlife", "music", "fitness"], [10, 15]),
  e("Museum Sketch Club", "mfa", ["art", "workshop"], [0, 25]),
  e("Neighborhood Volunteer Day", "common", ["volunteering", "community"], [0, 0]),
  e("Women in Tech Mixer", "cic", ["tech", "networking", "career"], [0, 10]),
  e("Open Air Cinema", "seaport", ["film", "outdoors"], null),
  e("Cocktail Making Class", "faneuil", ["drinks", "workshop"], [45, 60]),
  e("University Orchestra Concert", "berklee", ["music", "academic"], [5, 15]),
  e("Pickup Soccer", "common", ["sports", "fitness"], [0, 0]),
  e("Trivia Night", "paradise", ["nightlife", "drinks", "gaming"], [0, 0]),
  e("Climate Policy Panel", "science", ["academic", "community"], [0, 0]),
  e("Dumpling Crawl", "faneuil", ["food"], [30, 45]),
  e("Open Studio Weekend", "mfa", ["art", "community"], null),
  e("Outdoor Boot Camp", "jamaica", ["fitness", "outdoors"], [10, 10]),
  e("Late Night Karaoke", "hob", ["nightlife", "music", "drinks"], null),
  e("Student Play: A Midsummer Night's Dream", "somerville", ["theater", "art"], [8, 12]),
];

const EXPIRED: EventTemplate[] = [
  e("Last Week's Jazz Brunch", "berklee", ["music", "food"], [20, 20]),
  e("Past Hackathon Demo Day", "cic", ["tech", "career"], [0, 0]),
  e("Finished Art Opening", "harvardArt", ["art"], null),
];

export type SeedEvent = {
  title: string;
  tags: Tag[];
  startsAt: Date;
  location: string;
  lat: number;
  lng: number;
  imageUrl: string;
  sourceUrl: string;
  priceMin: number | null;
  priceMax: number | null;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function toSeedEvent(template: EventTemplate, number: number, startsAt: Date): SeedEvent {
  const { location, lat, lng } = VENUES[template.venue];
  return {
    title: template.title,
    tags: template.tags,
    startsAt,
    location,
    lat,
    lng,
    imageUrl: `https://picsum.photos/seed/${number}/600/400`,
    sourceUrl: `seed://event-${number}`,
    priceMin: template.price?.[0] ?? null,
    priceMax: template.price?.[1] ?? null,
  };
}

// Upcoming events are spaced evenly through the next ~6 days; expired ones are 1 to 3 days ago.
export function buildSeedEvents(now: Date): { upcoming: SeedEvent[]; expired: SeedEvent[] } {
  const upcoming = UPCOMING.map((template, i) =>
    toSeedEvent(template, i + 1, new Date(now.getTime() + (2 + i * 3.4) * HOUR_MS)),
  );
  const expired = EXPIRED.map((template, i) =>
    toSeedEvent(template, UPCOMING.length + i + 1, new Date(now.getTime() - (i + 1) * DAY_MS)),
  );
  return { upcoming, expired };
}

// [user index, event index into upcoming (or into expired when `expired`), action]
export type SeedSwipe = { user: number; event: number; action: SwipeAction; expired?: true };

export const SEED_SWIPES: SeedSwipe[] = [
  { user: 0, event: 0, action: "going" },
  { user: 0, event: 13, action: "going" },
  { user: 0, event: 8, action: "save" },
  { user: 0, event: 5, action: "pass" },
  { user: 1, event: 0, action: "going" },
  { user: 1, event: 9, action: "going" },
  { user: 1, event: 19, action: "save" },
  { user: 1, event: 6, action: "pass" },
  { user: 2, event: 6, action: "going" },
  { user: 2, event: 3, action: "going" },
  { user: 2, event: 0, action: "save" },
  { user: 3, event: 5, action: "going" },
  { user: 3, event: 25, action: "going" },
  { user: 3, event: 9, action: "save" },
  { user: 4, event: 2, action: "going" },
  { user: 4, event: 13, action: "save" },
  { user: 5, event: 15, action: "going" },
  { user: 0, event: 0, action: "going", expired: true },
  { user: 1, event: 2, action: "save", expired: true },
];
