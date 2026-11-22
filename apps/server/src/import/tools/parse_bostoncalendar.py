"""Convert a Safari "Page Source" save of thebostoncalendar.com into compact JSON.

Usage: python3 -I parse_bostoncalendar.py <saved.html> <out.json>
Output fields mirror the events table in docs/DESIGN.md (price/description/tags left null:
not present on the list page).
"""
import sys, re, json, html
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/New_York")
BASE = "https://www.thebostoncalendar.com"

def clean(x):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x or ""))).strip()

def grab(pat, b):
    m = re.search(pat, b, re.S)
    return m.group(1) if m else None

def parse_time(t):
    # e.g. "Saturday, Nov 21, 2026 3:00p"  or  "Saturday, Nov 21, 2026 goes until 12/31"
    m = re.match(r"\w+, (\w+ \d+, \d{4})(?: (\d{1,2}:\d{2})([ap]))?", t)
    if not m:
        return None, None
    day = datetime.strptime(m.group(1), "%b %d, %Y")
    if m.group(2):
        hh, mm = map(int, m.group(2).split(":"))
        hh = hh % 12 + (12 if m.group(3) == "p" else 0)
        day = day.replace(hour=hh, minute=mm)
    until = grab(r"goes until (\d{1,2}/\d{1,2})", t)
    return day.replace(tzinfo=TZ).isoformat(), until

def big_image(u):
    if not u:
        return None
    return re.sub(r"c_fill,w_\d+,h_\d+[^/]*", "c_fill,w_800,h_600,q_auto", u)

def main(src, out):
    s = open(src, encoding="utf-8", errors="replace").read()
    events, seen = [], set()
    for b in re.split(r'<li class="event"', s)[1:]:
        b = b.split("</li>")[0]
        if "Pinned listing" in b:
            continue  # listicles, not events
        path = grab(r'<h3[^>]*><a href="([^"]+)"', b)
        if not path or path in seen:
            continue
        seen.add(path)
        starts_at, until = parse_time(clean(grab(r'<p class="time">(.*?)</p>', b)))
        lat, lng = grab(r'itemprop="latitude" content="([^"]*)"', b), grab(r'itemprop="longitude" content="([^"]*)"', b)
        street = grab(r'itemprop="streetAddress" content="([^"]*)"', b)
        city = grab(r'itemprop="addressLocality" content="([^"]*)"', b)
        events.append({
            "title": clean(grab(r"<h3[^>]*><a[^>]*>(.*?)</a>", b)),
            "description": None,
            "tags": None,
            "starts_at": starts_at,
            "ongoing_until": until,  # "MM/DD" for exhibits/markets, else null
            "location": clean(grab(r'<p class="location">(.*?)</p>', b)),
            "address": ", ".join(clean(x) for x in (street, city) if x) or None,
            "lat": float(lat) if lat else None,
            "lng": float(lng) if lng else None,
            "image_url": big_image(grab(r'<img[^>]+src="([^"]+)"', b)),
            "source_url": BASE + path if path.startswith("/") else path,
            "price_min": None,
            "price_max": None,
            "source": "thebostoncalendar",
        })
    json.dump(events, open(out, "w"), indent=1, ensure_ascii=False)
    print(f"{len(events)} events -> {out}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
