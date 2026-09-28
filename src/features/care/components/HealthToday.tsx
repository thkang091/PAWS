import { useEffect, useMemo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  FadeIn,
  LinearTransition,
  ZoomIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckIcon, HeartbeatIcon, PillIcon } from "phosphor-react-native";

import { verdictOf } from "@/features/care/health/checkInSummary";
import { dueOn, isFinished, prettyClock, todayKey } from "@/features/care/health/medPlan";
import { useCheckInSettings, useTodayCheckIn } from "@/features/care/state/dailyCheckIn";
import { useLogMedicationGiven, useMedicationLogsBetween, useMedications } from "@/hooks/useCareHealth";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Task = {
  key: string;
  kind: "checkin" | "med";
  title: string;
  detail: string;
  time: string | null;
  done: boolean;
  action: string;
  medId?: string;
};

const Ring = ({ done, total }: { done: number; total: number }) => {
  const reduceMotion = useReducedMotion();
  const size = 72;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = total > 0 ? done / total : 0;
  const swept = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    swept.value = reduceMotion ? target : withTiming(target, { duration: motion.duration.flourish, easing: motion.easing.out });
  }, [reduceMotion, swept, target]);

  const props = useAnimatedProps(() => ({
    strokeDasharray: [Math.max(0.001, c * swept.value), c],
    opacity: swept.value > 0.001 ? 1 : 0,
  }));

  return (
    <View style={styles.ring} accessibilityRole="image" accessibilityLabel={`${done} of ${total} done today`}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={border.soft} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent.deep}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            animatedProps={props}
          />
        </G>
      </Svg>
      <View style={styles.ringLabel} pointerEvents="none">
        {total > 0 && done === total ? (
          <CheckIcon size={24} color={text.primary} weight="bold" />
        ) : (
          <Text style={styles.ringText}>
            {done}
            <Text style={styles.ringOf}>/{total}</Text>
          </Text>
        )}
      </View>
    </View>
  );
};

export const HealthToday = ({
  dogId,
  dogName,
  onCheckIn,
  onViewCheckIn,
  onOpenMeds,
}: {
  dogId?: string;
  dogName: string;
  onCheckIn: () => void;
  onViewCheckIn: () => void;
  onOpenMeds: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const today = todayKey();
  const settings = useCheckInSettings();
  const { entry } = useTodayCheckIn();
  const medications = useMedications(dogId);
  const logs = useMedicationLogsBetween(dogId, today, today);
  const give = useLogMedicationGiven(dogId ?? "");

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    const given = new Map((logs.data ?? []).map((log) => [log.medicationId, log]));
    for (const med of medications.data ?? []) {
      if (isFinished(med) || !dueOn(med, today)) continue;
      const log = given.get(med.id);
      const at = log ? new Date(log.createdAt) : null;
      out.push({
        key: `med-${med.id}`,
        kind: "med",
        medId: med.id,
        title: med.medicationName,
        detail: at
          ? `Given at ${prettyClock(`${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`)}`
          : [med.dosage, med.reminderTime ? prettyClock(med.reminderTime) : null].filter(Boolean).join(", ") || "Any time today",
        time: med.reminderTime,
        done: Boolean(log),
        action: "Give",
      });
    }
    if (settings.enabled) {
      out.push({
        key: "checkin",
        kind: "checkin",
        title: "Evening check-in",
        detail: entry ? verdictOf(entry, dogName).title : `Eating, energy, bathroom. ${prettyClock(settings.time)}`,
        time: settings.time,
        done: Boolean(entry),
        action: "Start",
      });
    }
    return out.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  }, [medications.data, logs.data, settings.enabled, settings.time, entry, dogName, today]);

  const done = tasks.filter((task) => task.done).length;
  const left = tasks.length - done;
  const headline =
    tasks.length === 0 ? "Nothing due today" : left === 0 ? "All done for today" : `${left} ${left === 1 ? "thing" : "things"} left today`;
  const next = tasks.find((task) => !task.done);

  const press = (task: Task) => {
    if (task.kind === "checkin") {
      if (task.done) onViewCheckIn();
      else onCheckIn();
      return;
    }
    if (task.done) {
      onOpenMeds();
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    give.mutate(task.medId as string, {
      onError: () => Alert.alert("Not saved", "That dose did not save. Check the connection and try again."),
    });
  };

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.card}>
      <View style={styles.head}>
        <Ring done={done} total={tasks.length} />
        <View style={styles.headCopy}>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.sub}>
            {tasks.length === 0
              ? "Add a medication or turn on the check-in to fill today."
              : next
                ? `Next: ${next.title}${next.time ? ` at ${prettyClock(next.time)}` : ""}`
                : `${dogName} is looked after today.`}
          </Text>
        </View>
      </View>

      {tasks.length > 0 ? (
        <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)} style={styles.list}>
          {tasks.map((task, index) => {
            const Glyph = task.kind === "checkin" ? HeartbeatIcon : PillIcon;
            return (
              <PressScale
                key={task.key}
                accessibilityRole="button"
                accessibilityLabel={`${task.title}. ${task.detail}. ${task.done ? "Done" : task.action}`}
                scaleTo={0.985}
                style={[styles.task, index > 0 && styles.ruled]}
                onPress={() => press(task)}
              >
                <View style={[styles.disc, task.done && styles.discDone]}>
                  <Glyph size={iconSize.standard} color={text.primary} weight={task.done ? "fill" : "regular"} />
                </View>
                <View style={styles.taskCopy}>
                  <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.taskDetail} numberOfLines={1}>
                    {task.detail}
                  </Text>
                </View>
                {task.done ? (
                  <Animated.View
                    entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.select).easing(motion.easing.out)}
                    style={styles.check}
                  >
                    <CheckIcon size={16} color={text.primary} weight="bold" />
                  </Animated.View>
                ) : (
                  <View style={styles.action}>
                    <Text style={styles.actionText}>{task.action}</Text>
                  </View>
                )}
              </PressScale>
            );
          })}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: space.xl,
    borderRadius: radius.card + 8,
    backgroundColor: accent.soft,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  ring: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  ringLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringText: { ...type.sectionTitle, color: text.primary, fontVariant: ["tabular-nums"] },
  ringOf: { ...type.supporting, color: text.tertiary },
  headCopy: { flex: 1 },
  headline: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary },
  sub: { ...type.supporting, color: text.secondary, marginTop: 4 },

  list: { marginTop: space.xl, borderRadius: radius.card, backgroundColor: bg.canvas, overflow: "hidden" },
  task: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  discDone: { backgroundColor: accent.primary },
  taskCopy: { flex: 1 },
  taskTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  taskTitleDone: { color: text.secondary },
  taskDetail: { ...type.caption, color: text.tertiary, marginTop: 2 },
  action: {
    minWidth: 64,
    height: 36,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { ...type.supporting, fontWeight: "700", color: text.inverse },
  check: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
});
