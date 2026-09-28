import { useEffect, useState } from "react";

import { useCareLocations } from "@/features/care/state/careLocations";
import { buildOptions, findSpots, loopVia, routingConfigured, type PlannedRoute, type Spot } from "@/features/care/walk/routePlanner";
import type { WalkStart } from "@/features/care/walk/walkHandoff";
import type { LatLng } from "@/features/care/walk/walkRoutes";
import { currentPlace } from "@/services/placeSearch";

export type StartState = { status: "locating" } | { status: "ready"; start: WalkStart } | { status: "failed"; reason: "denied" | "offline" };

export const useWalkStart = (initial?: WalkStart | null) => {
  const { home } = useCareLocations();
  const [state, setState] = useState<StartState>(initial ? { status: "ready", start: initial } : { status: "locating" });

  const locate = () => {
    setState({ status: "locating" });
    void currentPlace().then((result) => {
      if (result.state === "found") {
        setState({ status: "ready", start: { point: result.place, label: "Current location", source: "here" } });
      } else if (home) {
        setState({ status: "ready", start: { point: home, label: home.label, source: "home" } });
      } else {
        setState({ status: "failed", reason: result.state === "denied" ? "denied" : "offline" });
      }
    });
  };

  useEffect(() => {
    if (!initial) locate();
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
  const [state, setState] = useState<OptionsState>({ loading: true, spots: [], routes: [], failed: false });

  const key = start ? `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}` : null;

  useEffect(() => {
    if (!start) return;
    let live = true;
    setState((current) => ({ ...current, loading: true, failed: false }));
    void (async () => {
      const spots = await findSpots(start);
      if (!live) return;
      setState((current) => ({ ...current, spots }));
      const routes = await buildOptions(start, minutes, spots);
      if (!live) return;
      setState({ loading: false, spots, routes, failed: routes.length === 0 });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, minutes]);

  return { ...state, routes: [...pinned, ...state.routes], configured: routingConfigured };
};

export const routeToSpot = (start: LatLng, spot: Spot) => loopVia(start, spot, spot.name, "spot", `spot-${spot.id}`);

export const routeToPin = (start: LatLng, pin: LatLng) =>
  loopVia(start, pin, "To your pin", "pin", `pin-${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}`);
