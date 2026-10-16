import { useEffect, useState } from "react";
import * as Location from "expo-location";

import { buildOptions, findSpots, loopVia, routingConfigured, type PlannedRoute, type Spot } from "@/features/care/walk/routePlanner";
import type { WalkStart } from "@/features/care/walk/walkHandoff";
import type { LatLng } from "@/features/care/walk/walkRoutes";
import { currentPlace } from "@/services/placeSearch";

export type StartState = { status: "locating" } | { status: "ready"; start: WalkStart } | { status: "failed"; reason: "denied" | "offline" };

export const useWalkStart = (initial?: WalkStart | null) => {
  const [state, setState] = useState<StartState>(initial ? { status: "ready", start: initial } : { status: "locating" });

  const locate = () => {
    setState({ status: "locating" });
    void currentPlace().then((result) => {
      // No silent fallback to a saved address: a walk that quietly starts at Home, miles away, is worse than asking.
      if (result.state === "found") {
        setState({ status: "ready", start: { point: result.place, label: "Current location", source: "here" } });
      } else {
        setState({ status: "failed", reason: result.state === "denied" ? "denied" : "offline" });
      }
    });
  };

  useEffect(() => {
    // A plan saved from "here" means wherever the phone is when you open it, not where it was when you planned.
    if (!initial || initial.source === "here") locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    setStart: (start: WalkStart) => setState({ status: "ready", start }),
    locate,
  };
};

export type OptionsState = {
  loading: boolean;
  spots: readonly Spot[];
  routes: readonly PlannedRoute[];
  failed: boolean;
};

export const useRouteOptions = (start: LatLng | null, minutes: number, pinned: readonly PlannedRoute[] = []) => {
  const [state, setState] = useState<OptionsState & { key: string | null }>({ key: null, loading: true, spots: [], routes: [], failed: false });

  const key = start ? `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}` : null;

  useEffect(() => {
    if (!start) return;
    let live = true;
    // A new start makes the old routes wrong, so drop them rather than show them from the wrong place.
    setState((current) =>
      current.key === key ? { ...current, loading: true, failed: false } : { key, loading: true, spots: [], routes: [], failed: false },
    );
    void (async () => {
      const spots = await findSpots(start);
      if (!live) return;
      setState((current) => ({ ...current, spots }));
      const routes = await buildOptions(start, minutes, spots);
      if (!live) return;
      setState({ key, loading: false, spots, routes, failed: routes.length === 0 });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, minutes]);

  const { key: _key, ...rest } = state;
  return { ...rest, routes: [...pinned, ...rest.routes], configured: routingConfigured };
};

export const routeToSpot = (start: LatLng, spot: Spot) => loopVia(start, spot, spot.name, "spot", `spot-${spot.id}`);

const streetAt = async (point: LatLng) => {
  try {
    const [hit] = await Location.reverseGeocodeAsync(point);
    const street = hit?.street ?? hit?.name ?? null;
    return street ? `To ${street}` : "To your pin";
  } catch {
    return "To your pin";
  }
};

export const routeToPin = async (start: LatLng, pin: LatLng) =>
  loopVia(start, pin, await streetAt(pin), "pin", `pin-${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}`);

/** A walk out to a searched place and back again. */
export const routeToPlace = (start: LatLng, place: { id: string; name: string; latitude: number; longitude: number; park: boolean }) =>
  loopVia(start, { latitude: place.latitude, longitude: place.longitude }, place.name, place.park ? "spot" : "pin", `place-${place.id}`);
