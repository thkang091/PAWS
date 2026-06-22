import { StyleSheet, Text, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { theme } from "@/constants/theme";

export type DifficultyFeedback = "very_easy" | "easy" | "appropriate" | "hard" | "very_hard";

const options: Array<{ label: string; value: DifficultyFeedback }> = [
  { label: "Very easy", value: "very_easy" },
  { label: "Easy", value: "easy" },
  { label: "Appropriate", value: "appropriate" },
  { label: "Hard", value: "hard" },
  { label: "Very hard", value: "very_hard" },
];

export const SessionFeedbackSheet = ({ value, onChange }: { value: DifficultyFeedback; onChange: (value: DifficultyFeedback) => void }) => (
  <View style={styles.stack}>
    <Text style={styles.title}>How difficult was this session?</Text>
    <View style={styles.chips}>{options.map((option) => <SelectChip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />)}</View>
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
