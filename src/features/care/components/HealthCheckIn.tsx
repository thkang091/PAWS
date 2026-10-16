import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { CheckIcon, PencilSimpleIcon } from "phosphor-react-native";

import { STAT_LABELS, summarize, verdictOf, type StatKey } from "@/features/care/health/checkInSummary";
import type { DailyCheckIn } from "@/features/care/state/dailyCheckIn";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, scene, space, text, type } from "@/constants/design";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const dayName = (d: Date) => `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;

export const DaySummary = ({
  entry,
  dogName,
  date,
  isToday,
}: {
  entry: DailyCheckIn;
  dogName: string;
  date: Date;
  isToday: boolean;
}) => {
  const reduceMotion = useReducedMotion();
  const stats = summarize(entry);
  const verdict = verdictOf(entry, dogName);
  const allGood = stats.every((stat) => stat.ok);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.reveal).easing(motion.easing.out)}
      style={styles.summary}
    >
      <View style={styles.summaryHead}>
        <Text style={[styles.summaryTitle, styles.summaryTitleFlex]}>{isToday ? `How is ${dogName} today?` : `How ${dogName} was on ${dayName(date)}`}</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Edit this check-in"
          hitSlop={8}
          scaleTo={0.94}
          style={styles.edit}
          onPress={() => {
            void Haptics.selectionAsync();
            router.push(`/care/check-in-edit?date=${entry.date}` as never);
          }}
        >
          <PencilSimpleIcon size={13} color={text.primary} weight="bold" />
          <Text style={styles.editText}>Edit</Text>
        </PressScale>
      </View>

      <View style={styles.rows}>
        {stats.map((stat, index) => (
          <Animated.View
            key={stat.key}
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(120 + index * 50)}
            style={[styles.row, index > 0 && styles.ruled]}
            accessibilityLabel={`${stat.label} ${stat.value}`}
          >
            <Text style={styles.rowLabel}>{stat.label}</Text>
            <View style={styles.rowValueWrap}>
              {!stat.ok ? <View style={styles.flag} /> : null}
              <Text style={[styles.rowValue, !stat.ok && styles.rowValueOff]} numberOfLines={2}>
                {stat.value}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={[styles.verdict, !allGood && styles.verdictWatch]}>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.enter).delay(420).easing(motion.easing.out)}
          style={[styles.done, !allGood && styles.doneWatch]}
        >
          <CheckIcon size={16} color={allGood ? text.primary : text.inverse} weight="bold" />
        </Animated.View>
        <View style={styles.verdictCopy}>
          <Text style={styles.verdictTitle}>{`Done. ${verdict.title}`}</Text>
          <Text style={styles.verdictLine}>{verdict.line}</Text>
        </View>
      </View>

      {entry.support && entry.unusual.length ? <SupportCard support={entry.support} reduceMotion={reduceMotion} /> : null}
    </Animated.View>
  );
};

const LEVEL_LABEL = { home: "Watch at home", call: "Call your vet", urgent: "Go to a vet now" } as const;
const LEVEL_DOT = { home: scene.sageDeep, call: accent.band, urgent: "#C2412D" } as const;

/** What PAWS suggested when the unusual signs were logged, so the advice is still here the next morning. */
const SupportCard = ({ support, reduceMotion }: { support: NonNullable<DailyCheckIn["support"]>; reduceMotion: boolean }) => (
  <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(520)} style={styles.support}>
    <View style={styles.supportLevel}>
      <View style={[styles.supportDot, { backgroundColor: LEVEL_DOT[support.level] }]} />
      <Text style={styles.supportLevelText}>{LEVEL_LABEL[support.level]}</Text>
    </View>
    <Text style={styles.supportHeadline}>{support.headline}</Text>
    <Text style={styles.supportSummary}>{support.summary}</Text>
    {support.watch.length ? (
      <View style={styles.supportWatch}>
        <Text style={styles.supportWatchLabel}>Call sooner if</Text>
        {support.watch.map((sign) => (
          <View key={sign} style={styles.supportRow}>
            <View style={styles.supportFlag} />
            <Text style={styles.supportRowText}>{sign}</Text>
          </View>
        ))}
      </View>
    ) : null}
  </Animated.View>
);

export const MissedDay = ({ date }: { date: Date }) => (
  <View style={styles.missed}>
    <Text style={styles.missedTitle}>{`No check-in on ${dayName(date)}`}</Text>
    <Text style={styles.missedLine}>Only the day itself can be answered, so this one stays blank.</Text>
  </View>
);

type Cell = "ok" | "off" | "missed" | "future";

export const WeekGrid = ({
  week,
  byDate,
  selectedKey,
  onSelect,
}: {
  week: readonly Date[];
  byDate: Readonly<Record<string, DailyCheckIn>>;
  selectedKey: string;
  onSelect?: (date: Date) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const today = dayKeyOf(new Date());
  const columns = week.map((date) => {
    const key = dayKeyOf(date);
    const entry = byDate[key] ?? null;
    const stats = entry ? summarize(entry) : null;
    return {
      date,
      key,
      entry,
      cell: (stat: StatKey): Cell =>
        key > today ? "future" : !stats ? "missed" : stats.find((item) => item.key === stat)?.ok ? "ok" : "off",
    };
  });

  const answered = columns.filter((column) => column.entry).length;
  const clean = columns.filter((column) => column.entry && summarize(column.entry).every((stat) => stat.ok)).length;
  const offCounts = STAT_LABELS.map((stat) => ({
    label: stat.label.replace("?", ""),
    count: columns.filter((column) => column.cell(stat.key) === "off").length,
  })).sort((a, b) => b.count - a.count);
  const worst = offCounts[0];
  const flagged = offCounts.filter((item) => item.count > 0).map((item) => item.label);
  const offNames = flagged.length <= 1 ? flagged.join("") : `${flagged.slice(0, -1).join(", ")} and ${flagged.at(-1)?.toLowerCase()}`;
  const elapsed = columns.filter((column) => column.key <= today).length;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
      <View style={styles.weekHead}>
        <Text style={styles.weekBig}>{clean}</Text>
        <View style={styles.weekHeadCopy}>
          <Text style={styles.weekHeadTitle}>{`of ${elapsed} ${elapsed === 1 ? "day" : "days"} all normal`}</Text>
          <Text style={styles.weekHeadLine}>
            {answered === 0
              ? "No check-ins yet this week."
              : worst.count > 0
                ? `Answered ${answered} of ${elapsed}. ${offNames} ${flagged.length === 1 ? "was" : "were"} off.`
                : `Answered ${answered} of ${elapsed}. Nothing flagged.`}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.gridLabelCol} />
          {columns.map((column) => (
            <PressScale
              key={column.key}
              accessibilityRole="button"
              accessibilityLabel={`${dayName(column.date)}. Open the day.`}
              disabled={!onSelect || column.key > today}
              scaleTo={0.9}
              style={styles.gridCol}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect?.(column.date);
              }}
            >
              <Text
                style={[
                  styles.gridDay,
                  column.key === today && styles.gridDayToday,
                  onSelect && column.key === selectedKey && styles.gridDaySelected,
                ]}
              >
                {LETTER[column.date.getDay()]}
              </Text>
            </PressScale>
          ))}
        </View>

        {STAT_LABELS.map((stat) => (
          <View key={stat.key} style={styles.gridRow}>
            <Text style={styles.gridLabel} numberOfLines={1}>
              {stat.key === "unusual" ? "Unusual" : stat.label}
            </Text>
            {columns.map((column) => {
              const cell = column.cell(stat.key);
              return (
                <PressScale
                  key={column.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${stat.label} on ${dayName(column.date)}: ${cell === "ok" ? "normal" : cell === "off" ? "off" : cell === "missed" ? "not answered" : "not yet"}`}
                  disabled={!onSelect || cell === "future"}
                  scaleTo={0.85}
                  style={styles.gridCol}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onSelect?.(column.date);
                  }}
                >
                  <View
                    style={[
                      styles.cell,
                      cell === "ok" && styles.cellOk,
                      cell === "off" && styles.cellOff,
                      cell === "missed" && styles.cellMissed,
                      cell === "future" && styles.cellFuture,
                    ]}
                  />
                </PressScale>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Legend swatch={styles.cellOk} label="Normal" />
        <Legend swatch={styles.legendOff} label="Off" />
        <Legend swatch={styles.cellMissed} label="Not answered" />
      </View>
    </Animated.View>
  );
};

const Legend = ({ swatch, label }: { swatch: object; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, swatch]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const CELL = 22;

const styles = StyleSheet.create({

  summary: {
    marginTop: space.xl,
    padding: space.xl,
    borderRadius: radius.card + 8,
    backgroundColor: accent.soft,
  },
  summaryTitle: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary },
  rows: { marginTop: space.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.lg, paddingVertical: 14 },
  ruled: { borderTopWidth: 1, borderTopColor: "rgba(28,27,26,0.08)" },
  rowLabel: { ...type.body, color: text.secondary },
  rowValueWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
  rowValue: { ...type.body, fontWeight: "600", color: text.primary, textAlign: "right", flexShrink: 1 },
  rowValueOff: { color: text.primary },
  flag: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.band },

  verdict: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.primary,
  },
  verdictWatch: { backgroundColor: bg.canvas },
  done: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  doneWatch: { backgroundColor: text.primary },
  verdictCopy: { flex: 1 },
  summaryHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  summaryTitleFlex: { flex: 1 },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  editText: { ...type.caption, fontWeight: "700", color: text.primary },
  support: { marginTop: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas },
  supportLevel: { flexDirection: "row", alignItems: "center", gap: 6 },
  supportDot: { width: 8, height: 8, borderRadius: 4 },
  supportLevelText: { ...type.caption, fontWeight: "600", color: text.secondary },
  supportHeadline: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.sm },
  supportSummary: { ...type.supporting, color: text.secondary, marginTop: 2 },
  supportWatch: { marginTop: space.md, gap: 4 },
  supportWatchLabel: { ...type.caption, fontWeight: "600", color: text.primary },
  supportRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  supportFlag: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent.band },
  supportRowText: { ...type.supporting, color: text.primary, flex: 1 },
  verdictTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  verdictLine: { ...type.caption, color: text.secondary, marginTop: 2 },

  missed: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: bg.subtle },
  missedTitle: { ...type.sectionTitle, color: text.primary },
  missedLine: { ...type.supporting, color: text.secondary, marginTop: space.sm },

  weekHead: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.xl },
  weekBig: { ...type.hero, fontSize: 56, lineHeight: 58, color: text.primary, fontVariant: ["tabular-nums"] },
  weekHeadCopy: { flex: 1 },
  weekHeadTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  weekHeadLine: { ...type.caption, color: text.secondary, marginTop: 3, lineHeight: 17 },

  grid: { marginTop: space.xl, padding: space.lg, paddingLeft: space.md, borderRadius: radius.card + 4, backgroundColor: bg.subtle, gap: space.sm },
  gridRow: { flexDirection: "row", alignItems: "center" },
  gridLabelCol: { width: 78 },
  gridLabel: { ...type.caption, color: text.secondary, width: 78 },
  gridCol: { flex: 1, alignItems: "center", justifyContent: "center", height: 30 },
  gridDay: { ...type.caption, fontWeight: "600", color: text.tertiary, width: 24, height: 24, lineHeight: 24, textAlign: "center", borderRadius: 12, overflow: "hidden" },
  gridDayToday: { color: text.primary, fontWeight: "800" },
  gridDaySelected: { backgroundColor: text.primary, color: text.inverse },
  cell: { width: CELL, height: CELL, borderRadius: CELL / 2, backgroundColor: bg.canvas },
  cellOk: { backgroundColor: accent.deep },
  cellOff: { backgroundColor: bg.canvas, borderWidth: 6, borderColor: accent.band },
  cellFuture: { opacity: 0.55 },
  cellMissed: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: border.strong, borderStyle: "dashed" },

  legend: { flexDirection: "row", gap: space.lg, marginTop: space.md, paddingLeft: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { ...type.caption, color: text.secondary },
  legendOff: { backgroundColor: bg.canvas, borderWidth: 3, borderColor: accent.band },
});
