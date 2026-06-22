import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { useDeleteVaccination, useSaveVaccination, useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const daysUntil = (iso: string): number =>
  Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);

export default function VaccinationsScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const vaccinations = useVaccinations(dogId);
  const saveVacc = useSaveVaccination(dogId);
  const deleteVacc = useDeleteVaccination(dogId);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(VACCINE_SCHEDULE[0].key);
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().slice(0, 10));
  const [vetName, setVetName] = useState("");
  const [notes, setNotes] = useState("");

  const latestByKey = new Map<string, import("@/services/careHealthService").Vaccination>();
  for (const v of vaccinations.data ?? []) {
    if (!latestByKey.has(v.vaccineKey)) latestByKey.set(v.vaccineKey, v);
  }

  const handleSave = () => {
    const schedule = VACCINE_SCHEDULE.find((s) => s.key === selectedKey);
    if (!schedule) return;
    const given = new Date(dateGiven + "T00:00:00");
    const nextDue = new Date(given);
    nextDue.setMonth(nextDue.getMonth() + schedule.intervalMonths);

    saveVacc.mutate({
      vaccineKey: selectedKey,
      vaccineName: schedule.name,
      dateGiven,
      nextDueDate: nextDue.toISOString().slice(0, 10),
      vetName: vetName.trim() || null,
      notes: notes.trim() || null,
    }, {
      onSuccess: () => {
        setAddOpen(false);
        setDateGiven(new Date().toISOString().slice(0, 10));
        setVetName("");
        setNotes("");
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Remove record", `Remove ${name} record?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteVacc.mutate(id) },
    ]);
  };

  return (
    <ScreenContainer scroll>
      <View style={s.header}>
        <Text style={s.title}>Vaccinations</Text>
        <Pressable style={s.addBtn} onPress={() => setAddOpen(true)} accessibilityRole="button">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Log vaccine</Text>
        </Pressable>
      </View>

      {VACCINE_SCHEDULE.map((schedule) => {
        const record = latestByKey.get(schedule.key);
        const days = record?.nextDueDate ? daysUntil(record.nextDueDate) : null;
        const overdue = days !== null && days < 0;
        const dueSoon = days !== null && days >= 0 && days <= 30;
        const upToDate = days !== null && days > 30;

        return (
          <View key={schedule.key} style={s.card}>
            <View style={s.cardLeft}>
              <View style={[s.dot, overdue && s.dotRed, dueSoon && s.dotAmber, upToDate && s.dotGreen]} />
              <View style={s.cardBody}>
                <View style={s.cardTop}>
                  <Text style={s.vaccineName}>{schedule.name}</Text>
                  {schedule.required && <View style={s.coreBadge}><Text style={s.coreBadgeText}>core</Text></View>}
                </View>
                <Text style={s.vaccineDesc}>{schedule.description}</Text>
                {record ? (
                  <Text style={[s.status, overdue && s.statusRed, dueSoon && s.statusAmber, upToDate && s.statusGreen]}>
                    {overdue
                      ? `Overdue by ${Math.abs(days!)} days`
                      : dueSoon
                        ? `Due in ${days} days — ${fmtDate(record.nextDueDate!)}`
                        : `Up to date — next ${fmtDate(record.nextDueDate!)}`}
                  </Text>
                ) : (
                  <Text style={s.statusMissing}>Not recorded</Text>
                )}
              </View>
            </View>
            {record && (
              <Pressable onPress={() => handleDelete(record.id, schedule.name)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Log vaccination</Text>

            <Text style={s.label}>Vaccine</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {VACCINE_SCHEDULE.map((s2) => (
                <Pressable
                  key={s2.key}
                  style={[s.chip, selectedKey === s2.key && s.chipActive]}
                  onPress={() => setSelectedKey(s2.key)}
                >
                  <Text style={[s.chipText, selectedKey === s2.key && s.chipTextActive]}>{s2.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.label}>Date given</Text>
            <TextInput
              style={s.input}
              value={dateGiven}
              onChangeText={setDateGiven}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={s.label}>Vet name (optional)</Text>
            <TextInput
              style={s.input}
              value={vetName}
              onChangeText={setVetName}
              placeholder="Dr. Smith"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Batch number, location, reactions…"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Pressable
              style={[s.saveBtn, saveVacc.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saveVacc.isPending}
            >
              <Text style={s.saveBtnText}>{saveVacc.isPending ? "Saving…" : "Save record"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "900", color: theme.colors.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  card: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 14, marginBottom: 10, ...theme.shadows.soft },
  cardLeft: { flexDirection: "row", gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, backgroundColor: theme.colors.borderStrong, flexShrink: 0 },
  dotRed: { backgroundColor: theme.colors.error },
  dotAmber: { backgroundColor: theme.colors.warning },
  dotGreen: { backgroundColor: theme.colors.success },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  vaccineName: { fontSize: 14, fontWeight: "800", color: theme.colors.text },
  coreBadge: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.pill, paddingHorizontal: 6, paddingVertical: 2 },
  coreBadgeText: { fontSize: 10, fontWeight: "700", color: theme.colors.primaryDark },
  vaccineDesc: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  status: { fontSize: 12, fontWeight: "600" },
  statusRed: { color: theme.colors.error },
  statusAmber: { color: theme.colors.warning },
  statusGreen: { color: theme.colors.success },
  statusMissing: { fontSize: 12, color: theme.colors.textMuted, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  chipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  chipText: { fontSize: 13, color: theme.colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.card },
  saveBtn: { backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  saveBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
