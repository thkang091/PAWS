import * as Location from "expo-location";

import { lookupPostcode } from "@/services/postcodeService";
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
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
