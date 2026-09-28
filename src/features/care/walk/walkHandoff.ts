import type { LatLng } from "@/features/care/walk/walkRoutes";
import type { PlannedRoute } from "@/features/care/walk/routePlanner";

export type WalkStart = { point: LatLng; label: string; source: "here" | "home" | "search" };

type Handoff = { route: PlannedRoute; start: WalkStart } | null;

let pending: Handoff = null;

export const handOffWalk = (route: PlannedRoute, start: WalkStart) => {
  pending = { route, start };
};

export const takeHandoff = (): Handoff => {
  const out = pending;
  pending = null;
  return out;
};
