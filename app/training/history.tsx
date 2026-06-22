import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkillProgressChart } from "@/components/trainingSession/SkillProgressChart";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";

export default function TrainingHistoryScreen() {
  const dog = useCurrentDog();
  const progress = useTrainingProgress(dog.data?.id);
  if (dog.isLoading || progress.isLoading) return <ScreenContainer centered><LoadingState message="Loading history..." /></ScreenContainer>;
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Training History" subtitle="Real skill progress from completed sessions." />
      {(progress.data ?? []).length === 0 ? <EmptyState title="No completed sessions yet" description="Start a guided session from a skill to build history." /> : <SkillProgressChart progress={progress.data ?? []} />}
    </ScreenContainer>
  );
}
