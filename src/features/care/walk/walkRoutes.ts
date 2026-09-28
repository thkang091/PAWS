export type LatLng = { latitude: number; longitude: number };

export type WalkRoute = {
  id: string;
  name: string;
  note: string;
  distanceKm: number;
  minutes: number;
  path: readonly LatLng[];
};

export type Point = { x: number; y: number };

export const MAP_VIEW = { width: 390, height: 700 } as const;

export const MOCK_BOUNDS = {
  north: 1.2842,
  south: 1.2738,
  west: 103.8436,
  east: 103.8494,
} as const;

export type Bounds = { north: number; south: number; west: number; east: number };

export const project = (point: LatLng, bounds: Bounds = MOCK_BOUNDS): Point => ({
  x: ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * MAP_VIEW.width,
  y: ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * MAP_VIEW.height,
});

const unproject = (point: Point, bounds: Bounds = MOCK_BOUNDS): LatLng => ({
  latitude: bounds.north - (point.y / MAP_VIEW.height) * (bounds.north - bounds.south),
  longitude: bounds.west + (point.x / MAP_VIEW.width) * (bounds.east - bounds.west),
});

const catmullRom = (points: readonly Point[], samples = 10): Point[] => {
  if (points.length < 3) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
};

const traced = (points: readonly Point[]) => catmullRom(points).map((p) => unproject(p));

export const HOME: LatLng = unproject({ x: 104, y: 334 });

export const MOCK_ROUTES: readonly WalkRoute[] = [
  {
    id: "park-loop",
    name: "Telok Ayer Park",
    note: "Shaded, one crossing",
    distanceKm: 1.2,
    minutes: 24,
    path: traced([
      { x: 104, y: 334 },
      { x: 112, y: 290 },
      { x: 146, y: 262 },
      { x: 150, y: 222 },
      { x: 178, y: 184 },
      { x: 228, y: 188 },
      { x: 244, y: 232 },
      { x: 214, y: 270 },
      { x: 160, y: 286 },
      { x: 124, y: 312 },
      { x: 104, y: 334 },
    ]),
  },
  {
    id: "river-path",
    name: "River path",
    note: "Flat, lots to sniff",
    distanceKm: 2.4,
    minutes: 45,
    path: traced([
      { x: 104, y: 334 },
      { x: 84, y: 262 },
      { x: 82, y: 178 },
      { x: 108, y: 128 },
      { x: 176, y: 112 },
      { x: 250, y: 100 },
      { x: 290, y: 128 },
      { x: 292, y: 206 },
      { x: 276, y: 282 },
      { x: 212, y: 318 },
      { x: 150, y: 330 },
      { x: 104, y: 334 },
    ]),
  },
  {
    id: "block",
    name: "Around the block",
    note: "Quick, quiet streets",
    distanceKm: 0.8,
    minutes: 15,
    path: traced([
      { x: 104, y: 334 },
      { x: 150, y: 338 },
      { x: 190, y: 322 },
      { x: 188, y: 294 },
      { x: 146, y: 290 },
      { x: 116, y: 306 },
      { x: 104, y: 334 },
    ]),
  },
];

export const suggestRoutes = async (_origin: LatLng): Promise<readonly WalkRoute[]> => MOCK_ROUTES;

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

export const pointAlong = (path: readonly LatLng[], fraction: number): LatLng => {
  if (path.length === 0) return HOME;
  const target = pathLengthKm(path) * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const leg = haversineKm(path[i - 1], path[i]);
    if (walked + leg >= target) {
      const t = leg === 0 ? 0 : (target - walked) / leg;
      return {
        latitude: path[i - 1].latitude + (path[i].latitude - path[i - 1].latitude) * t,
        longitude: path[i - 1].longitude + (path[i].longitude - path[i - 1].longitude) * t,
      };
    }
    walked += leg;
  }
  return path[path.length - 1];
};

export const svgPath = (points: readonly Point[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

export const svgLength = (points: readonly Point[]) =>
  points.reduce(
    (total, p, i) => (i === 0 ? 0 : total + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)),
    0,
  );

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
  if (path.length === 0) {
    return { latitude: HOME.latitude, longitude: HOME.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }
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
