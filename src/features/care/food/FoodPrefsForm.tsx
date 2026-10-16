import { StyleSheet, Text, TextInput, View } from "react-native";

import { OptionList, Toggle, partsStyles } from "@/features/care/food/FoodPlanParts";
import { AVOID, FORMS, GOAL } from "@/features/care/food/options";
import type { Prefs, WeightGoal } from "@/features/care/food/foodPlanMath";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { bg, radius, space, text, type } from "@/constants/design";

/** Food preferences, shared by Food Plan setup and the Food Preferences page. Everything here is optional. */
export const FoodPrefsForm = ({
  prefs,
  allergies,
  goal,
  suggestedGoal,
  onChange,
  onGoal,
}: {
  prefs: Prefs;
  allergies: readonly string[];
  /** Pass to show the weight goal (the standalone page); setup asks it with the profile instead. */
  goal?: WeightGoal | null;
  suggestedGoal?: WeightGoal | null;
  onChange: (next: Prefs) => void;
  onGoal?: (goal: WeightGoal) => void;
}) => {
  const set = (patch: Partial<Prefs>) => onChange({ ...prefs, ...patch });
  return (
    <View>
      {onGoal ? (
        <>
          <Text style={partsStyles.section}>Goal</Text>
          <OptionList options={GOAL} value={goal ?? "maintain"} suggested={suggestedGoal} onChange={onGoal} />
        </>
      ) : null}

      <Text style={partsStyles.section}>Food type</Text>
      <View style={styles.chips}>
        {FORMS.map((f) => (
          <Chip key={f.value} label={f.label} selected={prefs.form === f.value} onPress={() => set({ form: f.value })} />
        ))}
      </View>

      <Text style={partsStyles.section}>Ingredients to avoid</Text>
      <View style={styles.chips}>
        {allergies.map((a) => (
          <View key={`allergy-${a}`} style={styles.locked}>
            <Text style={styles.lockedText}>{`${a} (allergy)`}</Text>
          </View>
        ))}
        {AVOID.filter((a) => !allergies.some((x) => x.toLowerCase() === a.toLowerCase())).map((a) => (
          <Chip
            key={a}
            label={a}
            selected={prefs.avoid.includes(a)}
            onPress={() => set({ avoid: prefs.avoid.includes(a) ? prefs.avoid.filter((x) => x !== a) : [...prefs.avoid, a] })}
          />
        ))}
      </View>

      <Text style={partsStyles.section}>Your preferences</Text>
      <Toggle label="Sensitive stomach" on={prefs.sensitiveStomach} onPress={() => set({ sensitiveStomach: !prefs.sensitiveStomach })} />
      <Toggle label="No artificial colors" on={prefs.noColors} onPress={() => set({ noColors: !prefs.noColors })} />
      <Toggle label="No artificial flavors" on={prefs.noFlavors} onPress={() => set({ noFlavors: !prefs.noFlavors })} />
      <Toggle label="No artificial preservatives" on={prefs.noPreservatives} onPress={() => set({ noPreservatives: !prefs.noPreservatives })} />
      <Toggle label="Prefer natural ingredients" on={prefs.natural} onPress={() => set({ natural: !prefs.natural })} />

      <Text style={partsStyles.section}>Anything else to avoid?</Text>
      <TextInput
        style={styles.other}
        value={prefs.other}
        onChangeText={(other) => set({ other })}
        placeholder="For example peas, potato"
        placeholderTextColor={text.tertiary}
        accessibilityLabel="Anything else to avoid, separated by commas"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  locked: { height: 44, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: text.primary, justifyContent: "center" },
  lockedText: { ...type.supporting, fontSize: 15, fontWeight: "600", color: text.inverse },
  other: { height: 48, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.subtle, ...type.body, color: text.primary },
});
