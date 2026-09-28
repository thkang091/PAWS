import Constants from "expo-constants";

import { serpSearch } from "@/services/serpApi";
import type { LatLng, WalkRoute } from "@/features/care/walk/walkRoutes";

const KEY = (Constants.expoConfig?.extra as { googleMapsKey?: string | null } | undefined)?.googleMapsKey ?? null;

export const routingConfigured = Boolean(KEY);

/** Dogs stop to sniff. Google's walking pace is for people, so stretch it a little. */
const DOG_PACE = 1.2;
const PERSON_KMH = 4.8;

export type Spot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  kind: string | null;
  km: number;
};

export type RouteKind = "spot" | "block" | "pin";

export type PlannedRoute = WalkRoute & { kind: RouteKind; via: LatLng | null };

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const distanceKm = (a: LatLng, b: LatLng) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const offset = (from: LatLng, km: number, bearingDeg: number): LatLng => {
  const R = 6371;
  const d = km / R;
  const b = toRad(bearingDeg);
  const lat1 = toRad(from.latitude);
  const lng1 = toRad(from.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
};

export const decodePolyline = (encoded: string): LatLng[] => {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return out;
};

export const encodePolyline = (points: readonly LatLng[]): string => {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);
    out += encode(lat - prevLat) + encode(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
};

type Walked = { path: LatLng[]; km: number; minutes: number };

const cache = new Map<string, Walked>();

const round = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;

export const walkThrough = async (points: readonly LatLng[]): Promise<Walked | null> => {
  if (!KEY || points.length < 2) return null;
  const cacheKey = points.map(round).join("|");
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.latitude, longitude: p.longitude } } });
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(points[0]),
        destination: waypoint(points[points.length - 1]),
        intermediates: points.slice(1, -1).map(waypoint),
        travelMode: "WALK",
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
    };
    const route = body.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return null;
    const km = (route.distanceMeters ?? 0) / 1000;
    const seconds = Number((route.duration ?? "0s").replace("s", ""));
    const walked: Walked = {
      path: decodePolyline(route.polyline.encodedPolyline),
      km,
      minutes: Math.max(5, Math.round(((seconds || (km / PERSON_KMH) * 3600) / 60) * DOG_PACE)),
    };
    cache.set(cacheKey, walked);
    return walked;
  } catch {
    return null;
  }
};

const spotCache = new Map<string, Spot[]>();

export const findSpots = async (center: LatLng): Promise<Spot[]> => {
  const cacheKey = `${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}`;
  const hit = spotCache.get(cacheKey);
  if (hit) return hit;
  type Raw = { place_id?: string; title?: string; rating?: number; type?: string; gps_coordinates?: { latitude?: number; longitude?: number } };
  const feed = await serpSearch<Spot>(
    { engine: "google_maps", q: "park", ll: `@${center.latitude},${center.longitude},15z`, type: "search", hl: "en" },
    (body) =>
      ((body.local_results as Raw[] | undefined) ?? [])
        .filter((row) => row.title && typeof row.gps_coordinates?.latitude === "number")
        .map((row) => {
          const at = { latitude: row.gps_coordinates!.latitude!, longitude: row.gps_coordinates!.longitude! };
          return {
            id: row.place_id ?? row.title!,
            name: row.title!,
            ...at,
            rating: typeof row.rating === "number" ? row.rating : null,
            kind: row.type ?? null,
            km: distanceKm(center, at),
          };
        })
        .filter((spot) => spot.km <= 2.5)
        .sort((a, b) => a.km - b.km)
        .slice(0, 8),
  );
  const spots = feed.state === "ready" ? [...feed.items] : [];
  if (spots.length) spotCache.set(cacheKey, spots);
  return spots;
};

const describe = (km: number, minutes: number) => `${km.toFixed(1)} km, about ${minutes} min`;

export const blockLoop = async (start: LatLng, targetMinutes: number): Promise<PlannedRoute | null> => {
  const targetKm = ((targetMinutes / DOG_PACE) * PERSON_KMH) / 60;
  const leg = Math.max(0.15, targetKm / 3.6);
  const heading = (start.latitude * 1000 + start.longitude * 1000) % 360;
  const a = offset(start, leg, heading);
  const b = offset(start, leg, heading + 70);
  const walked = await walkThrough([start, a, b, start]);
  if (!walked) return null;
  return {
    id: `block-${targetMinutes}`,
    kind: "block",
    via: null,
    name: "Around the block",
    note: "A loop from your door",
    distanceKm: walked.km,
    minutes: walked.minutes,
    path: walked.path,
  };
};

export const loopVia = async (start: LatLng, target: LatLng, name: string, kind: RouteKind, id: string): Promise<PlannedRoute | null> => {
  const walked = await walkThrough([start, target, start]);
  if (!walked) return null;
  return {
    id,
    kind,
    via: target,
    name,
    note: kind === "pin" ? "There and back" : `Loop via ${name}`,
    distanceKm: walked.km,
    minutes: walked.minutes,
    path: walked.path,
  };
};

export const buildOptions = async (start: LatLng, targetMinutes: number, spots: readonly Spot[]): Promise<PlannedRoute[]> => {
  const reachable = spots.filter((spot) => spot.km <= Math.max(0.6, (targetMinutes / 60) * 2.2)).slice(0, 2);
  const results = await Promise.all([
    ...reachable.map((spot) => loopVia(start, spot, spot.name, "spot", `spot-${spot.id}`)),
    blockLoop(start, targetMinutes),
  ]);
  return results.filter((route): route is PlannedRoute => Boolean(route));
};

export const summary = (route: Pick<WalkRoute, "distanceKm" | "minutes">) => describe(route.distanceKm, route.minutes);
