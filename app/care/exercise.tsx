import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import {
  BarbellIcon,
  DropIcon,
  PersonSimpleRunIcon,
  PersonSimpleWalkIcon,
  PlusIcon,
  SoccerBallIcon,
} from "phosphor-react-native";

import { DetailEmpty, DetailShell } from "@/features/care/components/DetailShell";
import { ChipRow, DetailSheet, Field } from "@/features/care/components/DetailSheet";
import { Band, PanelHead, Spotlight } from "@/components/ui/panels";
import { PressScale } from "@/components/ui/PressScale";
import { ACTIVITY_TYPES } from "@/constants/careHealth";
import { useCareProfile, useLogExercise, useTodayExerciseLogs } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  accent,
  bg,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

type PhosphorIcon = typeof PersonSimpleWalkIcon;

const GLYPH: Record<string, PhosphorIcon> = {
  walk: PersonSimpleWalkIcon,
  run: PersonSimpleRunIcon,
  play: SoccerBallIcon,
  swim: DropIcon,
  training: BarbellIcon,
};

const labelOf = (key: string) =>
  ACTIVITY_TYPES.find((item) => item.key === key)?.label ?? key;

export default function ExerciseScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const profile = useCareProfile(dogId);
  const logs = useTodayExerciseLogs(dogId);
  const logExercise = useLogExercise(dogId);

  const [open, setOpen] = useState(false);
  const [activityType, setActivityType] = useState("walk");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");

  const chosenGoal = profile.data?.dailyExerciseGoalMinutes ?? null;
  const goal = chosenGoal ?? 60;

  const today = useMemo(() => logs.data ?? [], [logs.data]);
  const minutes = today.reduce((total, entry) => total + entry.durationMinutes, 0);
  const left = Math.max(0, goal - minutes);
  const met = minutes >= goal;

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

  const commit = () => {
    const mins = Number.parseInt(duration, 10);
    if (!Number.isFinite(mins) || mins <= 0) return;
    logExercise.mutate(
      {
        activityType,
        durationMinutes: mins,
        distanceMiles: distance ? Number.parseFloat(distance) : null,
        walkCount: activityType === "walk" ? 1 : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setDuration("");
          setDistance("");
          setNotes("");
        },
      },
    );
  };

  return (
    <DetailShell
      title="Exercise"
      glyph={<PersonSimpleWalkIcon size={iconSize.standard} color={accent.deep} weight="fill" />}
      action={{
        label: "Log an activity",
        icon: <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: () => setOpen(true),
      }}
    >
      <Spotlight
        data={{
          chip: met ? "Goal met" : "Today",
          glyph: met ? "confetti" : "walk",
          title: met ? `${minutes} minutes` : `${left} minutes to go`,
          meta: met
            ? `${dog.data?.name ?? "Your dog"} is past the ${goal} minute goal for today.`
            : today.length === 0
              ? `Nothing logged yet. The goal is ${goal} minutes.`
              : `${minutes} of ${goal} minutes so far, across ${today.length} ${today.length === 1 ? "session" : "sessions"}.`,
          progress: Math.min(1, minutes / goal),
          progressNote: `${minutes} of ${goal} minutes`,
        }}
        onPress={() => setOpen(true)}
      />

      <Band
        figures={[
          { key: "mins", glyph: "walk", value: String(minutes), label: "Minutes" },
          {
            key: "sessions",
            glyph: "calendar",
            value: String(today.length),
            label: today.length === 1 ? "Session" : "Sessions",
          },
          { key: "goal", glyph: "target", value: String(goal), label: "Goal" },
        ]}
      />

      {chosenGoal === null ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Set a goal for this breed in care setup"
          scaleTo={0.98}
          style={styles.goalNote}
          onPress={() => router.push("/care/setup")}
        >
          <Text style={styles.goalNoteText}>
            <Text style={styles.goalNoteStrong}>60 minutes is a general default.</Text> Set up care
            and PAWS will pick a goal from {dog.data?.name ?? "your dog"}&rsquo;s breed.
          </Text>
        </PressScale>
      ) : null}

      <PanelHead title="Today" />

      {today.length === 0 ? (
        <DetailEmpty
          glyph={<PersonSimpleWalkIcon size={32} color={text.primary} weight="regular" />}
          title="Nothing logged yet"
          body="A walk, a run, a swim, a training session. Log it and it counts toward today."
        />
      ) : (
        <Animated.View layout={settle} style={styles.stack}>
          {today.map((entry, index) => {
            const Glyph = GLYPH[entry.activityType] ?? PersonSimpleWalkIcon;
            return (
              <Animated.View
                key={entry.id}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeIn.duration(motion.duration.enter).delay(index * 40)
                }
                style={styles.card}
              >
                <View style={styles.disc}>
                  <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                </View>

                <View style={styles.copy}>
                  <Text style={styles.name}>{labelOf(entry.activityType)}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[
                      entry.distanceMiles ? `${entry.distanceMiles} mi` : null,
                      entry.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Logged today"}
                  </Text>
                </View>

                <View style={styles.durationWrap}>
                  <Text style={styles.duration}>{entry.durationMinutes}</Text>
                  <Text style={styles.durationUnit}>min</Text>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}

      <DetailSheet
        open={open}
        title="Log an activity"
        saveLabel="Save activity"
        saving={logExercise.isPending}
        canSave={Number.parseInt(duration, 10) > 0}
        onClose={() => setOpen(false)}
        onSave={commit}
      >
        <ChipRow
          label="What did you do"
          options={ACTIVITY_TYPES.map((item) => ({ key: item.key, label: item.label }))}
          value={activityType}
          onChange={setActivityType}
        />
        <Field
          label="How long"
          value={duration}
          onChangeText={setDuration}
          placeholder="Minutes"
          keyboardType="number-pad"
        />
        <Field
          label="How far"
          value={distance}
          onChangeText={setDistance}
          placeholder="Miles (optional)"
          keyboardType="decimal-pad"
        />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Where you went, how it went…"
          multiline
        />
      </DetailSheet>
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  goalNote: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.soft,
  },
  goalNoteText: { ...type.caption, color: text.secondary, lineHeight: 18 },
  goalNoteStrong: { color: text.primary, fontWeight: "600" },

  stack: { gap: space.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  name: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  meta: { ...type.caption, color: text.tertiary, marginTop: 3 },

  durationWrap: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  duration: {
    ...type.sectionTitle,
    fontWeight: "600",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  durationUnit: { ...type.caption, color: text.tertiary, paddingBottom: 3 },
});
