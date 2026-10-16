import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { bg, layout, space, text, type } from "@/constants/design";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { getDogTrainingOverview } from "@/services/trainingCurriculumService";
import { areLessonVideosUnlocked } from "@/features/train/media/lessonVideoUnlock";

export default function TrainingHistoryScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const overview = useQuery({
    queryKey: dogId ? queryKeys.dogTrainingOverview(dogId) : ["dogTrainingOverview", "missing"],
    queryFn: () => getDogTrainingOverview(dogId ?? ""),
    enabled: Boolean(dogId),
  });

  if (dog.isLoading || overview.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState message="Loading history…" />
      </SafeAreaView>
    );
  }

  const rows = overview.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Training history</Text>
        <Text style={styles.subtitle}>Real skill progress from completed Lessons.</Text>

        {rows.length === 0 ? (
          <EmptyState
            title="No Lessons completed yet"
            description="Start a Lesson from a Skill on a roadmap to build history here."
          />
        ) : (
          <View style={styles.stack}>
            {rows.map((row) => {
              const complete = areLessonVideosUnlocked(row.progress);
              const fraction = complete ? 1 : (row.progress.currentLevelNumber - 1) / 5;
              return (
                <View key={row.skill.id} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{row.skill.title}</Text>
                    <Text style={styles.rowSection}>{row.sectionTitle}</Text>
                  </View>
                  <ProgressBar accessibilityLabel={`${row.skill.title} progress`} progress={Math.max(0, Math.min(1, fraction))} />
                  <Text style={styles.rowStatus}>
                    {complete
                      ? "Lesson complete"
                      : row.progress.needsReinforcement ? "Practice to revisit"
                      : `Level ${row.progress.currentLevelNumber} of 5`}
                    {row.progress.reviewSoon ? " · Review scheduled" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.section },
  title: { ...type.pageTitle, color: text.primary },
  subtitle: { ...type.body, color: text.secondary, marginTop: space.xs, marginBottom: space.xl },
  stack: { gap: space.lg },
  row: { gap: space.sm },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowSection: { ...type.caption, color: text.secondary },
  rowStatus: { ...type.caption, color: text.secondary },
});
