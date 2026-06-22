import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCurrentProfile } from "@/services/profileService";

export const useCurrentProfile = () =>
  useQuery({
    queryKey: queryKeys.profile,
    queryFn: getCurrentProfile,
  });
