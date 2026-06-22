import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getDogRoadmap } from "@/services/curriculumService";
import type { PersonalizedRoadmapDay } from "@/types/domain";

export const useDogRoadmap = (dogId: string | undefined) => {
  const query = useQuery({
    queryKey: dogId ? queryKeys.dogRoadmap(dogId) : ["dogRoadmap", "missing"],
    queryFn: () => getDogRoadmap(dogId ?? ""),
    enabled: Boolean(dogId),
  });

  const roadmap = query.data ?? null;
  const days: PersonalizedRoadmapDay[] = roadmap?.days ?? [];
  const todayDay = days.find((d) => d.completedAt === null) ?? null;

  return {
    roadmap,
    days,
    todayDay,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
