import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  BugIcon,
  CaretRightIcon,
  ChartBarIcon,
  HeartbeatIcon,
  IdentificationCardIcon,
  PillIcon,
  ScalesIcon,
  ScissorsIcon,
  GenderIntersexIcon,
  StethoscopeIcon,
  SyringeIcon,
  ToothIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { ConditionsCard } from "@/features/care/components/ConditionsCard";
import { areaSummary } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { FlowSheet } from "@/features/care/components/FlowSheet";
import { WeekGrid, dayKeyOf } from "@/features/care/components/HealthCheckIn";
import { isFinished } from "@/features/care/health/medPlan";
import { useCheckInByDate } from "@/features/care/state/dailyCheckIn";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { useConsistency } from "@/features/care/state/useConsistency";
import { useGroomingLogs, useMedications } from "@/hooks/useCareHealth";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { fixStatus, groomingStatus, idStatus, weightStatus } from "@/features/care/intel/coverage";
import { useProfileSets } from "@/features/profile/intel/useProfileSets";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { useHealthOverview } from "@/hooks/useHealthOverview";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, radius, space, text, type } from "@/constants/design";

const AREA_TITLE = { parasites: "Parasite prevention", dental: "Dental care", exams: "Preventive exams & testing" } as const;
const AREA_GLYPH = { parasites: BugIcon, dental: ToothIcon, exams: StethoscopeIcon } as const;

type Row = {
  key: string;
  glyph: PhosphorIcon;
  title: string;
  status: string;
  attention: boolean;
  onPress: () => void;
};

export const HealthLongTerm = ({
  dogId,
  dogName,
  week,
  onOpen,
}: {
  dogId?: string;
  dogName: string;
  week: readonly Date[];
  onOpen: (href: string) => void;
}) => {
  const overview = useHealthOverview(dogId);
  const medications = useMedications(dogId);
  const { items } = useHealthRecord();
  const [sheet, setSheet] = useState<"conditions" | "history" | null>(null);
  const intel = useCareIntel();
  const consistency = useConsistency();
  const weights = useWeightLogs(dogId);
  const grooming = useGroomingLogs(dogId);
  const profile = useProfileSets();
  const draft = useProfileDraft();
  const latest = weights.data?.[0] ?? null;
  const weight = weightStatus(latest?.recordedAt ?? null, intel.stage, intel.today, latest ? `${latest.weightValue} ${latest.weightUnit}` : null);
  const groom = groomingStatus(grooming.data ?? [], intel.today);
  const chip = draft.isEdited("about", "Microchip number") ? draft.resolve("about", "Microchip number", "").trim() : "";
  const id = idStatus(chip && chip !== "Not added" ? chip : null);
  const fix = fixStatus(profile.get("basics").answers.fixed ?? "", profile.months, profile.size);

  const vaccines = overview.rings.find((ring) => ring.key === "vaccines");
  const checkins = overview.rings.find((ring) => ring.key === "checkins");
  const active = (medications.data ?? []).filter((med) => !isFinished(med));
  const record = [...items.filter((item) => item.kind === "allergy"), ...items.filter((item) => item.kind === "condition")];

  const rows: Row[] = [
    {
      key: "vaccines",
      glyph: SyringeIcon,
      title: "Vaccinations",
      status: vaccines?.detail ?? "Loading",
      attention: vaccines?.state === "attention",
      onPress: () => onOpen("/care/vaccinations"),
    },
    {
      key: "meds",
      glyph: PillIcon,
      title: "Medication plan",
      status: active.length === 0 ? "Nothing on the list" : active.map((med) => med.medicationName).join(", "),
      attention: false,
      onPress: () => onOpen("/care/medications"),
    },
    {
      key: "conditions",
      glyph: HeartbeatIcon,
      title: "Conditions and allergies",
      status: record.length === 0 ? "None on file" : record.map((item) => item.name).join(", "),
      attention: false,
      onPress: () => setSheet("conditions"),
    },
    ...(["parasites", "dental", "exams"] as const).map((area) => {
      const summary = areaSummary(area, intel.log, intel.stage, intel.today);
      return {
        key: area,
        glyph: AREA_GLYPH[area],
        title: area === "exams" && intel.stage === "senior" ? "Senior exams & testing" : AREA_TITLE[area],
        status: summary.text,
        attention: summary.attention,
        onPress: () => onOpen(`/care/preventive?area=${area}`),
      };
    }),
    {
      key: "weight",
      glyph: ScalesIcon,
      title: "Weight & body",
      status: weight.text,
      attention: weight.attention,
      onPress: () => onOpen("/care/weight-log"),
    },
    {
      key: "grooming",
      glyph: ScissorsIcon,
      title: "Grooming",
      status: groom.text,
      attention: groom.attention,
      onPress: () => onOpen("/care/grooming"),
    },
    ...(fix
      ? [
          {
            key: "fix",
            glyph: GenderIntersexIcon,
            title: "Spay or neuter",
            status: fix.text,
            attention: fix.attention,
            onPress: () => onOpen("/profile/get-to-know?set=basics&q=fixed&only=1"),
          },
        ]
      : []),
    {
      key: "id",
      glyph: IdentificationCardIcon,
      title: "ID & microchip",
      status: id.text,
      attention: id.attention,
      onPress: () => onOpen("/profile/about"),
    },
    {
      key: "history",
      glyph: ChartBarIcon,
      title: "Check-in history",
      // Missed days come first: answers that were all normal say nothing about the evenings that were skipped.
      status:
        checkins?.state === "none"
          ? "Check-in is off"
          : consistency.missedThisWeek > 0
            ? `${consistency.missedThisWeek} missed this week`
            : consistency.streak >= 2
              ? `${consistency.streak} days in a row`
              : (checkins?.detail ?? "This week"),
      attention: consistency.missedThisWeek > 0 || (checkins?.state === "attention" && (checkins?.detail.includes("off") ?? false)),
      onPress: () => setSheet("history"),
    },
  ];

  return (
    <View>
      <View style={styles.list}>
        {rows.map((row, index) => (
          <PressScale
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}. ${row.status}`}
            scaleTo={0.985}
            style={[styles.row, index > 0 && styles.ruled]}
            onPress={() => {
              void Haptics.selectionAsync();
              row.onPress();
            }}
          >
            <View style={[styles.disc, row.attention && styles.discOn]}>
              <row.glyph size={iconSize.standard} color={text.primary} weight="regular" />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{row.title}</Text>
              <View style={styles.statusRow}>
                {row.attention ? <View style={styles.flag} /> : null}
                <Text style={[styles.status, row.attention && styles.statusOn]} numberOfLines={1}>
                  {row.status}
                </Text>
              </View>
            </View>
            <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
          </PressScale>
        ))}
      </View>

      <FlowSheet
        open={sheet === "conditions"}
        title="Conditions and allergies"
        lede="What a vet or sitter should know. It goes into the emergency brief too."
        step={0}
        total={1}
        direction={1}
        primary={{ label: "Done", onPress: () => setSheet(null) }}
        onBack={() => setSheet(null)}
        onClose={() => setSheet(null)}
      >
        <ConditionsCard dogName={dogName} bare />
      </FlowSheet>

      <HistorySheet open={sheet === "history"} week={week} onClose={() => setSheet(null)} />
    </View>
  );
};

const HistorySheet = ({
  open,
  week,
  onClose,
}: {
  open: boolean;
  week: readonly Date[];
  onClose: () => void;
}) => {
  const byDate = useCheckInByDate();
  return (
    <FlowSheet
      open={open}
      title="Check-in history"
      lede="Each dot is one answer from the evening check-in."
      step={0}
      total={1}
      direction={1}
      primary={{ label: "Done", onPress: onClose }}
      onBack={onClose}
      onClose={onClose}
    >
      <WeekGrid week={week} byDate={byDate} selectedKey={dayKeyOf(new Date())} />
    </FlowSheet>
  );
};

const styles = StyleSheet.create({
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  discOn: { backgroundColor: accent.primary },
  copy: { flex: 1 },
  title: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  status: { ...type.caption, color: text.tertiary, flexShrink: 1 },
  statusOn: { color: text.primary, fontWeight: "600" },
});
