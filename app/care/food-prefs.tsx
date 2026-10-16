import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CheckIcon, SlidersHorizontalIcon } from "phosphor-react-native";

import { DetailShell, goBack } from "@/features/care/components/DetailShell";
import { FoodPrefsForm } from "@/features/care/food/FoodPrefsForm";
import { useDogBasis } from "@/features/care/food/useDogBasis";
import { goalFrom, type Prefs, type WeightGoal } from "@/features/care/food/foodPlanMath";
import { saveFeedingProfile, saveFoodPrefs, useFoodPlan } from "@/features/care/state/foodPlan";
import { accent, icon as iconSize, space, text, type } from "@/constants/design";

/** Food Preferences: goal, food type, ingredients to avoid and owner preferences. Saving asks to review the plan. */
export default function FoodPrefsScreen() {
  const store = useFoodPlan();
  const { basis, his } = useDogBasis();
  const [prefs, setPrefs] = useState<Prefs>(store.prefs);
  const [goal, setGoal] = useState<WeightGoal | null>(basis.goal);

  const changed = JSON.stringify(prefs) !== JSON.stringify(store.prefs) || goal !== basis.goal;

  const save = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveFoodPrefs(prefs);
    saveFeedingProfile({ ...store.profile, goal });
    // With a plan in place, show what these preferences change rather than silently rewriting it.
    if (store.plan && changed) router.replace("/care/food-plan?review=1" as never);
    else goBack("/(tabs)/care");
  };

  return (
    <DetailShell
      title="Food Preferences"
      glyph={<SlidersHorizontalIcon size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/(tabs)/care"
      action={{ label: "Save preferences", icon: <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: save, disabled: !changed }}
    >
      <Text style={styles.lead}>{`What should ${basis.name}'s food aim for and avoid? PAWS checks every food and treat against ${his} preferences.`}</Text>
      <FoodPrefsForm
        prefs={prefs}
        allergies={basis.allergies}
        goal={goal}
        suggestedGoal={store.profile.bodyCondition ? goalFrom(store.profile.bodyCondition) : null}
        onChange={setPrefs}
        onGoal={setGoal}
      />
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.body, color: text.secondary, marginTop: space.lg },
});
