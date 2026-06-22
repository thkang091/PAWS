import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getProfileDashboard } from "@/services/profileService";

export const useProfileDashboard = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.dashboard(dogId) : ["dashboard", "missing"],
    queryFn: () => getProfileDashboard(dogId ?? ""),
    enabled: Boolean(dogId),
  });
