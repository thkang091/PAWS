import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { LinearTransition, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowCounterClockwiseIcon, BugIcon, CaretRightIcon, CheckIcon, ShieldCheckIcon, StethoscopeIcon, ToothIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { KIND_GLYPH, shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { CARE_LABEL, areaSummary, dueFor, entriesFor, kindsFor, type CareArea, type Due, type LogEntry } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { saveDose, undoDose } from "@/features/care/state/careDose";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const TITLE: Record<CareArea, string> = { parasites: "Parasite prevention", dental: "Dental care", exams: "Exams & testing" };
const GLYPH = { parasites: BugIcon, dental: ToothIcon, exams: StethoscopeIcon } as const;

const lede = (area: CareArea, stage: string, name: string) =>
  area === "parasites"
    ? `Protection against fleas, ticks and worms, all year.`
    : area === "dental"
      ? "Brushing most days, and a cleaning once a year."
      : stage === "senior"
        ? `As a senior, ${name} is due a check every six months.`
        : stage === "puppy"
          ? `Puppies see the vet often in the first months.`
          : `Once a year keeps small problems small.`;

const statusText = (d: Due, product: string | null) => {
  if (d.kind === "brushing") return d.status === "unknown" ? "Not logged yet" : d.status === "ok" ? "On track this week" : "Less than 3 times this week";
  if (d.status === "unknown") return "Not added yet";
  const lead = product ? `${product} · ` : "";
  if (d.daysLeft == null) return d.last ? `${lead}Last on ${shortDay(d.last)}` : "Not needed yet";
  if (d.daysLeft < 0) return `Due ${-d.daysLeft} ${d.daysLeft === -1 ? "day" : "days"} ago`;
  if (d.daysLeft === 0) return `${lead}Due today`;
  if (d.daysLeft === 1) return `${lead}Due tomorrow`;
  return `${lead}Next ${shortDay(d.next!)}`;
};

/** One care area from Health's Care plan: what is due, how much protection is left, and a fast way to log the next one. */
export default function PreventiveScreen() {
  const { area: raw } = useLocalSearchParams<{ area?: string }>();
  const area: CareArea = raw === "dental" || raw === "exams" ? raw : "parasites";
  const intel = useCareIntel();
  const reduceMotion = useReducedMotion();

  const dues = kindsFor(area, intel.stage).map((kind) => dueFor(kind, intel.log, intel.stage, intel.today));
  const summary = areaSummary(area, intel.log, intel.stage, intel.today);
  const Glyph = GLYPH[area];
  const clear = summary.text === "All up to date";
  const until = dues.map((d) => d.next).filter((n): n is string => Boolean(n)).sort()[0];
  const headline = clear && area === "parasites" && until ? `Protected until ${shortDay(until)}` : summary.text;

  return (
    <DetailShell title={TITLE[area]} glyph={<Glyph size={iconSize.standard} color={accent.band} weight="bold" />} back="/(tabs)/care">
      <Text style={styles.lede}>{lede(area, intel.stage, intel.name)}</Text>

      <Animated.View key={headline} entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.hero}>
        <View style={[styles.heroMark, clear && styles.heroMarkOk]}>
          {clear ? <ShieldCheckIcon size={22} color={text.primary} weight="fill" /> : <Glyph size={22} color={text.primary} weight="regular" />}
        </View>
        <Text style={styles.headline}>{headline}</Text>
      </Animated.View>

      <View style={styles.list}>
        {dues.map((d, i) => (
          <Item key={d.kind} due={d} last={entriesFor(d.kind, intel.log)[0] ?? null} ruled={i > 0} intel={intel} />
        ))}
      </View>

      <PressScale accessibilityRole="button" accessibilityLabel="Open Health records" scaleTo={0.98} style={styles.records} onPress={() => router.push("/care/records" as never)}>
        <Text style={styles.recordsText}>See the history in Health records</Text>
        <CaretRightIcon size={iconSize.inline} color={text.secondary} weight="bold" />
      </PressScale>
    </DetailShell>
  );
}

const Item = ({ due, last, ruled, intel }: { due: Due; last: LogEntry | null; ruled: boolean; intel: ReturnType<typeof useCareIntel> }) => {
  const [undo, setUndo] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const Glyph = KIND_GLYPH[due.kind];
  const product = last?.product ?? null;
  const brushing = due.kind === "brushing";
  // One tap repeats the last dose today when it is the same product as always and the next one is due.
  const quick = brushing || (product != null && (due.status === "due" || due.status === "soon"));
  const label = undo ? "Undo" : due.status === "unknown" && !brushing ? "Add" : brushing ? "Brushed" : quick ? "Given" : "Log";
  const strong = Boolean(undo) || due.status === "unknown" || due.status === "due" || (quick && due.status === "soon");
  const open = () => router.push(`/care/log-care?kind=${due.kind}` as never);

  const act = () => {
    if (undo) {
      void Haptics.selectionAsync();
      undoDose(undo, due.kind);
      setUndo(null);
      return;
    }
    if (!quick) return open();
    const id = saveDose({
      kind: due.kind,
      date: intel.today,
      stage: intel.stage,
      dogName: intel.name,
      product,
      everyDays: last?.everyDays ?? null,
      covers: last?.covers ?? null,
      remind: last?.remind ?? false,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUndo(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 5000);
  };

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${CARE_LABEL[due.kind]}. ${statusText(due, product)}`}
      accessibilityHint="Opens the log"
      scaleTo={0.985}
      style={[styles.row, ruled && styles.ruled]}
      onPress={open}
    >
      <ProtectionRing due={due}>
        <View style={[styles.disc, due.status === "due" && styles.discOn]}>
          <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
        </View>
      </ProtectionRing>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{CARE_LABEL[due.kind]}</Text>
        <View style={styles.statusRow}>
          {due.status === "due" ? <View style={styles.flag} /> : null}
          <Text style={[styles.status, due.status === "due" && styles.statusOn]} numberOfLines={1}>
            {statusText(due, product)}
          </Text>
        </View>
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel={undo ? `Undo ${CARE_LABEL[due.kind]}` : `${label} ${CARE_LABEL[due.kind]}`} hitSlop={8} scaleTo={0.94} onPress={act}>
        <Animated.View layout={LinearTransition.duration(motion.duration.select)} style={[styles.log, strong && styles.logOn, undo && styles.logUndo]}>
          <Animated.View key={label} entering={enter({ y: 4 }, { duration: motion.duration.select })} style={styles.logInner}>
            {undo ? <ArrowCounterClockwiseIcon size={13} color={text.inverse} weight="bold" /> : quick && label !== "Log" ? <CheckIcon size={13} color={text.primary} weight="bold" /> : null}
            <Text style={[styles.logText, undo && styles.logTextUndo]}>{label}</Text>
          </Animated.View>
        </Animated.View>
      </PressScale>
    </PressScale>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 52;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

/** How much of this dose's protection is left, drawn around the icon: full right after a dose, empty when due. */
const ProtectionRing = ({ due, children }: { due: Due; children: ReactNode }) => {
  const reduceMotion = useReducedMotion();
  const left = due.daysLeft != null && due.everyDays ? Math.max(0, Math.min(1, due.daysLeft / due.everyDays)) : 0;
  const shown = due.status === "unknown" || due.kind === "brushing" ? 0 : left;
  const value = useSharedValue(reduceMotion ? shown : 0);
  useEffect(() => {
    value.value = reduceMotion ? shown : withTiming(shown, { duration: motion.duration.flourish, easing: motion.easing.out });
  }, [shown, value, reduceMotion]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - value.value) }));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={border.soft} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={due.status === "soon" ? accent.band : accent.deep}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={props}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lede: { ...type.supporting, color: text.secondary, marginTop: space.lg },
  hero: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, marginBottom: space.lg, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroMark: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  heroMarkOk: { backgroundColor: accent.deep },
  headline: { ...type.sectionTitle, color: text.primary, flex: 1 },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  disc: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  status: { ...type.caption, color: text.tertiary, flexShrink: 1 },
  statusOn: { color: text.primary, fontWeight: "600" },
  log: { height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  logOn: { backgroundColor: accent.deep },
  logUndo: { backgroundColor: text.primary },
  logInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  logText: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.primary },
  logTextUndo: { color: text.inverse },

  records: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: space.lg, marginTop: space.md },
  recordsText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
