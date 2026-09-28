import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import { pointAlong, type LatLng, type WalkRoute } from "@/features/care/walk/walkRoutes";

export type LocationPermission = "granted" | "denied" | "unavailable" | "pending";

export type WalkSample = {
  elapsed: number;
  distanceKm: number;
  progress: number;
  position: LatLng;
  /** The dog's real path this walk, in order. Empty until a GPS fix arrives. */
  trail: readonly LatLng[];
  permission: LocationPermission;
};

/** Two GPS fixes further apart than this are a jump (tunnel, lost signal), not a step. */
const MAX_JUMP_KM = 0.12;
/** A fix worse than this many metres is too noisy to trust for distance. */
const MAX_ACCURACY_M = 25;

const haversineKm = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export const useWalkTracker = (route: WalkRoute, running: boolean): WalkSample => {
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [trail, setTrail] = useState<LatLng[]>([]);
  const [permission, setPermission] = useState<LocationPermission>("pending");
  const last = useRef<LatLng | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  // Elapsed time runs off a plain clock, independent of GPS fix cadence.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) {
      watcher.current?.remove();
      watcher.current = null;
      return;
    }

    let cancelled = false;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({
        status: "denied" as const,
      }));
      if (cancelled) return;
      if (status !== "granted") {
        setPermission("denied");
        return;
      }
      setPermission("granted");

      watcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (fix) => {
          const here: LatLng = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
          const accuracy = fix.coords.accuracy ?? MAX_ACCURACY_M;
          const previous = last.current;
          last.current = here;
          setTrail((current) => [...current, here]);

          if (!previous || accuracy > MAX_ACCURACY_M) return;
          const leg = haversineKm(previous, here);
          if (leg <= 0 || leg > MAX_JUMP_KM) return;
          setDistanceKm((current) => current + leg);
        },
      ).catch(() => {
        setPermission("unavailable");
        return null;
      });
    };

    void start();

    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [running]);

  const progress = route.distanceKm > 0 ? Math.min(1, distanceKm / route.distanceKm) : 0;
  const position = trail.length > 0 ? trail[trail.length - 1] : pointAlong(route.path, progress);

  return { elapsed, distanceKm, progress, position, trail, permission };
};
