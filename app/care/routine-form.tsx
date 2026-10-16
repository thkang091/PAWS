import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CheckIcon, ListChecksIcon } from "phosphor-react-native";

import { DetailShell, goBack } from "@/features/care/components/DetailShell";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { routineGlyph } from "@/features/care/components/routineIcon";
import { enter } from "@/features/care/food/enter";
import { extendCarePlan, useCareOnboarding } from "@/features/care/state/careOnboarding";
import { enableDailyCheckIn, setCheckInTime, useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { PressScale } from "@/components/ui/PressScale";
import { Ruler } from "@/components/ui/Ruler";
import { useAddCareRoutine, useCareRoutines } from "@/hooks/useCareEvents";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

type System = "walk" | "meal" | "checkin" | "meds";
type Kind = { key: string; label: string; iconKey: string; time: string | null; system?: System };

/**
 * What can go in the day. The first four are not loose routines: a walk or a meal becomes a time in the dog's plan
 * (so it is a real walk or meal everywhere, with reminders and walk tracking), the check-in moves the evening
 * check-in, and medicine opens the medication plan where doses live.
 */
const KINDS: readonly Kind[] = [
  { key: "walk", label: "Walk", iconKey: "walk", time: "17:00", system: "walk" },
  { key: "meal", label: "Meal", iconKey: "bowl-mix", time: "12:00", system: "meal" },
  { key: "checkin", label: "Check-in", iconKey: "heartbeat", time: "20:30", system: "checkin" },
  { key: "meds", label: "Medicine", iconKey: "pill", time: null, system: "meds" },
  { key: "teeth", label: "Teeth", iconKey: "tooth", time: "20:30" },
  { key: "water", label: "Water", iconKey: "water", time: "08:00" },
  { key: "play", label: "Play", iconKey: "ball", time: "17:00" },
  { key: "training", label: "Training", iconKey: "star", time: "18:00" },
  { key: "puzzle", label: "Puzzle", iconKey: "brain", time: "14:00" },
  { key: "coat", label: "Brush coat", iconKey: "scissors", time: "19:00" },
  { key: "ears", label: "Ears", iconKey: "ear", time: null },
  { key: "other", label: "Other", iconKey: "paw", time: "08:00" },
];

const TITLE: Record<string, string> = {
  teeth: "Brush teeth",
  water: "Fresh water",
  play: "Play time",
  training: "Training practice",
  puzzle: "Puzzle toy",
  coat: "Brush coat",
  ears: "Ear check",
};

// The time ruler runs from 5 am to 11 pm in quarter hours.
const FIRST = 5 * 60;
const STEP = 15;
const COUNT = (23 * 60 - FIRST) / STEP + 1;
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const indexOf = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return Math.max(0, Math.min(COUNT - 1, Math.round((h * 60 + m - FIRST) / STEP)));
};
const sorted = (times: readonly string[]) => [...new Set(times)].sort();

/** Add something to the dog's day: pick what it is, then when. */
export default function RoutineFormScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const add = useAddCareRoutine(dogId);
  const routines = useCareRoutines(dogId);
  const { choice } = useCareOnboarding();
  const checkIn = useCheckInSettings();

  const [kind, setKind] = useState<Kind | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [grid, setGrid] = useState(0);

  const pick = (k: Kind) => {
    void Haptics.selectionAsync();
    setKind(k);
    setTime(k.system === "checkin" ? checkIn.time : k.time);
  };

  // A walk or meal at a time that is already planned would only duplicate it.
  const taken =
    kind?.system === "walk" && time ? (choice?.walkTimes ?? []).includes(time) : kind?.system === "meal" && time ? (choice?.mealTimes ?? []).includes(time) : false;
  const ready = Boolean(kind) && !taken && (kind?.key !== "other" || title.trim().length > 0) && Boolean(dog.data);

  const ensureRoutine = (iconKey: string, name: string) => {
    if ((routines.data ?? []).some((r) => r.iconKey === iconKey)) return Promise.resolve();
    return add.mutateAsync({ title: name, description: "", iconKey, reminderTime: null }).then(() => undefined);
  };

  const done = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goBack("/care/schedule");
  };

  const save = async () => {
    if (!kind || !ready) return;
    if (kind.system === "meds") return router.replace("/care/medications" as never);
    if (kind.system === "checkin" && time) {
      if (checkIn.enabled) setCheckInTime(time);
      else enableDailyCheckIn(time);
      return done();
    }
    if ((kind.system === "walk" || kind.system === "meal") && time && choice) {
      // The plan holds each time; one routine of that kind is what lists them in the day.
      if (kind.system === "walk") {
        await ensureRoutine("walk", "Walk");
        extendCarePlan("walks", { walkTimes: sorted([...(choice.walkTimes ?? []), time]) });
      } else {
        await ensureRoutine("bowl-mix", "Meal");
        extendCarePlan("meals", { mealTimes: sorted([...(choice.mealTimes ?? []), time]), mealsPerDay: (choice.mealTimes?.length ?? 0) + 1 });
      }
      return done();
    }
    const name = kind.key === "other" ? title.trim() : (TITLE[kind.key] ?? kind.label);
    add.mutate({ title: name, description: "", iconKey: kind.iconKey, reminderTime: time }, { onSuccess: done });
  };

  const label = !kind
    ? "Pick one"
    : kind.system === "meds"
      ? "Open medicines"
      : kind.system === "checkin"
        ? "Move check-in"
        : taken
          ? "Already planned"
          : add.isPending
            ? "Adding"
            : `Add ${kind.system === "walk" ? "walk" : kind.system === "meal" ? "meal" : ""}`.trim();

  const size = grid ? (grid - space.sm * 3) / 4 : 76;

  return (
    <DetailShell
      title="Add to the day"
      glyph={<ListChecksIcon size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/care/schedule"
      action={{
        label,
        icon: <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: () => void save(),
        disabled: !ready || add.isPending,
      }}
    >
      <View style={styles.grid} onLayout={(e) => setGrid(e.nativeEvent.layout.width)}>
        {KINDS.map((k, i) => (
          <KindTile key={k.key} kind={k} size={size} order={i} on={kind?.key === k.key} reduceMotion={reduceMotion} onPress={() => pick(k)} />
        ))}
      </View>

      {kind?.key === "other" ? (
        <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={`What does ${dog.data?.name ?? "your dog"} need?`}
            placeholderTextColor={text.tertiary}
            returnKeyType="done"
            maxLength={48}
            autoFocus
            accessibilityLabel="Name"
          />
        </Animated.View>
      ) : null}

      {kind && kind.system !== "meds" ? (
        <Animated.View key={kind.key} entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.when}>
          {kind.system ? null : (
            <View style={styles.anytime}>
              <Chip label="Set a time" selected={time != null} onPress={() => setTime((t) => t ?? kind.time ?? "08:00")} />
              <Chip label="Any time" selected={time == null} onPress={() => setTime(null)} />
            </View>
          )}
          {time ? (
            <View style={styles.clock}>
              <Text style={[styles.clockValue, taken && styles.clockTaken]}>{prettyTime(time)}</Text>
              <Ruler
                count={COUNT}
                index={indexOf(time)}
                step={14}
                majorEvery={4}
                label={(i) => {
                  const minutes = FIRST + i * STEP;
                  return minutes % 120 === 0 ? prettyTime(toClock(minutes)).replace(":00", "") : null;
                }}
                onChange={(i) => setTime(toClock(FIRST + i * STEP))}
                accessibilityLabel="Time"
                valueText={prettyTime(time)}
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </DetailShell>
  );
}

const KindTile = ({ kind, size, order, on, reduceMotion, onPress }: { kind: Kind; size: number; order: number; on: boolean; reduceMotion: boolean; onPress: () => void }) => {
  const Glyph = routineGlyph(kind.iconKey);
  const lit = useDerivedValue(() => withTiming(on ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }), [on]);
  const fill = useAnimatedStyle(() => ({ opacity: lit.value }));
  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { delay: order * 25, duration: motion.duration.enter })}>
      <PressScale
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={kind.label}
        scaleTo={0.94}
        style={[styles.tile, { width: size, height: size }]}
        onPress={onPress}
      >
        <Animated.View style={[styles.tileOn, fill]} pointerEvents="none" />
        <Glyph size={24} color={text.primary} weight={on ? "fill" : "regular"} />
        <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
          {kind.label}
        </Text>
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  tile: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center", gap: 6, overflow: "hidden" },
  tileOn: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: accent.primary },
  tileLabel: { ...type.caption, fontWeight: "600", color: text.secondary },
  tileLabelOn: { color: text.primary },

  input: { height: 52, marginTop: space.xl, paddingHorizontal: space.lg, borderRadius: radius.control + 2, backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary },
  when: { marginTop: space.xl },
  anytime: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  clock: { paddingTop: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  clockValue: { fontSize: 34, lineHeight: 38, letterSpacing: -1, fontWeight: "700", color: text.primary, textAlign: "center", fontVariant: ["tabular-nums"] },
  clockTaken: { color: text.tertiary },
});
