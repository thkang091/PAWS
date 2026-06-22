import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { MEDICATION_FREQUENCIES } from "@/constants/careHealth";
import {
  useDeleteMedication,
  useLogMedicationGiven,
  useMedications,
  useSaveMedication,
  useTodayMedicationLogs,
} from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";

const MED_PRESETS = [
  { label: "NexGard", value: "NexGard (Flea & Tick)" },
  { label: "Heartgard", value: "Heartgard (Heartworm)" },
  { label: "Simparica", value: "Simparica (Flea & Tick)" },
  { label: "Bravecto", value: "Bravecto (Flea & Tick)" },
  { label: "Sentinel", value: "Sentinel (Heartworm/Flea)" },
  { label: "Apoquel", value: "Apoquel (Allergy)" },
  { label: "Custom", value: "" },
];

export default function MedicationsScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const medications = useMedications(dogId);
  const todayLogs = useTodayMedicationLogs(dogId);
  const saveMed = useSaveMedication(dogId);
  const deleteMed = useDeleteMedication(dogId);
  const logGiven = useLogMedicationGiven(dogId);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const givenTodayIds = new Set((todayLogs.data ?? []).map((l) => l.medicationId));
  const meds = medications.data ?? [];
  const pending = meds.filter((m) => !givenTodayIds.has(m.id));
  const given = meds.filter((m) => givenTodayIds.has(m.id));

  const openAdd = () => {
    setSelectedPreset(null);
    setName("");
    setDosage("");
    setFrequency("daily");
    setStartDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setAddOpen(true);
  };

  const handlePreset = (preset: (typeof MED_PRESETS)[number]) => {
    setSelectedPreset(preset.label);
    if (preset.value) setName(preset.value);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    saveMed.mutate(
      { medicationName: name.trim(), dosage: dosage.trim() || null, frequency, startDate, notes: notes.trim() || null },
      { onSuccess: () => setAddOpen(false) },
    );
  };

  const handleDelete = (id: string, medName: string) => {
    Alert.alert("Remove medication", `Remove ${medName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteMed.mutate(id) },
    ]);
  };

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Medications</Text>
          {meds.length > 0 ? (
            <Text style={s.subtitle}>{given.length} of {meds.length} given today</Text>
          ) : null}
        </View>
        <Pressable style={s.addBtn} onPress={openAdd} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Empty state */}
      {meds.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="medkit-outline" size={32} color={theme.colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No medications yet</Text>
          <Text style={s.emptySub}>Track flea/tick, heartworm, antibiotics, and more for {dog.data?.name ?? "your dog"}.</Text>
          <Pressable style={s.emptyBtn} onPress={openAdd} accessibilityRole="button">
            <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
            <Text style={s.emptyBtnText}>Add first medication</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Pending today */}
      {pending.length > 0 ? (
        <>
          <Text style={s.sectionLabel}>Due today</Text>
          {pending.map((med) => {
            const freq = MEDICATION_FREQUENCIES.find((f) => f.key === med.frequency)?.label;
            return (
              <View key={med.id} style={[s.card, s.cardPending]}>
                <View style={s.cardMain}>
                  <View style={[s.medIconWrap, { backgroundColor: theme.colors.secondarySoft }]}>
                    <Ionicons name="medkit-outline" size={20} color={theme.colors.secondary} />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.medName}>{med.medicationName}</Text>
                    <Text style={s.medMeta}>{[med.dosage, freq].filter(Boolean).join(" · ")}</Text>
                    {med.notes ? <Text style={s.medNotes}>{med.notes}</Text> : null}
                  </View>
                  <Pressable onPress={() => handleDelete(med.id, med.medicationName)} hitSlop={12}>
                    <Ionicons name="trash-outline" size={15} color={theme.colors.textSubtle} />
                  </Pressable>
                </View>
                <Pressable
                  style={s.giveAction}
                  onPress={() => logGiven.mutate(med.id)}
                  disabled={logGiven.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${med.medicationName} as given today`}
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                  <Text style={s.giveActionText}>Mark as given today</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}

      {/* Given today */}
      {given.length > 0 ? (
        <>
          <Text style={s.sectionLabel}>Given today</Text>
          {given.map((med) => {
            const freq = MEDICATION_FREQUENCIES.find((f) => f.key === med.frequency)?.label;
            return (
              <View key={med.id} style={[s.card, s.cardDone]}>
                <View style={s.cardMain}>
                  <View style={[s.medIconWrap, { backgroundColor: theme.colors.successSoft }]}>
                    <Ionicons name="medkit-outline" size={20} color={theme.colors.success} />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={[s.medName, { color: theme.colors.textMuted }]}>{med.medicationName}</Text>
                    <Text style={s.medMeta}>{[med.dosage, freq].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(med.id, med.medicationName)} hitSlop={12}>
                    <Ionicons name="trash-outline" size={15} color={theme.colors.textSubtle} />
                  </Pressable>
                </View>
                <View style={s.doneRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <Text style={s.doneText}>Given today</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {/* Add another row */}
      {meds.length > 0 ? (
        <Pressable style={s.addMoreRow} onPress={openAdd} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.primaryDark} />
          <Text style={s.addMoreText}>Add another medication</Text>
        </Pressable>
      ) : null}

      {/* Add medication modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Add medication</Text>

            <Text style={s.label}>Quick select</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {MED_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={[s.chip, selectedPreset === p.label && s.chipActive]}
                  onPress={() => handlePreset(p)}
                >
                  <Text style={[s.chipText, selectedPreset === p.label && s.chipTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.label}>Medication name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. NexGard, Heartgard, Antibiotics"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="next"
            />

            <Text style={s.label}>Dosage (optional)</Text>
            <TextInput
              style={s.input}
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 1 tablet, 0.5 ml"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="next"
            />

            <Text style={s.label}>How often</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {MEDICATION_FREQUENCIES.map((f) => (
                <Pressable
                  key={f.key}
                  style={[s.chip, frequency === f.key && s.chipActive]}
                  onPress={() => setFrequency(f.key)}
                >
                  <Text style={[s.chipText, frequency === f.key && s.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.label}>Start date</Text>
            <TextInput
              style={s.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />

            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 64, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Prescribing vet, side effects to watch…"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Pressable
              style={[s.saveBtn, (!name.trim() || saveMed.isPending) && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || saveMed.isPending}
              accessibilityRole="button"
            >
              <Text style={s.saveBtnText}>{saveMed.isPending ? "Saving…" : "Save medication"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, fontWeight: "600", marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radii.pill,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
  },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    marginBottom: 10,
    ...theme.shadows.soft,
  },
  cardPending: {
    borderWidth: 1.5,
    borderColor: theme.colors.secondary + "44",
  },
  cardDone: { opacity: 0.75 },
  cardMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  medIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  medName: { fontSize: 15, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  medMeta: { fontSize: 12, color: theme.colors.textMuted, fontWeight: "600" },
  medNotes: { fontSize: 11, color: theme.colors.textSubtle, fontStyle: "italic", marginTop: 2 },

  giveAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: theme.colors.primaryDark,
    paddingVertical: 14,
  },
  giveActionText: { fontSize: 14, fontWeight: "800", color: "#fff" },

  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.successSoft,
    paddingVertical: 10,
  },
  doneText: { fontSize: 13, fontWeight: "700", color: theme.colors.success },

  empty: { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.cardMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  emptySub: { fontSize: 13, color: theme.colors.textMuted, textAlign: "center", maxWidth: 240, lineHeight: 18 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "800", color: theme.colors.primaryDark },

  addMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addMoreText: { fontSize: 14, fontWeight: "700", color: theme.colors.primaryDark },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  chipScroll: { marginBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.card,
  },
  chipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  chipText: { fontSize: 13, color: theme.colors.text, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  saveBtn: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontWeight: "900", color: "#fff" },
});
