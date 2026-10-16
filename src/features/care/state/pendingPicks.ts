import type { Product } from "@/services/productLookup";
import type { TreatRole } from "@/features/care/food/options";

/**
 * Products picked while browsing, waiting for Food Plan setup to start with them. Held in memory for one hand-off:
 * the browse screen sets them right before opening setup, and setup takes them once.
 */
export type PendingPicks = { food: Product | null; treats: readonly { product: Product; role: TreatRole }[] };

let pending: PendingPicks | null = null;

export const setPendingPicks = (picks: PendingPicks) => {
  pending = picks;
};

export const takePendingPicks = () => {
  const picks = pending;
  pending = null;
  return picks;
};
