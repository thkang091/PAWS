import { StyleSheet, View } from "react-native";

import { SelectChip } from "@/components/ui/SelectChip";
import { theme } from "@/constants/theme";
import type { TrainingSkill } from "@/types/domain";

type Props = {
  skills: TrainingSkill[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

const toggle = (items: string[], id: string): string[] =>
  items.includes(id) ? items.filter((item) => item !== id) : [...items, id];

export const ExistingSkillsStep = ({ skills, selectedIds, onChange }: Props) => (
  <View style={styles.chips}>
    {skills.map((skill) => (
      <SelectChip key={skill.id} label={skill.name} selected={selectedIds.includes(skill.id)} onPress={() => onChange(toggle(selectedIds, skill.id))} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
