export type LatLng = { latitude: number; longitude: number };

export type WalkRoute = {
  id: string;
  name: string;
  note: string;
  distanceKm: number;
  minutes: number;
  path: readonly LatLng[];
};

const haversineKm = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export const pathLengthKm = (path: readonly LatLng[]) =>
  path.reduce((total, point, index) => (index === 0 ? 0 : total + haversineKm(path[index - 1], point)), 0);

/** The route path up to how far along it a guardian has walked, for the "already covered" polyline. */
export const pathUpTo = (path: readonly LatLng[], fraction: number): LatLng[] => {
  if (path.length === 0) return [];
  const clamped = Math.min(1, Math.max(0, fraction));
  if (clamped <= 0) return [path[0]];
  const target = pathLengthKm(path) * clamped;
  let walked = 0;
  const out: LatLng[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const leg = haversineKm(path[i - 1], path[i]);
    if (walked + leg >= target) {
      const t = leg === 0 ? 0 : (target - walked) / leg;
      out.push({
        latitude: path[i - 1].latitude + (path[i].latitude - path[i - 1].latitude) * t,
        longitude: path[i - 1].longitude + (path[i].longitude - path[i - 1].longitude) * t,
      });
      return out;
    }
    walked += leg;
    out.push(path[i]);
  }
  return out;
};

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** A camera region that frames a path with breathing room on every side. */
export const regionFor = (path: readonly LatLng[], padding = 1.6): Region => {
  if (path.length === 0) return { latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 90 };
  const lats = path.map((p) => p.latitude);
  const lngs = path.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const MIN_DELTA = 0.004;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * padding),
  };
};

export const formatClock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
};

export const formatPace = (seconds: number, km: number) => {
  if (km < 0.02) return "Not yet";
  const perKm = Math.round(seconds / km);
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, "0")}`;
};
