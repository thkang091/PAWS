import { StyleSheet, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { obedienceOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import type { ObedienceLevel } from "@/types/domain";

export const ObedienceStep = ({ value, onChange }: { value: ObedienceLevel; onChange: (value: ObedienceLevel) => void }) => (
  <View style={styles.chips}>
    {obedienceOptions.map((option) => (
      <SelectChip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  chips: { gap: theme.spacing.sm },
});
