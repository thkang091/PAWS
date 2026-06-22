import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCurrentDog } from "@/services/profileService";

export const useCurrentDog = () =>
  useQuery({
    queryKey: queryKeys.currentDog,
    queryFn: getCurrentDog,
  });
