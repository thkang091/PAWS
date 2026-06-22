import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { ACTIVITY_TYPES } from "@/constants/careHealth";
import { useCareProfile, useLogExercise, useTodayExerciseLogs } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";

export default function ExerciseScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const profile = useCareProfile(dogId);
  const logs = useTodayExerciseLogs(dogId);
  const logEx = useLogExercise(dogId);

  const [addOpen, setAddOpen] = useState(false);
  const [activityType, setActivityType] = useState("walk");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [walkCount, setWalkCount] = useState(1);
  const [notes, setNotes] = useState("");

  const goalMinutes = profile.data?.dailyExerciseGoalMinutes ?? 60;
  const totalToday = (logs.data ?? []).reduce((sum, l) => sum + l.durationMinutes, 0);
  const progress = Math.min(totalToday / goalMinutes, 1);
  const progressDeg = progress * 283;

  const handleLog = () => {
    const mins = parseInt(duration, 10);
    if (!mins || mins <= 0) return;
    logEx.mutate({
      activityType,
      durationMinutes: mins,
      distanceMiles: distance ? parseFloat(distance) : null,
      walkCount: activityType === "walk" ? walkCount : null,
      notes: notes.trim() || null,
    }, {
      onSuccess: () => {
        setAddOpen(false);
        setDuration("");
        setDistance("");
        setWalkCount(1);
        setNotes("");
      },
    });
  };

  const activityIcon = (type: string) =>
    ACTIVITY_TYPES.find((a) => a.key === type)?.icon ?? "walk-outline";
  const activityLabel = (type: string) =>
    ACTIVITY_TYPES.find((a) => a.key === type)?.label ?? type;

  return (
    <ScreenContainer scroll>
      {/* Ring */}
      <View style={s.ringCard}>
        <View style={s.ringWrap}>
          <View style={s.ringOuter}>
            <View style={s.ringInner}>
              <Text style={s.ringMinutes}>{totalToday}</Text>
              <Text style={s.ringLabel}>of {goalMinutes} min</Text>
            </View>
          </View>
          {/* SVG-less progress arc using border trick */}
          <View style={[s.arcFill, { transform: [{ rotate: `${progressDeg * 1.27}deg` }] }]} />
        </View>
        <View style={s.ringStats}>
          <Text style={s.ringDog}>{dog.data?.name ?? "Your dog"}'s exercise</Text>
          <Text style={s.ringBreed}>Goal: {goalMinutes} min/day</Text>
          {totalToday >= goalMinutes ? (
            <View style={s.goalBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
              <Text style={s.goalBadgeText}>Goal reached!</Text>
            </View>
          ) : (
            <Text style={s.ringRemaining}>{goalMinutes - totalToday} min to go</Text>
          )}
        </View>
      </View>

      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Today's activity</Text>
        <Pressable style={s.addBtn} onPress={() => setAddOpen(true)} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Log activity</Text>
        </Pressable>
      </View>

      {(logs.data ?? []).length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="walk-outline" size={40} color={theme.colors.textMuted} />
          <Text style={s.emptyText}>No activity logged yet today</Text>
        </View>
      ) : (
        (logs.data ?? []).map((log) => (
          <View key={log.id} style={s.logCard}>
            <View style={s.logIcon}>
              <Ionicons name={activityIcon(log.activityType) as never} size={20} color={theme.colors.primaryDark} />
            </View>
            <View style={s.logBody}>
              <Text style={s.logType}>{activityLabel(log.activityType)}</Text>
              <Text style={s.logMeta}>
                {log.durationMinutes} min
                {log.walkCount ? ` · ${log.walkCount} ${log.walkCount === 1 ? "walk" : "walks"}` : ""}
                {log.distanceMiles ? ` · ${log.distanceMiles.toFixed(1)} mi` : ""}
              </Text>
            </View>
            <View style={s.logBadge}>
              <Text style={s.logBadgeText}>+{log.durationMinutes} min</Text>
            </View>
          </View>
        ))
      )}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Log activity</Text>

            <Text style={s.label}>Activity type</Text>
            <View style={s.activityGrid}>
              {ACTIVITY_TYPES.map((a) => (
                <Pressable
                  key={a.key}
                  style={[s.activityChip, activityType === a.key && s.activityChipActive]}
                  onPress={() => setActivityType(a.key)}
                >
                  <Ionicons name={a.icon as never} size={16} color={activityType === a.key ? "#fff" : theme.colors.textMuted} />
                  <Text style={[s.activityChipText, activityType === a.key && s.activityChipTextActive]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {activityType === "walk" && (
              <>
                <Text style={s.label}>Number of walks</Text>
                <View style={s.stepperRow}>
                  <Pressable style={s.stepperBtn} onPress={() => setWalkCount((n) => Math.max(1, n - 1))} hitSlop={8}>
                    <Ionicons name="remove" size={20} color={theme.colors.primaryDark} />
                  </Pressable>
                  <View style={s.stepperValue}>
                    <Text style={s.stepperNum}>{walkCount}</Text>
                    <Text style={s.stepperUnit}>{walkCount === 1 ? "walk" : "walks"}</Text>
                  </View>
                  <Pressable style={s.stepperBtn} onPress={() => setWalkCount((n) => Math.min(10, n + 1))} hitSlop={8}>
                    <Ionicons name="add" size={20} color={theme.colors.primaryDark} />
                  </Pressable>
                </View>
              </>
            )}

            <Text style={s.label}>Duration (minutes)</Text>
            <TextInput style={s.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="e.g. 30" placeholderTextColor={theme.colors.textMuted} />

            <Text style={s.label}>Distance in miles (optional)</Text>
            <TextInput style={s.input} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="e.g. 1.5" placeholderTextColor={theme.colors.textMuted} />

            <Text style={s.label}>Notes (optional)</Text>
            <TextInput style={[s.input, { height: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} multiline placeholder="Park, trail, off-leash…" placeholderTextColor={theme.colors.textMuted} />

            <Pressable style={[s.saveBtn, (!duration || logEx.isPending) && { opacity: 0.5 }]} onPress={handleLog} disabled={!duration || logEx.isPending}>
              <Text style={s.saveBtnText}>{logEx.isPending ? "Saving…" : "Log activity"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  ringCard: { flexDirection: "row", alignItems: "center", gap: 20, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 20, marginBottom: 20, ...theme.shadows.soft },
  ringWrap: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
  ringOuter: { width: 90, height: 90, borderRadius: 45, borderWidth: 8, borderColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  ringInner: { alignItems: "center" },
  ringMinutes: { fontSize: 22, fontWeight: "900", color: theme.colors.primaryDark },
  ringLabel: { fontSize: 10, color: theme.colors.textMuted, fontWeight: "600" },
  arcFill: { position: "absolute", width: 90, height: 90, borderRadius: 45, borderWidth: 8, borderColor: "transparent", borderTopColor: theme.colors.primaryDark },
  ringStats: { flex: 1 },
  ringDog: { fontSize: 15, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  ringBreed: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  goalBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  goalBadgeText: { fontSize: 12, fontWeight: "700", color: theme.colors.success },
  ringRemaining: { fontSize: 12, color: theme.colors.textMuted },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: theme.colors.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, fontWeight: "600" },
  logCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 14, marginBottom: 8, ...theme.shadows.soft },
  logIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  logBody: { flex: 1 },
  logType: { fontSize: 14, fontWeight: "800", color: theme.colors.text },
  logMeta: { fontSize: 12, color: theme.colors.textMuted },
  logBadge: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  logBadgeText: { fontSize: 12, fontWeight: "700", color: theme.colors.primaryDark },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.cardMuted, borderRadius: 16, paddingVertical: 8, marginBottom: 4 },
  stepperBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  stepperValue: { flex: 1, alignItems: "center" },
  stepperNum: { fontSize: 28, fontWeight: "900", color: theme.colors.primaryDark },
  stepperUnit: { fontSize: 11, fontWeight: "600", color: theme.colors.textMuted, marginTop: -2 },
  activityChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border },
  activityChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  activityChipText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: "600" },
  activityChipTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.card },
  saveBtn: { backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  saveBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
