import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { RecurrencePicker, type RecurrenceFrequency } from "@/features/care/components/RecurrencePicker";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useSaveCareEvent } from "@/hooks/useCareEvents";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import type { CareEventType } from "@/types/domain";
import { careEventSchema } from "@/validation/careSchemas";

const categories: Array<{ type: CareEventType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { type: "vet", label: "Vaccine", icon: "needle" },
  { type: "custom", label: "Health", icon: "heart-pulse" },
  { type: "medication", label: "Flea & Tick", icon: "bug-outline" },
  { type: "grooming", label: "Grooming", icon: "content-cut" },
];

export default function CareEventFormScreen() {
  const dog = useCurrentDog();
  const save = useSaveCareEvent(dog.data?.id ?? "");
  const [eventType, setEventType] = useState<CareEventType>("vet");
  const [title, setTitle] = useState("");
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [timeValue, setTimeValue] = useState("10:00 AM");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("monthly");
  const [reminder, setReminder] = useState("1 day before");
  const [error, setError] = useState<string | null>(null);
  const startTime = useMemo(() => combineDateAndTime(dateValue, timeValue), [dateValue, timeValue]);

  if (dog.isLoading) return <ScreenContainer centered><LoadingState message="Loading dog..." /></ScreenContainer>;

  const submit = () => {
    if (!dog.data) return;
    const parsed = careEventSchema.safeParse({
      eventType,
      title,
      description: description || null,
      startTime,
      endTime: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please review the event.");
      return;
    }
    save.mutate({
      input: {
        dogId: dog.data.id,
        ...parsed.data,
        note: note || null,
        durationMinutes: null,
      },
    }, {
      onSuccess: () => router.back(),
    });
  };

  return (
    <ScreenContainer scroll padded={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={25} color="#565B4E" />
          </Pressable>
          <Text style={styles.headerTitle}>Add Event</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Event Title</Text>
          <TextInput
            accessibilityLabel="Event title"
            placeholder="Vaccination"
            placeholderTextColor="#B9B4AC"
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            {categories.map((category) => {
              const selected = eventType === category.type;
              return (
                <Pressable key={category.type} style={[styles.categoryTile, selected && styles.categoryTileActive]} onPress={() => setEventType(category.type)}>
                  <MaterialCommunityIcons name={category.icon} size={34} color={selected ? theme.colors.white : "#565B4E"} />
                  <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{category.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.fieldBlockHalf}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.iconInput}>
              <Ionicons name="calendar-outline" size={24} color="#6F7469" />
              <TextInput accessibilityLabel="Event date" style={styles.inlineInput} value={dateValue} onChangeText={setDateValue} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={styles.fieldBlockHalf}>
            <Text style={styles.label}>Time</Text>
            <View style={styles.iconInput}>
              <Ionicons name="time-outline" size={25} color="#6F7469" />
              <TextInput accessibilityLabel="Event time" style={styles.inlineInput} value={timeValue} onChangeText={setTimeValue} placeholder="10:00 AM" />
            </View>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}><Ionicons name="repeat" size={25} color="#697056" /></View>
              <Text style={styles.settingLabel}>Repeat</Text>
            </View>
            <Pressable onPress={() => setRecurrence(nextRecurrence(recurrence))} style={styles.settingValueWrap}>
              <Text style={styles.settingValue}>{recurrence === "none" ? "Never" : recurrence[0].toUpperCase() + recurrence.slice(1)}</Text>
              <Ionicons name="chevron-forward" size={20} color="#565B4E" />
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}><Ionicons name="notifications-outline" size={25} color="#697056" /></View>
              <Text style={styles.settingLabel}>Reminder</Text>
            </View>
            <Pressable onPress={() => setReminder(reminder === "1 day before" ? "Same day" : "1 day before")} style={styles.settingValueWrap}>
              <Text style={styles.settingValue}>{reminder}</Text>
              <Ionicons name="chevron-forward" size={20} color="#565B4E" />
            </Pressable>
          </View>
        </View>

        <View style={styles.hiddenPicker}>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            accessibilityLabel="Event notes"
            multiline
            placeholder="Add any details like clinic name or specific instructions..."
            placeholderTextColor="#C8C2BA"
            style={styles.notesInput}
            value={note || description}
            onChangeText={(value) => {
              setNote(value);
              setDescription(value);
            }}
          />
        </View>

        {error || save.error ? <Text style={styles.error}>{error ?? save.error?.message}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Pressable style={[styles.saveButton, save.isPending && styles.disabled]} disabled={save.isPending} onPress={submit}>
          <Ionicons name="checkmark-circle-outline" size={24} color={theme.colors.white} />
          <Text style={styles.saveText}>{save.isPending ? "Saving..." : "Save Event"}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const nextRecurrence = (value: RecurrenceFrequency): RecurrenceFrequency => {
  if (value === "none") return "monthly";
  if (value === "monthly") return "weekly";
  if (value === "weekly") return "daily";
  return "none";
};

const combineDateAndTime = (dateValue: string, timeValue: string) => {
  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  const date = new Date(`${dateValue}T00:00:00`);
  if (!Number.isFinite(date.getTime()) || !match) return new Date().toISOString();
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl, gap: theme.spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.lg },
  backButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#F3F0EA", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#565B4E", fontSize: 22, fontWeight: "500" },
  fieldBlock: { gap: theme.spacing.sm },
  fieldBlockHalf: { flex: 1, gap: theme.spacing.sm },
  label: { color: "#565B4E", fontSize: 16, fontWeight: "900" },
  titleInput: { minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: "#E6E1D9", backgroundColor: "#FFFCF7", color: "#171B17", fontSize: 20, paddingHorizontal: theme.spacing.xl, ...theme.shadows.soft },
  categoryRow: { flexDirection: "row", gap: theme.spacing.md },
  categoryTile: { flex: 1, minHeight: 126, borderRadius: 16, borderWidth: 1, borderColor: "#E6E1D9", backgroundColor: "#FFFCF7", alignItems: "center", justifyContent: "center", gap: theme.spacing.md, ...theme.shadows.soft },
  categoryTileActive: { backgroundColor: "#697056", borderColor: "#697056" },
  categoryText: { color: "#565B4E", fontSize: 14, fontWeight: "800", textAlign: "center" },
  categoryTextActive: { color: theme.colors.white },
  twoColumn: { flexDirection: "row", gap: theme.spacing.lg },
  iconInput: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: "#E6E1D9", backgroundColor: "#FFFCF7", flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, ...theme.shadows.soft },
  inlineInput: { flex: 1, color: "#171B17", fontSize: 18, fontWeight: "600" },
  settingsCard: { borderRadius: 18, backgroundColor: "#FFFCF7", paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.lg, gap: theme.spacing.lg, ...theme.shadows.soft },
  settingRow: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  settingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEEAE4", alignItems: "center", justifyContent: "center" },
  settingLabel: { color: "#171B17", fontSize: 21, fontWeight: "700" },
  settingValueWrap: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  settingValue: { color: "#565B4E", fontSize: 20, fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#E2DDD5" },
  hiddenPicker: { display: "none" },
  notesInput: { minHeight: 112, borderRadius: 18, borderWidth: 1, borderColor: "#E6E1D9", backgroundColor: "#FFFCF7", color: "#171B17", fontSize: 17, lineHeight: 23, padding: theme.spacing.xl, textAlignVertical: "top", ...theme.shadows.soft },
  footer: { borderTopWidth: 1, borderTopColor: "#E6E1D9", padding: theme.spacing.xl, backgroundColor: "#FFFCF7" },
  saveButton: { minHeight: 66, borderRadius: 33, backgroundColor: "#697056", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, ...theme.shadows.raised },
  saveText: { color: theme.colors.white, fontSize: 22, fontWeight: "900" },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
