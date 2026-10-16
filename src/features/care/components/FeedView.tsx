import { memo } from "react";

import { FoodPlanHome } from "@/features/care/food/FoodPlanHome";

/** Feed is the Food Plan: what the dog eats, whether it fits, and how to change it. */
export const FeedView = memo((_: { dogId: string; onOpen: (href: string) => void }) => <FoodPlanHome />);

FeedView.displayName = "FeedView";
