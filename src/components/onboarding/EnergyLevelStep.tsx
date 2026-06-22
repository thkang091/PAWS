import { StyleSheet, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { energyOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import type { EnergyLevel } from "@/types/domain";

export const EnergyLevelStep = ({ value, onChange }: { value: EnergyLevel; onChange: (value: EnergyLevel) => void }) => (
  <View style={styles.chips}>
    {energyOptions.map((option) => (
      <SelectChip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  chips: { gap: theme.spacing.sm },
});
