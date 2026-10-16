import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { PlusIcon, type IconProps } from "phosphor-react-native";

import type { MarkKind } from "@/features/care/components/CareCalendar";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

export type AgendaEvent = {
  id: string;
  /** YYYY-MM-DD, or null for things with no date yet (a shot still to book). */
  dayKey: string | null;
  time?: string | null;
  title: string;
  detail?: string;
  Glyph: ComponentType<IconProps>;
  /** Sets the colour of the day's mark on the calendar. */
  kind: MarkKind;
  /** One day of a repeating routine: shown on its day, left out of Coming up so a daily walk does not fill it. */
  routine?: boolean;
  onPress?: () => void;
};

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const parse = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * What the calendar is for: the dates that matter, in order. The picked day first with a way to add a walk,
 * then everything coming up, grouped under a date badge.
 */
export const CareAgenda = ({
  selectedKey,
  todayKey,
  events,
  dailyNote,
  reduceMotion,
  onPlanWalk,
}: {
  selectedKey: string;
  todayKey: string;
  events: readonly AgendaEvent[];
  /** The everyday routine in one line, e.g. "3 walks, 2 meals and a check-in". */
  dailyNote: string | null;
  reduceMotion: boolean;
  onPlanWalk: (dayKey: string) => void;
}) => {
  const selected = parse(selectedKey);
  const onDay = events.filter((event) => event.dayKey === selectedKey);
  const undated = events.filter((event) => event.dayKey === null);
  const later = events
    .filter((event) => event.dayKey && !event.routine && event.dayKey >= todayKey && event.dayKey !== selectedKey)
    .sort((a, b) => `${a.dayKey}${a.time ?? ""}`.localeCompare(`${b.dayKey}${b.time ?? ""}`));
  const groups = later.reduce<{ key: string; items: AgendaEvent[] }[]>((acc, event) => {
    const last = acc[acc.length - 1];
    if (last && last.key === event.dayKey) last.items.push(event);
    else acc.push({ key: event.dayKey!, items: [event] });
    return acc;
  }, []);
  const settle = reduceMotion ? undefined : LinearTransition.duration(240).easing(motion.easing.inOut);
  const appear = reduceMotion ? undefined : FadeIn.duration(motion.duration.enter);
  const dayTitle = selectedKey === todayKey ? "Today" : `${WEEKDAY[selected.getDay()]}, ${selected.getDate()} ${MON[selected.getMonth()].toLowerCase().replace(/^./, (c) => c.toUpperCase())}`;

  return (
    <View>
      <Animated.View key={selectedKey} entering={appear} layout={settle} style={styles.day}>
        <Text style={styles.dayTitle}>{dayTitle}</Text>
        {onDay.length ? (
          onDay.map((event) => <Row key={event.id} event={event} />)
        ) : (
          <Text style={styles.empty}>{selectedKey === todayKey ? "Nothing extra today." : "Nothing planned yet."}</Text>
        )}
        {dailyNote ? <Text style={styles.daily}>{`Every day: ${dailyNote}.`}</Text> : null}
        {selectedKey >= todayKey ? (
          <PressScale accessibilityRole="button" accessibilityLabel={`Plan a walk for ${dayTitle}`} scaleTo={0.97} style={styles.add} onPress={() => onPlanWalk(selectedKey)}>
            <PlusIcon size={14} color={text.primary} weight="bold" />
            <Text style={styles.addText}>Plan a walk</Text>
          </PressScale>
        ) : null}
      </Animated.View>

      {undated.length ? (
        <Animated.View entering={appear} layout={settle} style={styles.section}>
          <Text style={styles.sectionTitle}>To book</Text>
          {undated.map((event) => (
            <Row key={event.id} event={event} />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View layout={settle} style={styles.section}>
        <Text style={styles.sectionTitle}>Coming up</Text>
        {groups.length === 0 ? <Text style={styles.empty}>Nothing else on the calendar yet.</Text> : null}
        {groups.map((group) => {
          const date = parse(group.key);
          return (
            <Animated.View key={group.key} entering={appear} layout={settle} style={styles.group}>
              <View style={styles.badge}>
                <Text style={styles.badgeMonth}>
                  {date.getFullYear() !== parse(todayKey).getFullYear() ? `${MON[date.getMonth()]} ’${String(date.getFullYear()).slice(2)}` : MON[date.getMonth()]}
                </Text>
                <Text style={styles.badgeDay}>{date.getDate()}</Text>
              </View>
              <View style={styles.groupItems}>
                {group.items.map((event) => (
                  <Row key={event.id} event={event} compact />
                ))}
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const Row = ({ event, compact = false }: { event: AgendaEvent; compact?: boolean }) => {
  const body = (
    <>
      {compact ? null : (
        <View style={styles.icon}>
          <event.Glyph size={16} color={text.primary} weight="regular" />
        </View>
      )}
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        {event.detail ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {event.detail}
          </Text>
        ) : null}
      </View>
      {compact ? <event.Glyph size={16} color={text.tertiary} weight="regular" /> : null}
    </>
  );
  return event.onPress ? (
    <PressScale accessibilityRole="button" accessibilityLabel={`${event.title}. ${event.detail ?? ""}`} scaleTo={0.98} style={styles.row} onPress={event.onPress}>
      {body}
    </PressScale>
  ) : (
    <View style={styles.row} accessibilityLabel={`${event.title}. ${event.detail ?? ""}`}>
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  day: { padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle, gap: space.xs },
  dayTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary, marginBottom: space.xs },
  empty: { ...type.supporting, color: text.secondary },
  daily: { ...type.caption, color: text.tertiary, marginTop: space.xs },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    marginTop: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  addText: { ...type.supporting, fontWeight: "700", color: text.primary },

  section: { marginTop: space.section },
  sectionTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary, marginBottom: space.sm },
  group: { flexDirection: "row", gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: border.soft },
  badge: { width: 52, alignItems: "center", paddingTop: 4 },
  badgeMonth: { ...type.eyebrow, fontSize: 10, color: text.tertiary },
  badgeDay: { fontSize: 22, lineHeight: 26, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  groupItems: { flex: 1 },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 46 },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowDetail: { ...type.caption, color: text.secondary, marginTop: 1 },
});
