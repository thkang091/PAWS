import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getTrainingSkills } from "@/services/trainingService";

export const useTrainingSkills = () =>
  useQuery({
    queryKey: queryKeys.trainingSkills,
    queryFn: getTrainingSkills,
  });
