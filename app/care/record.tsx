import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Animated, { LinearTransition, useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { CaretDownIcon, CheckIcon, FileXIcon, TrashIcon } from "phosphor-react-native";

import { DetailEmpty, DetailShell, goBack } from "@/features/care/components/DetailShell";
import { Pill, WhenPicker, dayTitle } from "@/features/care/components/DayPicker";
import { KIND_GLYPH, shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { CARE_LABEL, entriesFor, type LogEntry } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { isPreventiveKind, preventivesFor } from "@/features/care/intel/preventives";
import { daysBetween, nextDueAfter, syncDoseReminder, undoDose, VISIT_KINDS } from "@/features/care/state/careDose";
import { updateCareEntry } from "@/features/care/state/careLog";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const RESULTS = ["All clear", "Needs a follow-up", "Waiting on results"];
type Field = "date" | "product" | "result";

const ago = (days: number) => (days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 60 ? `${days} days ago` : `${Math.round(days / 30.4)} months ago`);

/**
 * One health record, editable in place: a summary on top, then each detail as a row that opens its own editor
 * underneath (one at a time), the note, and delete at the very end. Nothing saves until "Save changes".
 */
export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const intel = useCareIntel();
  const reduceMotion = useReducedMotion();
  const saved = intel.log.find((e) => e.id === id) ?? null;
  const [draft, setDraft] = useState<LogEntry | null>(saved);
  const [open, setOpen] = useState<Field | null>(null);

  // Opened from a link before the log has loaded: pick the record up once it arrives.
  useEffect(() => {
    if (!draft && saved) setDraft(saved);
  }, [draft, saved]);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  if (!saved || !draft) {
    return (
      <DetailShell title="Health record" glyph={<FileXIcon size={iconSize.standard} color={accent.band} weight="bold" />} back="/care/records">
        <DetailEmpty glyph={<FileXIcon size={28} color={text.primary} />} title="This record is gone" body="It may have been deleted." />
      </DetailShell>
    );
  }

  const kind = draft.kind;
  const Glyph = KIND_GLYPH[kind];
  const dose = isPreventiveKind(kind);
  const visit = VISIT_KINDS.includes(kind);
  const products = dose ? preventivesFor(kind) : [];
  const latest = entriesFor(kind, intel.log)[0]?.id === saved.id;
  const next = nextDueAfter(kind, draft.date, draft.everyDays, intel.stage);
  const nextLeft = next ? daysBetween(intel.today, next) : null;

  const set = (patch: Partial<LogEntry>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const toggle = (field: Field) => {
    void Haptics.selectionAsync();
    setOpen((f) => (f === field ? null : field));
  };

  const save = () => {
    const { id: _id, ...patch } = { ...draft, note: draft.note?.trim() || null };
    updateCareEntry(saved.id, patch);
    if (latest) syncDoseReminder({ ...draft }, intel.stage, intel.name);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goBack("/care/records");
  };

  const remove = () =>
    Alert.alert("Delete this record?", `${CARE_LABEL[kind]} on ${shortDay(saved.date)}`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          undoDose(saved.id, kind);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          goBack("/care/records");
        },
      },
    ]);

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter).easing(motion.easing.out);

  return (
    <DetailShell
      title={CARE_LABEL[kind]}
      glyph={<Glyph size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/care/records"
      action={changed ? { label: "Save changes", icon: <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: save } : undefined}
    >
      <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.hero}>
        <View style={styles.heroDisc}>
          <Glyph size={26} color={text.primary} weight="regular" />
        </View>
        <Text style={styles.heroDate}>{shortDay(draft.date)}</Text>
        <Text style={styles.heroSub}>{[ago(daysBetween(draft.date, intel.today)), draft.product, draft.result].filter(Boolean).join("  ·  ")}</Text>
        {next ? (
          <View style={styles.heroNext}>
            <View style={[styles.heroDot, nextLeft != null && nextLeft < 0 && styles.heroDotLate]} />
            <Text style={styles.heroNextText}>
              {nextLeft != null && nextLeft < 0 ? `Next one was due ${shortDay(next)}` : `${dose ? "Next dose" : "Next one"} ${shortDay(next)}`}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View layout={settle} style={styles.list}>
        <Row label="Date" value={dayTitle(draft.date, intel.today)} open={open === "date"} onPress={() => toggle("date")}>
          <WhenPicker today={intel.today} value={draft.date} onChange={(date) => set({ date })} reduceMotion={reduceMotion} compact quick={false} bleed={space.lg} />
        </Row>

        {dose ? (
          <Row label="Product" value={draft.product ?? "Not set"} open={open === "product"} ruled onPress={() => toggle("product")}>
            <View style={styles.chips}>
              {products.map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  on={draft.product === p.name}
                  onPress={() => set({ product: p.name, everyDays: p.everyDays, covers: p.covers.length > 1 ? [...p.covers] : null })}
                />
              ))}
              <Pill label="Not sure" on={!draft.product} onPress={() => set({ product: null, everyDays: null, covers: null })} />
            </View>
          </Row>
        ) : null}

        {visit ? (
          <Row label="Result" value={draft.result ?? "Not set"} open={open === "result"} ruled onPress={() => toggle("result")}>
            <View style={styles.chips}>
              {RESULTS.map((r) => (
                <Pill key={r} label={r} on={draft.result === r} onPress={() => set({ result: draft.result === r ? null : r })} />
              ))}
            </View>
          </Row>
        ) : null}

        {next && latest ? (
          <View style={[styles.row, styles.ruled]}>
            <Text style={styles.rowLabel}>Remind me</Text>
            <View style={styles.flex} />
            <Switch
              style={styles.switch}
              accessibilityLabel="Remind me when the next one is due"
              value={Boolean(draft.remind)}
              onValueChange={(remind) => {
                void Haptics.selectionAsync();
                set({ remind });
              }}
              trackColor={{ false: border.default, true: accent.deep }}
            />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View layout={settle}>
        <Text style={styles.section}>Note</Text>
        <TextInput
          style={styles.note}
          value={draft.note ?? ""}
          onChangeText={(note) => set({ note })}
          placeholder="Anything worth remembering"
          placeholderTextColor={text.tertiary}
          accessibilityLabel="Note"
          multiline
        />

        <PressScale accessibilityRole="button" accessibilityLabel="Delete this record" scaleTo={0.97} style={styles.delete} onPress={remove}>
          <TrashIcon size={16} color={text.secondary} weight="bold" />
          <Text style={styles.deleteText}>Delete record</Text>
        </PressScale>
      </Animated.View>
    </DetailShell>
  );
}

/** A detail row: label and current value; tapping opens its editor below and turns the caret. */
const Row = ({ label, value, open, ruled = false, onPress, children }: { label: string; value: string; open: boolean; ruled?: boolean; onPress: () => void; children: ReactNode }) => {
  const reduceMotion = useReducedMotion();
  const turn = useDerivedValue(() => (reduceMotion ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out })), [open]);
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <View style={ruled && styles.ruled}>
      <PressScale accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}, ${value}`} scaleTo={0.985} style={styles.row} onPress={onPress}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, open && styles.rowValueOpen]} numberOfLines={1}>
          {value}
        </Text>
        <Animated.View style={caret}>
          <CaretDownIcon size={14} color={text.tertiary} weight="bold" />
        </Animated.View>
      </PressScale>
      {open ? (
        <Animated.View entering={reduceMotion ? undefined : enter({ y: -6 }, { duration: motion.duration.enter })} style={styles.editor}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { marginTop: space.lg, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  heroDate: { fontSize: 34, lineHeight: 40, letterSpacing: -0.7, fontWeight: "600", color: text.primary, marginTop: space.lg },
  heroSub: { ...type.supporting, color: text.secondary, marginTop: 2 },
  heroNext: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start", marginTop: space.lg, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.canvas },
  heroDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.deep },
  heroDotLate: { backgroundColor: accent.band },
  heroNextText: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.primary },

  list: { marginTop: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 56, paddingHorizontal: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  switch: { alignSelf: "center" },
  rowLabel: { ...type.cardTitle, fontWeight: "500", color: text.primary },
  rowValue: { ...type.supporting, color: text.secondary, flex: 1, textAlign: "right" },
  rowValueOpen: { color: text.primary, fontWeight: "600" },
  editor: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },

  section: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.xl, marginBottom: space.sm },
  note: { minHeight: 110, padding: space.lg, paddingTop: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, ...type.body, color: text.primary, textAlignVertical: "top" },
  delete: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, alignSelf: "center", marginTop: space.section, paddingVertical: space.md, paddingHorizontal: space.lg },
  deleteText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
