import { Alert, Linking } from 'react-native';
import type { Card } from '../api';

const MAPS_DIR = 'https://www.google.com/maps/dir/?api=1&destination=';

/**
 * Google Maps directions link to an event, or null if we don't know where it is.
 * Prefers the location text so Maps resolves the actual named venue (our coords
 * are rough), else exact coordinates (0 is valid, so no truthiness checks).
 *
 * `travelmode` and `dir_action=navigate` are deliberately omitted: Maps opens
 * in route preview so the user picks how they're getting there and hits Start.
 */
export function directionsUrl(event: Pick<Card, 'lat' | 'lng' | 'location'>): string | null {
  const place = event.location?.trim();
  if (place) return `${MAPS_DIR}${encodeURIComponent(place)}`;
  const { lat, lng } = event;
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${MAPS_DIR}${lat},${lng}` : null;
}

/** Hand off to Maps; tell the user if the hand-off fails. */
export function openDirections(url: string) {
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open Maps", 'Try again in a sec.'));
}
