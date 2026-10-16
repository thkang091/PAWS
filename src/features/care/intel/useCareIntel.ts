import { useMemo } from "react";

import { ageInMonths } from "@/constants/carePlanByAge";
import { isoOf, lifeStageOf, mobilityOf, sizeOf } from "@/features/care/intel/careIntel";
import { useCareLog } from "@/features/care/state/careLog";
import { useCheckInHistory } from "@/features/care/state/dailyCheckIn";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWeightLogs } from "@/hooks/useWeightLogs";

/** Everything the care layer knows about the dog right now, computed once and shared by every Care screen. */
export const useCareIntel = () => {
  const dog = useCurrentDog();
  const weights = useWeightLogs(dog.data?.id);
  const log = useCareLog();
  const history = useCheckInHistory();

  return useMemo(() => {
    const latest = weights.data?.[0];
    const kg = latest ? (latest.weightUnit === "kg" ? latest.weightValue : latest.weightValue * 0.4536) : null;
    const size = sizeOf(dog.data?.breed, kg);
    const months = ageInMonths(dog.data?.birthday ?? null, dog.data?.ageYears ?? null);
    const stage = lifeStageOf(months, size);
    const today = isoOf(Date.now());
    return {
      name: dog.data?.name ?? "your dog",
      size,
      stage,
      today,
      log: log.entries,
      mobility: mobilityOf(history, today),
    };
  }, [dog.data, weights.data, log.entries, history]);
};
