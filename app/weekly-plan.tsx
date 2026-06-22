import { useMemo } from "react";
import { Text } from "react-native";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AppButton } from "@/components/ui/AppButton";
import { WeeklyPlanDaySection } from "@/components/weeklyPlan/WeeklyPlanDaySection";
import { WeeklyPlanProgress } from "@/components/weeklyPlan/WeeklyPlanProgress";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useCompleteWeeklyPlanItem, useRegenerateWeeklyPlan, useWeeklyPlan } from "@/hooks/useWeeklyPlan";
import { weekStartKey } from "@/services/weeklyPlanService";

export default function WeeklyPlanScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const weekStart = weekStartKey();
  const plan = useWeeklyPlan(dogId, weekStart);
  const regenerate = useRegenerateWeeklyPlan(dogId, weekStart);
  const complete = useCompleteWeeklyPlanItem(dogId, weekStart);
  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof plan.data>["items"]>();
    for (const item of plan.data?.items ?? []) {
      map.set(item.scheduledDate, [...(map.get(item.scheduledDate) ?? []), item]);
    }
    return [...map.entries()];
  }, [plan.data?.items]);

  if (dog.isLoading || plan.isLoading) return <ScreenContainer centered><LoadingState message="Loading weekly plan..." /></ScreenContainer>;
  if (plan.error || !plan.data) return <ScreenContainer centered><ErrorState message={plan.error?.message ?? "Weekly plan could not load."} onRetry={() => void plan.refetch()} /></ScreenContainer>;

  return (
    <ScreenContainer scroll>
      <SectionHeader title="Weekly Plan" subtitle={plan.data.generatedReason} action={<AppButton title="Regenerate" variant="secondary" loading={regenerate.isPending} onPress={() => regenerate.mutate()} />} />
      <WeeklyPlanProgress items={plan.data.items} />
      {grouped.map(([date, items]) => <WeeklyPlanDaySection key={date} date={date} items={items} loading={complete.isPending} onComplete={(itemId) => complete.mutate(itemId)} />)}
      {complete.error ? <Text>{complete.error.message}</Text> : null}
    </ScreenContainer>
  );
}
