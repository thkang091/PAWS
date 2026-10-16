import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { CheckIcon, HeartbeatIcon } from "phosphor-react-native";

import { DetailEmpty, DetailShell, goBack } from "@/features/care/components/DetailShell";
import { APPETITE, DRINKING, ENERGY, STOOL, UNUSUAL, URINATION } from "@/features/care/components/DailyHealthCheckSheet";
import { enter } from "@/features/care/food/enter";
import { MOBILITY_LABEL, type MobilitySign } from "@/features/care/intel/careIntel";
import { useDogContext } from "@/features/care/intel/useDogContext";
import { updateCheckIn, useCheckInByDate, useCheckInHistory, type DailyCheckIn, type UnusualSign } from "@/features/care/state/dailyCheckIn";
import { supportFor } from "@/services/checkInSupport";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

type Single = "appetite" | "energy" | "stool" | "urination" | "drinking";
const SINGLES: readonly { key: Single; label: string; options: readonly { key: string; label: string }[] }[] = [
  { key: "appetite", label: "Eating", options: APPETITE },
  { key: "energy", label: "Energy", options: ENERGY },
  { key: "stool", label: "Stool", options: STOOL },
  { key: "urination", label: "Peeing", options: URINATION },
  { key: "drinking", label: "Water", options: DRINKING },
];

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayTitle = (iso: string) => {
  if (iso === todayIso()) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY[new Date(y, m - 1, d).getDay()]}, ${MONTH[m - 1]} ${d}`;
};

/**
 * Changing a check-in after it was saved. Every answer is on one page as a row of choices, already set to what was
 * picked, so a fix is one tap. Save appears once something changed; if the unusual signs changed, the advice for
 * them is worked out again with the dog's full profile.
 */
export default function CheckInEditScreen() {
  const { date: param } = useLocalSearchParams<{ date?: string }>();
  const date = param ?? todayIso();
  const reduceMotion = useReducedMotion();
  const byDate = useCheckInByDate();
  const history = useCheckInHistory();
  const context = useDogContext();
  const saved = byDate[date] ?? null;
  const [draft, setDraft] = useState<DailyCheckIn | null>(saved);

  useEffect(() => {
    if (!draft && saved) setDraft(saved);
  }, [draft, saved]);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  if (!saved || !draft) {
    return (
      <DetailShell title="Check-in" glyph={<HeartbeatIcon size={iconSize.standard} color={accent.band} weight="bold" />} back="/(tabs)/care">
        <DetailEmpty glyph={<HeartbeatIcon size={26} color={text.primary} />} title="No check-in that day" body="There is nothing to change yet." />
      </DetailShell>
    );
  }

  const set = (patch: Partial<DailyCheckIn>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const pick = () => void Haptics.selectionAsync();

  const save = () => {
    const signature = (e: DailyCheckIn) => `${[...e.unusual].sort().join(",")}|${e.unusualNote.trim()}`;
    const signsChanged = signature(draft) !== signature(saved);
    const next = { ...draft, unusualNote: draft.unusualNote.trim(), support: draft.unusual.length ? (signsChanged ? null : draft.support) : null };
    const { date: _d, ...patch } = next;
    updateCheckIn(date, patch);
    // New or different signs get fresh advice, read against the whole profile, saved when it arrives.
    if (signsChanged && next.unusual.length) {
      void supportFor(
        next,
        history.filter((h) => h.date !== date),
        { name: context.name, breed: context.breed, ageYears: context.ageYears, weightKg: context.weightKg, stage: context.stage, allergies: context.allergies, brief: context.brief },
      ).then((support) => updateCheckIn(date, { support }));
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goBack("/(tabs)/care");
  };

  return (
    <DetailShell
      title="Edit check-in"
      glyph={<HeartbeatIcon size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/(tabs)/care"
      action={changed ? { label: "Save changes", icon: <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: save } : undefined}
    >
      <Text style={styles.day}>{dayTitle(date)}</Text>
      <Text style={styles.lede}>{`Tap any answer to change it for ${context.name}.`}</Text>

      {SINGLES.map((q, i) => (
        <Animated.View key={q.key} entering={reduceMotion ? undefined : enter({ y: 8 }, { delay: i * 40, duration: motion.duration.enter })} style={styles.block}>
          <Text style={styles.label}>{q.label}</Text>
          <View style={styles.chips}>
            {q.options.map((o) => (
              <Choice
                key={o.key}
                label={o.label}
                on={draft[q.key] === o.key}
                flag={o.key !== "normal" && draft[q.key] === o.key}
                onPress={() => {
                  pick();
                  set({ [q.key]: o.key } as Partial<DailyCheckIn>);
                }}
              />
            ))}
          </View>
        </Animated.View>
      ))}

      <View style={styles.block}>
        <Text style={styles.label}>Anything unusual</Text>
        <View style={styles.chips}>
          <Choice label="Nothing" on={draft.unusual.length === 0} onPress={() => (pick(), set({ unusual: [] }))} />
          {UNUSUAL.map((u) => {
            const on = draft.unusual.includes(u.key);
            return (
              <Choice
                key={u.key}
                label={u.label}
                on={on}
                flag={on}
                multi
                onPress={() => {
                  pick();
                  set({ unusual: on ? draft.unusual.filter((k) => k !== u.key) : ([...draft.unusual, u.key] as UnusualSign[]) });
                }}
              />
            );
          })}
        </View>
        {draft.unusual.length ? (
          <TextInput
            style={styles.note}
            value={draft.unusualNote}
            onChangeText={(unusualNote) => set({ unusualNote })}
            placeholder="What did you notice? When did it start?"
            placeholderTextColor={text.tertiary}
            accessibilityLabel="What you noticed"
            multiline
          />
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Movement</Text>
        <View style={styles.chips}>
          <Choice label="No problems" on={!draft.mobility?.length} onPress={() => (pick(), set({ mobility: [] }))} />
          {(Object.keys(MOBILITY_LABEL) as MobilitySign[]).map((sign) => {
            const on = Boolean(draft.mobility?.includes(sign));
            return (
              <Choice
                key={sign}
                label={MOBILITY_LABEL[sign]}
                on={on}
                flag={on}
                multi
                onPress={() => {
                  pick();
                  const now = draft.mobility ?? [];
                  set({ mobility: on ? now.filter((x) => x !== sign) : [...now, sign] });
                }}
              />
            );
          })}
        </View>
      </View>
    </DetailShell>
  );
}

/** One answer. Picked answers turn ink; anything other than normal gets a small amber dot so changes are easy to see. */
const Choice = ({ label, on, flag = false, multi = false, onPress }: { label: string; on: boolean; flag?: boolean; multi?: boolean; onPress: () => void }) => (
  <PressScale
    accessibilityRole={multi ? "checkbox" : "radio"}
    accessibilityState={multi ? { checked: on } : { selected: on }}
    accessibilityLabel={label}
    scaleTo={0.95}
    style={[styles.choice, on && styles.choiceOn]}
    onPress={onPress}
  >
    {flag ? <View style={styles.dot} /> : null}
    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
  </PressScale>
);

const styles = StyleSheet.create({
  day: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  lede: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  block: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: border.soft },
  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginBottom: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  choice: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas },
  choiceOn: { backgroundColor: text.primary, borderColor: text.primary },
  choiceText: { ...type.supporting, color: text.primary },
  choiceTextOn: { color: text.inverse, fontWeight: "600" },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  note: { minHeight: 76, marginTop: space.md, padding: space.lg, paddingTop: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary, textAlignVertical: "top" },
});
