import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useEffect } from "react";
import * as Haptics from "expo-haptics";
import {
  BathtubIcon,
  BugIcon,
  EarIcon,
  PawPrintIcon,
  ScissorsIcon,
  ShowerIcon,
  ToothIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { DetailSheet, Field } from "@/features/care/components/DetailSheet";
import { Band, PanelHead, Spotlight } from "@/components/ui/panels";
import { PressScale } from "@/components/ui/PressScale";
import { GROOMING_TYPES, daysUntilGrooming } from "@/constants/careHealth";
import { useGroomingLogs, useLogGrooming } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import type { GroomingLog } from "@/services/careHealthService";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type PhosphorIcon = typeof ScissorsIcon;

const GLYPH: Record<string, PhosphorIcon> = {
  bath: BathtubIcon,
  nail_trim: ScissorsIcon,
  ear_clean: EarIcon,
  teeth_brush: ToothIcon,
  haircut: ShowerIcon,
  flea_tick: BugIcon,
};

const today = () => new Date().toISOString().slice(0, 10);

type Job = {
  key: string;
  label: string;
  description: string;
  intervalDays: number;
  last?: GroomingLog;
  days: number | null;
  doneToday: boolean;
  elapsed: number;
};

export default function GroomingScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const logs = useGroomingLogs(dogId);
  const logGroom = useLogGrooming(dogId);

  const [noteFor, setNoteFor] = useState<Job | null>(null);
  const [note, setNote] = useState("");

  const jobs = useMemo<Job[]>(() => {
    const latest = new Map<string, GroomingLog>();
    for (const log of logs.data ?? []) {
      if (!latest.has(log.groomingType)) latest.set(log.groomingType, log);
    }

    return GROOMING_TYPES.map((groom) => {
      const last = latest.get(groom.key);
      const days = last ? daysUntilGrooming(last.doneDate, groom.intervalDays) : null;
      const elapsed =
        days === null
          ? 0
          : Math.min(1, Math.max(0, (groom.intervalDays - days) / groom.intervalDays));
      return {
        key: groom.key,
        label: groom.label,
        description: groom.description,
        intervalDays: groom.intervalDays,
        last,
        days,
        doneToday: last?.doneDate === today(),
        elapsed,
      };
    });
  }, [logs.data]);

  const overdue = jobs.filter((job) => job.days !== null && job.days < 0);
  const never = jobs.filter((job) => job.days === null);
  const doneToday = jobs.filter((job) => job.doneToday);

  const worst = [...jobs].sort((a, b) => (a.days ?? -9999) - (b.days ?? -9999))[0];

  const log = (job: Job, withNote: string | null) => {
    const next = new Date();
    next.setDate(next.getDate() + job.intervalDays);
    logGroom.mutate({
      groomingType: job.key,
      doneDate: today(),
      nextDueDate: next.toISOString().slice(0, 10),
      notes: withNote,
    });
  };

  const spotlight = worst
    ? {
        chip:
          worst.days === null
            ? "Never logged"
            : worst.days < 0
              ? `${Math.abs(worst.days)} days over`
              : worst.days === 0
                ? "Due today"
                : `In ${worst.days} days`,
        glyph: "scissors",
        title: worst.days !== null && worst.days > 0 ? "Nothing overdue" : worst.label,
        meta:
          worst.days !== null && worst.days > 0
            ? `${worst.label} is next, in ${worst.days} days.`
            : worst.description,
      }
    : null;

  return (
    <DetailShell
      title="Grooming"
      glyph={<ScissorsIcon size={iconSize.standard} color={accent.deep} weight="fill" />}
    >
      {spotlight ? <Spotlight data={spotlight} onPress={() => worst && log(worst, null)} /> : null}

      <Band
        figures={[
          { key: "overdue", glyph: "scissors", value: String(overdue.length), label: "Overdue" },
          { key: "never", glyph: "folder", value: String(never.length), label: "Never logged" },
          { key: "today", glyph: "heart", value: String(doneToday.length), label: "Done today" },
        ]}
      />

      <PanelHead title="Every few weeks" />
      <Text style={styles.hint}>Tap to log one done today. Hold to add a note with it.</Text>

      <View style={styles.grid}>
        {jobs.map((job, index) => (
          <JobCard
            key={job.key}
            job={job}
            order={index}
            busy={logGroom.isPending}
            onLog={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              log(job, null);
            }}
            onNote={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setNote("");
              setNoteFor(job);
            }}
          />
        ))}
      </View>

      <DetailSheet
        open={noteFor !== null}
        title={noteFor ? `Log ${noteFor.label.toLowerCase()}` : ""}
        saveLabel="Log it for today"
        saving={logGroom.isPending}
        onClose={() => setNoteFor(null)}
        onSave={() => {
          if (!noteFor) return;
          log(noteFor, note.trim() || null);
          setNoteFor(null);
        }}
      >
        <Text style={styles.sheetNote}>{noteFor?.description}</Text>
        <Field
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Groomer, product used, anything you noticed…"
          multiline
        />
      </DetailSheet>
    </DetailShell>
  );
}

const SIZE = 56;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

const JobCard = ({
  job,
  order,
  busy,
  onLog,
  onNote,
}: {
  job: Job;
  order: number;
  busy: boolean;
  onLog: () => void;
  onNote: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const Glyph = GLYPH[job.key] ?? PawPrintIcon;
  const due = job.days !== null && job.days <= 0;

  const swept = useSharedValue(reduceMotion ? job.elapsed : 0);
  useEffect(() => {
    swept.value = reduceMotion
      ? job.elapsed
      : withDelay(
          motion.duration.enter + order * 40,
          withSpring(job.elapsed, motion.spring),
        );
  }, [job.elapsed, order, reduceMotion, swept]);

  const arc = useAnimatedProps(() => {
    const length = C * Math.max(0, swept.value);
    return { strokeDasharray: [length, C], opacity: length < 1 ? 0 : 1 };
  });

  const status = job.doneToday
    ? "Done today"
    : job.days === null
      ? "Never logged"
      : job.days < 0
        ? `${Math.abs(job.days)} days over`
        : job.days === 0
          ? "Due today"
          : `In ${job.days} days`;

  return (
    <Animated.View
      entering={
        reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 40)
      }
      style={styles.slot}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${job.label}. ${status}. Tap to log it done today, hold to add a note.`}
        scaleTo={0.96}
        disabled={busy}
        style={[styles.card, job.doneToday && styles.cardDone]}
        onPress={onLog}
        onLongPress={onNote}
      >
        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={bg.canvas}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={due && !job.doneToday ? accent.deep : border.default}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              animatedProps={arc}
            />
          </Svg>
          <View style={styles.ringGlyph} pointerEvents="none">
            <Glyph size={iconSize.feature} color={text.primary} weight="regular" />
          </View>
        </View>

        <Text style={styles.label} numberOfLines={1}>
          {job.label}
        </Text>
        <Text
          style={[
            styles.status,
            (due || job.days === null) && !job.doneToday && styles.statusDue,
          ]}
          numberOfLines={1}
        >
          {status}
        </Text>
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  hint: { ...type.caption, color: text.tertiary, marginTop: -space.sm, marginBottom: space.lg },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  slot: { width: "48%", flexGrow: 1 },
  card: {
    alignItems: "center",
    paddingVertical: space.xl,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  cardDone: { backgroundColor: accent.soft },

  ringWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  ringGlyph: { position: "absolute" },

  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.md },
  status: { ...type.caption, color: text.tertiary, marginTop: 2 },
  statusDue: { color: text.primary, fontWeight: "600" },

  sheetNote: { ...type.supporting, color: text.tertiary, marginTop: space.md },
});
