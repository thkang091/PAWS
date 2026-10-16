import * as Location from "expo-location";

import { lookupPostcode } from "@/services/postcodeService";
import { serpSearch } from "@/services/serpApi";
import type { SavedPlace } from "@/features/care/state/careLocations";

export type PlaceResult =
  | { state: "found"; place: SavedPlace }
  | { state: "notFound" }
  | { state: "denied" }
  | { state: "offline" };

const POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{5}(-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i;

const labelFor = async (latitude: number, longitude: number, fallback: string) => {
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!hit) return fallback;
    const street = [hit.streetNumber, hit.street].filter(Boolean).join(" ");
    const area = hit.city ?? hit.subregion ?? hit.district ?? "";
    const region = hit.region ?? "";
    const head = street || hit.name || "";
    return [head, area, region].filter((part, index, all) => part && all.indexOf(part) === index).join(", ") || fallback;
  } catch {
    return fallback;
  }
};

export const resolvePlace = async (raw: string): Promise<PlaceResult> => {
  const query = raw.trim();
  if (query.length < 3) return { state: "notFound" };

  try {
    const [hit] = await Location.geocodeAsync(query);
    if (hit) {
      return {
        state: "found",
        place: {
          query,
          latitude: hit.latitude,
          longitude: hit.longitude,
          label: await labelFor(hit.latitude, hit.longitude, query),
        },
      };
    }
  } catch {
    // Native geocoder unavailable; the postcode directory below still covers ZIP codes.
  }

  if (!POSTCODE.test(query)) return { state: "notFound" };

  const lookup = await lookupPostcode(query);
  if (lookup.state === "found") {
    const { place } = lookup;
    return {
      state: "found",
      place: {
        query,
        latitude: place.latitude,
        longitude: place.longitude,
        label: [place.town, place.region].filter(Boolean).join(", "),
      },
    };
  }
  return lookup.state === "offline" ? { state: "offline" } : { state: "notFound" };
};

export const currentPlace = async (): Promise<PlaceResult> => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return { state: "denied" };
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
    ]);
    const { latitude, longitude } = fix.coords;
    const label = await labelFor(latitude, longitude, "Current location");
    return { state: "found", place: { query: label, latitude, longitude, label } };
  } catch {
    return { state: "offline" };
  }
};

export const mapsSearchUrl = (query: string, near: { latitude: number; longitude: number } | null) =>
  near
    ? `https://maps.apple.com/?q=${encodeURIComponent(query)}&sll=${near.latitude},${near.longitude}`
    : `https://maps.apple.com/?q=${encodeURIComponent(query)}`;

export const directionsUrl = (address: string) =>
  `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;

export type PlaceHit = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  park: boolean;
};

const PARKISH = /park|garden|playground|trail|green|dog run|beach|square|plaza|reserve/i;

type RawPlace = {
  place_id?: string;
  data_id?: string;
  title?: string;
  address?: string;
  type?: string;
  types?: string[];
  gps_coordinates?: { latitude?: number; longitude?: number };
};

const toHit = (row: RawPlace): PlaceHit | null => {
  const latitude = row.gps_coordinates?.latitude;
  const longitude = row.gps_coordinates?.longitude;
  if (!row.title || typeof latitude !== "number" || typeof longitude !== "number") return null;
  const kinds = [row.type, ...(row.types ?? [])].filter(Boolean).join(" ");
  return {
    id: row.place_id ?? row.data_id ?? `${row.title}-${latitude.toFixed(4)}`,
    name: row.title,
    address: row.address ?? null,
    latitude,
    longitude,
    park: PARKISH.test(kinds) || PARKISH.test(row.title),
  };
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const kmBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Google Maps search near a point, with the device geocoder as a fallback for plain addresses. */
export const searchPlaces = async (
  raw: string,
  near: { latitude: number; longitude: number } | null,
): Promise<{ state: "found"; hits: PlaceHit[] } | { state: "empty" } | { state: "offline" }> => {
  const query = raw.trim();
  if (query.length < 2) return { state: "empty" };

  const feed = await serpSearch<PlaceHit>(
    {
      engine: "google_maps",
      q: query,
      type: "search",
      hl: "en",
      ...(near ? { ll: `@${near.latitude},${near.longitude},14z` } : {}),
    },
    (body) => {
      const rows = (body.local_results as RawPlace[] | undefined) ?? [];
      const single = body.place_results as RawPlace | undefined;
      return [...(single ? [single] : []), ...rows].map(toHit).filter((hit): hit is PlaceHit => hit !== null);
    },
  );

  let hits = feed.state === "ready" ? [...feed.items] : [];
  if (hits.length === 0) {
    const fallback = await resolvePlace(query);
    if (fallback.state === "found") {
      const [head, ...rest] = fallback.place.label.split(", ");
      hits = [
        {
          id: `geo-${fallback.place.latitude.toFixed(5)},${fallback.place.longitude.toFixed(5)}`,
          name: head,
          address: rest.join(", ") || null,
          latitude: fallback.place.latitude,
          longitude: fallback.place.longitude,
          park: PARKISH.test(head),
        },
      ];
    } else if (feed.state === "offline" && fallback.state === "offline") {
      return { state: "offline" };
    }
  }
  if (near) hits.sort((a, b) => kmBetween(near, a) - kmBetween(near, b));
  const seen = new Set<string>();
  hits = hits.filter((hit) => (seen.has(hit.id) ? false : (seen.add(hit.id), true))).slice(0, 6);
  return hits.length ? { state: "found", hits } : { state: "empty" };
};
