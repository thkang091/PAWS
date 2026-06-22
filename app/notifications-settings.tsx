import { useEffect, useState } from "react";
import { StyleSheet, Text, Switch, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { theme } from "@/constants/theme";
import { useNotificationPreferences, useSaveNotificationPreferences } from "@/hooks/useNotificationPreferences";
import type { NotificationPreferences } from "@/types/domain";

const labels: Array<[keyof Omit<NotificationPreferences, "reminderTime">, string]> = [
  ["dogMomentReminder", "Dog Moment reminder"],
  ["dailyQuestReminder", "Daily quest reminder"],
  ["trainingReminder", "Training reminder"],
  ["streakAtRiskReminder", "Streak-at-risk reminder"],
  ["careEventReminder", "Care-event reminder"],
  ["weeklyRecap", "Weekly recap"],
];

export default function NotificationsSettingsScreen() {
  const prefs = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const [values, setValues] = useState<NotificationPreferences | null>(null);
  useEffect(() => { if (prefs.data) setValues(prefs.data); }, [prefs.data]);
  if (prefs.isLoading || !values) return <ScreenContainer centered><LoadingState message="Loading notification settings..." /></ScreenContainer>;
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Notifications" subtitle="Preferences are saved now. Actual push/local scheduling requires Expo Notifications setup in a development build." />
      <AppCard>
        <Text style={styles.warning}>Expo Go does not provide the full future push-notification setup. This screen stores preferences and documents the development-build boundary.</Text>
        {labels.map(([key, label]) => <View key={key} style={styles.row}><Text style={styles.label}>{label}</Text><Switch value={values[key]} onValueChange={(next) => setValues({ ...values, [key]: next })} /></View>)}
        <AppTextInput label="Reminder time" value={values.reminderTime} onChangeText={(reminderTime) => setValues({ ...values, reminderTime })} placeholder="18:00" />
        <AppButton title="Save preferences" loading={save.isPending} onPress={() => save.mutate(values)} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  warning: { color: theme.colors.warning, fontSize: theme.typography.sm, lineHeight: 20, marginBottom: theme.spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm },
  label: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "700", flex: 1 },
});
