import { StyleSheet, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { theme } from "@/constants/theme";

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

const options: Array<{ label: string; value: RecurrenceFrequency }> = [
  { label: "None", value: "none" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

export const RecurrencePicker = ({ value, onChange }: { value: RecurrenceFrequency; onChange: (value: RecurrenceFrequency) => void }) => (
  <View style={styles.chips}>{options.map((option) => <SelectChip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />)}</View>
);

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
