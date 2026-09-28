import { StyleSheet, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { goalOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";

type Props = {
  selected: string[];
  onChange: (values: string[]) => void;
};

const toggle = (items: string[], value: string): string[] =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export const OwnerGoalsStep = ({ selected, onChange }: Props) => (
  <View style={styles.chips}>
    {goalOptions.map((option) => (
      <SelectChip key={option.value} label={option.label} selected={selected.includes(option.value)} onPress={() => onChange(toggle(selected, option.value))} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
