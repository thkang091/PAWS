import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { BellSimpleIcon, MapTrifoldIcon, PlusIcon, XIcon } from "phosphor-react-native";

import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { cancelPlannedWalk, isRoutine, nextStart, repeatLabel, usePlannedWalks, type PlannedWalk } from "@/features/care/state/plannedWalks";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayWord = (key: string) => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (key === keyOf(today)) return "Today";
  if (key === keyOf(tomorrow)) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY[date.getDay()]} ${date.getDate()} ${MONTH[date.getMonth()]}`;
};

export const WalkPlanner = () => {
  const reduceMotion = useReducedMotion();
  const walks = usePlannedWalks();
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const openPlanner = () => {
    void Haptics.selectionAsync();
    router.push("/care/plan-walk" as never);
  };

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Walks ahead</Text>
        <PressScale accessibilityRole="button" accessibilityLabel="Plan a walk" scaleTo={0.95} style={styles.plan} onPress={openPlanner}>
          <PlusIcon size={14} color={text.primary} weight="bold" />
          <Text style={styles.planText}>Plan</Text>
        </PressScale>
      </View>

      {walks.length === 0 ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Plan a walk on the map" scaleTo={0.985} style={styles.empty} onPress={openPlanner}>
          <View style={styles.emptyDisc}>
            <MapTrifoldIcon size={iconSize.standard} color={text.primary} weight="regular" />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Plan where and when</Text>
            <Text style={styles.rowMeta}>Pick a time and a route</Text>
          </View>
        </PressScale>
      ) : (
        <Animated.View layout={settle} style={styles.list}>
          {walks.map((walk, index) => (
            <WalkRow key={walk.id} walk={walk} ruled={index > 0} />
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const WalkRow = ({ walk, ruled }: { walk: PlannedWalk; ruled: boolean }) => {
  const reduceMotion = useReducedMotion();
  const start = nextStart(walk);
  const soon = start.getTime() - Date.now() < 3 * 60 * 60 * 1000;
  const routine = isRoutine(walk);
  const when = routine ? `${repeatLabel(walk.repeat!)}, next ${dayWord(keyOf(start)).toLowerCase()}` : dayWord(walk.dayKey);
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
      style={ruled && styles.ruled}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${when} at ${prettyTime(walk.time)}. ${walk.route?.name ?? "Walk"}, ${walk.minutes} minutes. Open it`}
        scaleTo={0.985}
        style={styles.row}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push(`/care/plan-walk?plan=${encodeURIComponent(walk.id)}` as never);
        }}
      >
        <View style={[styles.when, soon && styles.whenSoon]}>
          <Text style={styles.whenTime}>{prettyTime(walk.time).split(" ")[0]}</Text>
          <Text style={styles.whenMeridiem}>{prettyTime(walk.time).split(" ")[1]}</Text>
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {walk.route?.name ?? `${walk.minutes} min walk`}
          </Text>
          <View style={styles.metaRow}>
            <BellSimpleIcon size={11} color={text.tertiary} weight="fill" />
            <Text style={styles.rowMeta} numberOfLines={1}>
              {`${when}, ${walk.minutes} min`}
            </Text>
          </View>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Remove this walk"
          hitSlop={8}
          scaleTo={0.9}
          style={styles.remove}
          onPress={() => {
            void Haptics.selectionAsync();
            cancelPlannedWalk(walk.id);
          }}
        >
          <XIcon size={14} color={text.tertiary} weight="bold" />
        </PressScale>
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.block, marginBottom: space.xl },
  title: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  planText: { ...type.supporting, fontWeight: "600", color: text.primary },

  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  emptyDisc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  when: {
    width: 54,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  whenSoon: { backgroundColor: accent.deep },
  whenTime: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"], lineHeight: 18 },
  whenMeridiem: { ...type.caption, fontSize: 11, lineHeight: 13, color: text.secondary },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  rowMeta: { ...type.caption, color: text.tertiary, lineHeight: 17 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },


});
