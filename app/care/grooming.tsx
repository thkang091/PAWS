import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { GROOMING_TYPES, daysUntilGrooming, isGroomingOverdue } from "@/constants/careHealth";
import { useGroomingLogs, useLogGrooming } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";

export default function GroomingScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const logs = useGroomingLogs(dogId);
  const logGroom = useLogGrooming(dogId);

  const [logOpen, setLogOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const latestByType = new Map<string, import("@/services/careHealthService").GroomingLog>();
  for (const l of logs.data ?? []) {
    if (!latestByType.has(l.groomingType)) latestByType.set(l.groomingType, l);
  }

  const today = () => new Date().toISOString().slice(0, 10);

  const handleLog = (type: string, intervalDays: number) => {
    const doneDate = today();
    const next = new Date();
    next.setDate(next.getDate() + intervalDays);
    logGroom.mutate({
      groomingType: type,
      doneDate,
      nextDueDate: next.toISOString().slice(0, 10),
      notes: notes.trim() || null,
    }, {
      onSuccess: () => {
        setLogOpen(null);
        setNotes("");
      },
    });
  };

  const openType = GROOMING_TYPES.find((g) => g.key === logOpen);

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>Grooming & hygiene</Text>
      <Text style={s.sub}>Tap any item to mark it done today.</Text>

      {GROOMING_TYPES.map((g) => {
        const last = latestByType.get(g.key);
        const overdue = last ? isGroomingOverdue(last.doneDate, g.intervalDays) : true;
        const days = last ? daysUntilGrooming(last.doneDate, g.intervalDays) : null;
        const doneToday = last?.doneDate === today();

        return (
          <Pressable key={g.key} style={s.card} onPress={() => setLogOpen(g.key)} accessibilityRole="button">
            <View style={[s.icon, doneToday && s.iconDone, overdue && !doneToday && s.iconOverdue]}>
              <Ionicons
                name={g.icon as never}
                size={20}
                color={doneToday ? "#fff" : overdue ? theme.colors.error : theme.colors.primaryDark}
              />
            </View>
            <View style={s.cardBody}>
              <Text style={s.groomLabel}>{g.label}</Text>
              <Text style={s.groomDesc}>{g.description}</Text>
              {doneToday ? (
                <Text style={s.statusDone}>Done today</Text>
              ) : last ? (
                <Text style={[s.status, overdue && s.statusRed]}>
                  {overdue ? `Overdue by ${Math.abs(days!)} days` : `Due in ${days} days`}
                </Text>
              ) : (
                <Text style={s.statusMissing}>Never recorded — tap to log</Text>
              )}
            </View>
            {!doneToday && (
              <Ionicons name="checkmark-circle-outline" size={22} color={theme.colors.borderStrong} />
            )}
            {doneToday && (
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
            )}
          </Pressable>
        );
      })}

      <Modal visible={Boolean(logOpen)} transparent animationType="slide" onRequestClose={() => setLogOpen(null)}>
        <Pressable style={s.overlay} onPress={() => setLogOpen(null)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Log {openType?.label}</Text>
            <Text style={s.sheetSub}>{openType?.description}</Text>

            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 64, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Any observations, products used…"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Pressable
              style={[s.saveBtn, logGroom.isPending && { opacity: 0.6 }]}
              onPress={() => openType && handleLog(openType.key, openType.intervalDays)}
              disabled={logGroom.isPending}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={s.saveBtnText}>{logGroom.isPending ? "Saving…" : `Mark ${openType?.label} done`}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  sub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 14, marginBottom: 10, ...theme.shadows.soft },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconDone: { backgroundColor: theme.colors.primary },
  iconOverdue: { backgroundColor: "#FEE2E2" },
  cardBody: { flex: 1 },
  groomLabel: { fontSize: 14, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  groomDesc: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 3 },
  status: { fontSize: 12, fontWeight: "600", color: theme.colors.textSubtle },
  statusRed: { color: theme.colors.error },
  statusDone: { fontSize: 12, fontWeight: "600", color: theme.colors.success },
  statusMissing: { fontSize: 12, color: theme.colors.textMuted, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.card },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 14, marginTop: 20 },
  saveBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
