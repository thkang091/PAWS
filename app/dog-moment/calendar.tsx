import { DogMomentCalendar } from "@/components/dogMoment/DogMomentCalendar";
import { DogMomentTimeline } from "@/components/dogMoment/DogMomentTimeline";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogMoments } from "@/hooks/useDogMoments";

export default function DogMomentCalendarScreen() {
  const dog = useCurrentDog();
  const moments = useDogMoments(dog.data?.id);
  if (dog.isLoading || moments.isLoading) return <ScreenContainer centered><LoadingState message="Loading memory calendar..." /></ScreenContainer>;
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Moment Calendar" subtitle="Private-by-default memories from real uploads." />
      <DogMomentCalendar moments={moments.data ?? []} />
      <DogMomentTimeline moments={moments.data ?? []} />
    </ScreenContainer>
  );
}
