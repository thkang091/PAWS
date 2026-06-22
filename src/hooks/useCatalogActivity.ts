import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCatalogActivity } from "@/services/curriculumService";

export const useCatalogActivity = (activityId: string | undefined) =>
  useQuery({
    queryKey: activityId ? queryKeys.catalogActivity(activityId) : ["catalogActivity", "missing"],
    queryFn: () => getCatalogActivity(activityId ?? ""),
    enabled: Boolean(activityId),
  });
