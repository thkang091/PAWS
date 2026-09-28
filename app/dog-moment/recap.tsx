import { MonthlyRecapCard } from "@/features/home/components/dogMoment/MonthlyRecapCard";
import { OnThisDayCard } from "@/features/home/components/dogMoment/OnThisDayCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogMoments } from "@/hooks/useDogMoments";

export default function DogMomentRecapScreen() {
  const dog = useCurrentDog();
  const moments = useDogMoments(dog.data?.id);
  if (dog.isLoading || moments.isLoading) return <ScreenContainer centered><LoadingState message="Loading recap..." /></ScreenContainer>;
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Monthly Recap" subtitle="A private summary of real Dog Moments." />
      <MonthlyRecapCard moments={moments.data ?? []} />
      <OnThisDayCard moment={(moments.data ?? [])[0]} />
    </ScreenContainer>
  );
}
