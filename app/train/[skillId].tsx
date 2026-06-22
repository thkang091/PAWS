import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { getActivityDefinition } from "@/config/activityDefinitions";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useTrainingSkills } from "@/hooks/useTrainingSkills";

const corgiImage = require("../../assets/training/corgi-sit-lesson.png");

export default function TrainSkillDetailScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const dog = useCurrentDog();
  const skills = useTrainingSkills();
  const progress = useTrainingProgress(dog.data?.id);
  const skill = useMemo(() => (skills.data ?? []).find((item) => item.id === skillId), [skillId, skills.data]);
  const skillProgress = useMemo(() => (progress.data ?? []).find((item) => item.skillId === skillId), [progress.data, skillId]);
  const verificationActivityId = useMemo(() => {
    if (!skill) return null;
    const mapped = skill.slug === "paw-shake" ? "paw" : skill.slug === "roll-over" ? "roll_over" : skill.slug.includes("recall") || skill.slug === "come" ? "recall" : skill.slug;
    return getActivityDefinition(mapped) ? mapped : null;
  }, [skill]);

  if (dog.isLoading || skills.isLoading || progress.isLoading) return <ScreenContainer centered><LoadingState message="Loading lesson..." /></ScreenContainer>;
  if (!dog.data || !skill) return <ScreenContainer centered><ErrorState message="Training lesson not found." /></ScreenContainer>;

  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <Image source={corgiImage} style={styles.heroImage} />
        <Text style={styles.title}>{skill.name} Command</Text>
        <View style={styles.pill}><Text style={styles.pillText}>Foundation Lesson</Text></View>
      </View>

      <View style={styles.statsRow}>
        <StatCard icon="star" tint="#ECE99D" label="Difficulty" value={skill.difficulty <= 1 ? "Easy" : skill.difficulty === 2 ? "Medium" : "Hard"} />
        <StatCard icon="timer-outline" tint="#EBD9E9" label="Time" value={`${skill.estimatedMinutes - 2}–${skill.estimatedMinutes}m`} />
        <StatCard icon="currency-usd" tint="#DDE1CF" label="Rewards" value={`+${skill.silverReward}`} />
      </View>

      <View>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.body}>
          Teach your dog to {skill.name} to build Focus and Discipline. This is the foundation for obedience and a crucial first step in building a strong, communicative bond with your furry friend.
        </Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>What {dog.data.name} Learns</Text>
        <GrowthCard icon="head-cog-outline" label="Focus" amount="+15 XP" progress={0.72} />
        <GrowthCard icon="meditation" label="Discipline" amount="+25 XP" progress={0.84} />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Lesson Progress</Text>
          <Text style={styles.progressPercent}>{skillProgress?.completionPercentage ?? 0}%</Text>
        </View>
        <ProgressBar accessibilityLabel={`${skill.name} progress`} progress={(skillProgress?.completionPercentage ?? 0) / 100} />
      </View>

      <Pressable style={styles.startButton} onPress={() => router.push(`/training/session/${skill.id}`)}>
        <Text style={styles.startText}>Start Lesson</Text>
        <Ionicons name="play" size={16} color={theme.colors.white} />
      </Pressable>

      {verificationActivityId ? (
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/activity/${verificationActivityId}?context=training`)}>
          <MaterialCommunityIcons name="camera-iris" size={18} color={theme.colors.primaryDark} />
          <Text style={styles.secondaryText}>Practice with AI</Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const StatCard = ({ icon, tint, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; label: string; value: string }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: tint }]}>
      <MaterialCommunityIcons name={icon} size={20} color="#697056" />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const GrowthCard = ({ icon, label, amount, progress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; amount: string; progress: number }) => (
  <View style={styles.growthCard}>
    <View style={styles.growthIcon}><MaterialCommunityIcons name={icon} size={20} color="#697056" /></View>
    <View style={styles.growthContent}>
      <View style={styles.growthTop}>
        <Text style={styles.growthLabel}>{label}</Text>
        <Text style={styles.growthAmount}>{amount}</Text>
      </View>
      <ProgressBar accessibilityLabel={`${label} growth`} progress={progress} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  hero: { alignItems: "center", backgroundColor: "#E5E3D7", borderRadius: 28, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl, overflow: "hidden" },
  heroImage: { width: 174, height: 174, borderRadius: 12, marginBottom: theme.spacing.xl },
  title: { color: "#111411", fontSize: 24, fontWeight: "900", letterSpacing: 0 },
  pill: { marginTop: theme.spacing.sm, backgroundColor: "#EAE8DC", borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing.lg, paddingVertical: 5 },
  pillText: { color: "#65695A", fontSize: 13, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: theme.spacing.md },
  statCard: { flex: 1, minHeight: 104, backgroundColor: "#FFFCF8", borderRadius: 12, borderWidth: 1, borderColor: "#EEE7DB", alignItems: "center", justifyContent: "center", gap: 5, ...theme.shadows.soft },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" },
  statValue: { color: "#171B17", fontSize: 18, fontWeight: "900" },
  sectionTitle: { color: "#171B17", fontSize: 20, fontWeight: "900", marginBottom: theme.spacing.sm },
  body: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 24 },
  growthCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: "#FFFCF8", borderRadius: 12, borderWidth: 1, borderColor: "#EDE6DA", padding: theme.spacing.md, marginBottom: theme.spacing.md, ...theme.shadows.soft },
  growthIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#F0F0D2", alignItems: "center", justifyContent: "center" },
  growthContent: { flex: 1, gap: theme.spacing.sm },
  growthTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  growthLabel: { color: "#171B17", fontSize: 15, fontWeight: "900" },
  growthAmount: { color: "#697056", fontSize: 12, fontWeight: "900" },
  progressCard: { backgroundColor: "#FFFCF8", borderRadius: 12, borderWidth: 1, borderColor: "#EDE6DA", padding: theme.spacing.md, gap: theme.spacing.sm },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressTitle: { color: "#171B17", fontSize: 14, fontWeight: "900" },
  progressPercent: { color: theme.colors.primaryDark, fontSize: 14, fontWeight: "900" },
  startButton: { minHeight: 58, borderRadius: 14, backgroundColor: "#697056", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  startText: { color: theme.colors.white, fontSize: 18, fontWeight: "900" },
  secondaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#EFEFDA", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: theme.spacing.sm },
  secondaryText: { color: theme.colors.primaryDark, fontSize: 15, fontWeight: "900" },
});
