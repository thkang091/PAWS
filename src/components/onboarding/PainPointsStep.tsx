import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { trainingGoalCategoryMap } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import { AppButton } from "@/components/ui/AppButton";
import type { SelectedOwnerGoal } from "@/types/domain";

interface Props {
  selectedGoals: SelectedOwnerGoal[];
  onChange: (goals: SelectedOwnerGoal[]) => void;
}

export const PainPointsStep = ({ selectedGoals, onChange }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const sortedGoals = [...selectedGoals].sort((a, b) => a.priorityRank - b.priorityRank);
  const currentGoal = sortedGoals[currentIndex];

  if (!currentGoal) return null;

  const categoryMeta = trainingGoalCategoryMap.get(currentGoal.goal);

  if (!categoryMeta) return null;

  const togglePainPoint = (key: string) => {
    const updatedGoals = selectedGoals.map((g) => {
      if (g.goal !== currentGoal.goal) return g;
      const already = g.selectedPainPoints.includes(key);
      return {
        ...g,
        selectedPainPoints: already
          ? g.selectedPainPoints.filter((pp) => pp !== key)
          : [...g.selectedPainPoints, key],
      };
    });
    onChange(updatedGoals);
  };

  const handleAdvance = () => {
    if (currentIndex < sortedGoals.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const isLastGoal = currentIndex === sortedGoals.length - 1;
  const total = sortedGoals.length;
  const isHelpfulSkills = currentGoal.goal === "HELPFUL_SKILLS_AROUND_THE_HOUSE";
  const isCalmAlone = currentGoal.goal === "CALM_ALONE_TIME";

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Goal {currentIndex + 1} of {total}
        </Text>
        <View style={styles.progressDots}>
          {sortedGoals.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive, i < currentIndex && styles.dotDone]}
            />
          ))}
        </View>
      </View>

      <View style={styles.goalHeader}>
        <Ionicons
          name={categoryMeta.iconName as React.ComponentProps<typeof Ionicons>["name"]}
          size={theme.iconSizes.lg}
          color={theme.colors.primary}
        />
        <Text style={styles.goalTitle}>{categoryMeta.title}</Text>
      </View>

      {isHelpfulSkills && (
        <View style={[styles.disclaimer, styles.disclaimerNeutral]}>
          <Ionicons
            name="information-circle-outline"
            size={theme.iconSizes.sm}
            color={theme.colors.textMuted}
          />
          <Text style={[styles.disclaimerText, styles.disclaimerTextNeutral]}>
            These activities are everyday home tasks and enrichment exercises. This is not
            service-dog training. PAWS does not imply disability-assistance certification.
          </Text>
        </View>
      )}

      {isCalmAlone && (
        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={theme.iconSizes.sm}
            color={theme.colors.warning}
          />
          <Text style={styles.disclaimerText}>
            PAWS can guide gradual independence-building routines. If your dog shows severe
            distress, escape attempts, or self-injury, consult a veterinarian or qualified
            behavior professional.
          </Text>
        </View>
      )}

      <Text style={styles.question}>
        What would you like to work on with {categoryMeta.title}?
      </Text>

      <View style={styles.painPointsList}>
        {categoryMeta.painPoints.map((pp) => {
          const isChecked = currentGoal.selectedPainPoints.includes(pp.key);
          return (
            <Pressable
              key={pp.key}
              accessibilityRole="checkbox"
              accessibilityLabel={pp.label}
              accessibilityState={{ checked: isChecked }}
              onPress={() => togglePainPoint(pp.key)}
              style={({ pressed }) => [styles.painPointRow, pressed && styles.painPointPressed]}
            >
              <Ionicons
                name={isChecked ? "checkbox" : "checkbox-outline"}
                size={theme.iconSizes.md}
                color={isChecked ? theme.colors.primary : theme.colors.border}
              />
              <Text style={[styles.painPointLabel, isChecked && styles.painPointLabelChecked]}>
                {pp.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!isLastGoal && (
        <AppButton
          title={`Next goal →`}
          variant="secondary"
          fullWidth
          onPress={handleAdvance}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: "700",
  },
  progressDots: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 16,
  },
  dotDone: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  goalTitle: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.md,
    fontWeight: "800",
  },
  question: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "600",
    lineHeight: 20,
  },
  painPointsList: {
    gap: theme.spacing.sm,
  },
  painPointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  painPointPressed: {
    backgroundColor: theme.colors.backgroundSoft,
  },
  painPointLabel: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sm,
    fontWeight: "600",
  },
  painPointLabelChecked: {
    color: theme.colors.primaryDark,
  },
  disclaimer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    padding: theme.spacing.md,
    alignItems: "flex-start",
  },
  disclaimerNeutral: {
    backgroundColor: theme.colors.backgroundSoft,
    borderColor: theme.colors.border,
  },
  disclaimerText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.typography.xs,
    lineHeight: 16,
    fontWeight: "600",
  },
  disclaimerTextNeutral: {
    color: theme.colors.textMuted,
  },
});
