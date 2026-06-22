import { useState } from "react";
import { StyleSheet, View, Text } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SelectChip } from "@/components/ui/SelectChip";
import { WeightLogCard } from "@/components/care/WeightLogCard";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useSaveWeightLog, useWeightLogs } from "@/hooks/useWeightLogs";
import { theme } from "@/constants/theme";

export default function WeightLogScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const logs = useWeightLogs(dogId);
  const save = useSaveWeightLog(dogId);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"lb" | "kg">("lb");
  const [note, setNote] = useState("");
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Weight Log" subtitle="Owner-entered tracking only. PAWS is not veterinary advice." />
      <AppCard>
        <View style={styles.stack}>
          <AppTextInput label="Weight" value={weight} onChangeText={setWeight} keyboardType="numeric" />
          <View style={styles.row}><SelectChip label="lb" selected={unit === "lb"} onPress={() => setUnit("lb")} /><SelectChip label="kg" selected={unit === "kg"} onPress={() => setUnit("kg")} /></View>
          <AppTextInput label="Note" value={note} onChangeText={setNote} multiline placeholder="Optional" />
          {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
          <AppButton title="Save weight" loading={save.isPending} onPress={() => save.mutate({ dogId, weightValue: Number(weight), weightUnit: unit, recordedAt: new Date().toISOString(), note: note || null })} />
        </View>
      </AppCard>
      {(logs.data ?? []).map((log) => <WeightLogCard key={log.id} log={log} />)}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "800" },
});
