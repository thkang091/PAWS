import { StyleSheet, View } from "react-native";

import { AppTextInput } from "@/components/ui/AppTextInput";
import { SelectChip } from "@/components/ui/SelectChip";
import { concernOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";

type Props = {
  selected: string[];
  otherNote: string | null;
  onChange: (values: string[]) => void;
  onOtherNoteChange: (value: string | null) => void;
};

const toggle = (items: string[], value: string): string[] =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export const BehavioralConcernsStep = ({ selected, otherNote, onChange, onOtherNoteChange }: Props) => (
  <View style={styles.stack}>
    <View style={styles.chips}>
      {concernOptions.map((option) => (
        <SelectChip key={option.value} label={option.label} selected={selected.includes(option.value)} onPress={() => onChange(toggle(selected, option.value))} />
      ))}
    </View>
    {selected.includes("other") ? (
      <AppTextInput label="Other concern note" multiline value={otherNote ?? ""} onChangeText={(value) => onOtherNoteChange(value || null)} placeholder="Optional context" />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
