import { NON_EVENT } from "./config.js";
import { SourceEventSchema, type ImportWindow, type SourceEvent } from "./types.js";

export type Dropped = { reason: string; title: string; source: string };

const ONLINE_WORDS = /\b(online|virtual|virtually|zoom|livestream|live stream|webinar|webcast|teams|google meet)\b/i;
const ONLINE_TITLE_PREFIX = /^\s*[[(]\s*(online|virtual|livestream|webinar|zoom)\b/i;

const ONLINE_TITLE_WORDS = /\b(webinar|virtual|zoom|livestream|live stream|online only)\b/i;
const PLACEHOLDER_PLACE = /^(log in to view details|tba|tbd|tbc|to be announced|to be determined)\.?$/i;

// A trailing or comma-separated state token: ", PA", ", Pa.", ", N.Y." (comma before, end or comma/ZIP after).
const OTHER_STATE_CODES =
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
const AP_STATES = [
  "Ala", "Ariz", "Ark", "Calif", "Colo", "Conn", "Del", "Fla", "Ga", "Ill", "Ind", "Kan", "Ky", "La", "Md", "Mich", "Minn", "Miss", "Mo",
  "Mont", "Neb", "Nev", "Okla", "Ore", "Pa", "Tenn", "Vt", "Va", "Wash", "Wis", "Wyo", "Me",
];
const AP_DOTTED = ["N.C", "N.D", "N.H", "N.J", "N.M", "N.Y", "R.I", "S.C", "S.D", "W.Va", "D.C"];
const esc = (s: string) => s.replace(/\./g, "\\.");
const OTHER_STATE = new RegExp(
  `,\\s*(?:${OTHER_STATE_CODES.join("|")}|(?:${[...AP_STATES, ...AP_DOTTED].map(esc).join("|")})\\.)(?:\\s+\\d{5}(?:-\\d{4})?)?\\s*(?:,|$)`,
);

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function isOnline(event: SourceEvent): boolean {
  const onlinePlace =
    (event.location !== null && ONLINE_WORDS.test(event.location)) || (event.address !== null && ONLINE_WORDS.test(event.address));
  const noPhysicalPlace = (event.location === null && event.address === null) || onlinePlace;
  return ONLINE_TITLE_PREFIX.test(event.title) || onlinePlace || (noPhysicalPlace && ONLINE_TITLE_WORDS.test(event.title));
}

// In free text: "in Lyndonville, VT." / "Bethlehem, Pa.," — a capitalized place, comma, then a state token.
// Case-sensitive on purpose so ordinary words ("in", "or", "me") never match.
const OTHER_STATE_IN_TEXT = new RegExp(
  `\\b[A-Z][a-z]+,\\s*(?:${OTHER_STATE_CODES.join("|")}|(?:${[...AP_STATES, ...AP_DOTTED].map(esc).join("|")})\\.)(?=[\\s.,;:)]|$)`,
);

function isOutsideMassachusetts(event: SourceEvent): boolean {
  return (
    [event.location, event.address].some((text) => text !== null && OTHER_STATE.test(text)) ||
    (event.description !== null && OTHER_STATE_IN_TEXT.test(event.description))
  );
}

function isNonEvent(event: SourceEvent): boolean {
  return NON_EVENT.placeholderTitle.test(event.title) || NON_EVENT.titlePhrases.test(event.title);
}

const noPlaceholder = (text: unknown) => {
  if (typeof text !== "string") return text;
  const tidy = collapse(text);
  return tidy === "" || PLACEHOLDER_PLACE.test(tidy) ? null : tidy;
};

/** Collapses whitespace (title, location, address) and turns placeholder locations ("TBA", "Log in to view details") into null. */
function clean(raw: SourceEvent): SourceEvent {
  const event = typeof raw.title === "string" ? { ...raw, title: collapse(raw.title) } : { ...raw };
  event.location = noPlaceholder(event.location) as SourceEvent["location"];
  event.address = noPlaceholder(event.address) as SourceEvent["address"];
  return event;
}

/** The reason to drop an (already cleaned) event, or null to keep it. */
function dropReason(event: SourceEvent, window: ImportWindow): string | null {
  const parsed = SourceEventSchema.safeParse(event);
  if (!parsed.success) return `invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
  const startMs = new Date(event.startsAt).getTime();
  if (startMs < window.start.getTime() || startMs > window.end.getTime()) return "outside import window";
  if (isNonEvent(event)) return "not an event (notice, deadline or placeholder)";
  if (isOnline(event)) return "online event";
  if (isOutsideMassachusetts(event)) return "outside Massachusetts";
  if (event.priceMin !== null && event.priceMax !== null && event.priceMin > event.priceMax) return "priceMin > priceMax";
  return null;
}

export function validateEvents(
  events: SourceEvent[],
  window: ImportWindow,
): { kept: SourceEvent[]; dropped: Dropped[] } {
  const kept: SourceEvent[] = [];
  const dropped: Dropped[] = [];
  for (const raw of events) {
    const event = clean(raw);
    const reason = dropReason(event, window);
    if (reason) dropped.push({ reason, title: String(event.title), source: String(event.source) });
    else kept.push(event);
  }
  return { kept, dropped };
}

export function isUpcoming(startsAt: string, now: Date): boolean {
  const ms = new Date(startsAt).getTime();
  return !Number.isNaN(ms) && ms >= now.getTime();
}
