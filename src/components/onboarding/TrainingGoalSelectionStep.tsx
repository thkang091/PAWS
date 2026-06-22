import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { trainingGoalCategories } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import type { OwnerTrainingGoal, SelectedOwnerGoal } from "@/types/domain";

interface Props {
  selectedGoals: SelectedOwnerGoal[];
  onChange: (goals: SelectedOwnerGoal[]) => void;
}

const MAX_GOALS = 6;

export const TrainingGoalSelectionStep = ({ selectedGoals, onChange }: Props) => {
  const handleToggle = (goalKey: OwnerTrainingGoal) => {
    const existingIndex = selectedGoals.findIndex((g) => g.goal === goalKey);

    if (existingIndex !== -1) {
      // Deselect and re-number remaining
      const filtered = selectedGoals.filter((_, i) => i !== existingIndex);
      const renumbered = filtered.map((g, i) => ({ ...g, priorityRank: i + 1 }));
      onChange(renumbered);
    } else {
      if (selectedGoals.length >= MAX_GOALS) return;
      onChange([
        ...selectedGoals,
        {
          goal: goalKey,
          priorityRank: selectedGoals.length + 1,
          selectedPainPoints: [],
        },
      ]);
    }
  };

  const calmAloneSelected = selectedGoals.some((g) => g.goal === "CALM_ALONE_TIME");
  const helpfulSkillsSelected = selectedGoals.some((g) => g.goal === "HELPFUL_SKILLS_AROUND_THE_HOUSE");

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {trainingGoalCategories.map((category) => {
          const selectedGoal = selectedGoals.find((g) => g.goal === category.key);
          const isSelected = !!selectedGoal;

          return (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityLabel={category.title}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleToggle(category.key as OwnerTrainingGoal)}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              {isSelected && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{selectedGoal.priorityRank}</Text>
                </View>
              )}
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={category.iconName as React.ComponentProps<typeof Ionicons>["name"]}
                  size={theme.iconSizes.xl}
                  color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                />
              </View>
              <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                {category.title}
              </Text>
              <Text style={styles.cardSubtitle}>{category.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

      {helpfulSkillsSelected && (
        <View style={styles.disclaimer}>
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

      {calmAloneSelected && (
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

      <Text style={styles.hint}>
        {selectedGoals.length === 0
          ? "Tap a goal to select it. You can choose up to 6."
          : `${selectedGoals.length} of ${MAX_GOALS} selected`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    padding: theme.spacing.lg,
    width: "47%",
    gap: theme.spacing.sm,
    position: "relative",
    ...theme.shadows.soft,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primarySoft,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  badge: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 22,
    height: 22,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: "800",
    lineHeight: 14,
  },
  iconWrapper: {
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "700",
    lineHeight: 18,
  },
  cardTitleSelected: {
    color: theme.colors.primaryDark,
  },
  cardSubtitle: {
    color: theme.colors.textSubtle,
    fontSize: theme.typography.xs,
    lineHeight: 16,
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
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    textAlign: "center",
    fontWeight: "600",
  },
});
