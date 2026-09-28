import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowCounterClockwiseIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  PencilSimpleIcon,
  PillIcon,
  PlusIcon,
  ProhibitIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { FieldLabel, FlowSheet } from "@/features/care/components/FlowSheet";
import { MonthPicker } from "@/features/care/components/MonthPicker";
import {
  FREQUENCIES,
  addDays,
  cadence,
  courseNote,
  dueOn,
  isFinished,
  nextDue,
  ordinalDay,
  prettyClock,
  relativeDay,
  shortDay,
  todayKey,
  upcomingDoses,
  weekdayOf,
  type Frequency,
} from "@/features/care/health/medPlan";
import { PressScale } from "@/components/ui/PressScale";
import {
  useDeleteMedication,
  useDeleteMedicationLog,
  useLogMedicationGiven,
  useMedicationLogsBetween,
  useMedications,
  useSaveMedication,
  useUpdateMedication,
} from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import type { Medication, MedicationLog } from "@/services/careHealthService";
import { requestNotificationPermissions, syncMedicationReminders } from "@/services/notificationService";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const UNDO_MS = 4000;
const HISTORY_DAYS = 14;

const PRESETS = [
  { key: "nexgard", name: "NexGard", purpose: "Flea and tick", frequency: "monthly", dose: "1 chew", days: null },
  { key: "heartgard", name: "Heartgard", purpose: "Heartworm", frequency: "monthly", dose: "1 chew", days: null },
  { key: "simparica", name: "Simparica", purpose: "Flea and tick", frequency: "monthly", dose: "1 chew", days: null },
  { key: "apoquel", name: "Apoquel", purpose: "Itching and allergy", frequency: "daily", dose: "1 tablet", days: null },
  { key: "carprofen", name: "Carprofen", purpose: "Pain and joints", frequency: "daily", dose: "1 tablet", days: 14 },
  { key: "antibiotic", name: "Antibiotic", purpose: "A short course", frequency: "daily", dose: "1 tablet", days: 10 },
] as const;

const DOSES = ["1 tablet", "½ tablet", "2 tablets", "1 chew", "1 ml", "Drops"];
const TIMES = ["07:00", "08:00", "12:00", "18:00", "20:00", "21:00"];
const COURSES: readonly { label: string; days: number | null }[] = [
  { label: "Ongoing", days: null },
  { label: "5 days", days: 5 },
  { label: "7 days", days: 7 },
  { label: "10 days", days: 10 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

type Draft = {
  id: string | null;
  name: string;
  dose: string;
  frequency: Frequency;
  time: string | null;
  start: string;
  days: number | null;
  remind: boolean;
  notes: string;
};

const blankDraft = (): Draft => ({
  id: null,
  name: "",
  dose: "",
  frequency: "daily",
  time: "08:00",
  start: todayKey(),
  days: null,
  remind: true,
  notes: "",
});

const draftFrom = (med: Medication): Draft => {
  const days = med.endDate
    ? Math.round((new Date(`${med.endDate}T00:00:00`).getTime() - new Date(`${med.startDate}T00:00:00`).getTime()) / 86_400_000) + 1
    : null;
  return {
    id: med.id,
    name: med.medicationName,
    dose: med.dosage ?? "",
    frequency: (FREQUENCIES.some((f) => f.key === med.frequency) ? med.frequency : "daily") as Frequency,
    time: med.reminderTime,
    start: med.startDate,
    days,
    remind: Boolean(med.reminderTime),
    notes: med.notes ?? "",
  };
};

const planOf = (draft: Draft) => ({
  frequency: draft.frequency,
  startDate: draft.start,
  endDate: draft.days ? addDays(draft.start, draft.days - 1) : null,
  reminderTime: draft.frequency === "as_needed" ? null : draft.time,
});

const givenAt = (log: MedicationLog) => {
  const d = new Date(log.createdAt);
  return prettyClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
};

export default function MedicationsScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const dogName = dog.data?.name ?? "your dog";
  const today = todayKey();
  const from = addDays(today, -(HISTORY_DAYS - 1));

  const medications = useMedications(dogId);
  const logs = useMedicationLogsBetween(dogId, from, today);
  const logGiven = useLogMedicationGiven(dogId);
  const deleteLog = useDeleteMedicationLog(dogId);
  const saveMed = useSaveMedication(dogId);
  const updateMed = useUpdateMedication(dogId);
  const stopMed = useDeleteMedication(dogId);

  const meds = useMemo(() => medications.data ?? [], [medications.data]);
  const history = useMemo(() => logs.data ?? [], [logs.data]);

  const todaysLog = useMemo(() => {
    const map = new Map<string, MedicationLog>();
    for (const log of history) if (log.givenDate === today && !map.has(log.medicationId)) map.set(log.medicationId, log);
    return map;
  }, [history, today]);

  const [pending, setPending] = useState<Record<string, { committed: boolean }>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const commitRef = useRef<(id: string) => void>(() => undefined);

  commitRef.current = (id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setPending((current) => (current[id] ? { ...current, [id]: { committed: true } } : current));
    logGiven.mutate(id, {
      onError: () => {
        setPending((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        Alert.alert("Not saved", "That dose did not save. Check the connection and try again.");
      },
    });
  };

  useEffect(() => {
    setPending((current) => {
      const stale = Object.keys(current).filter((id) => current[id].committed && todaysLog.has(id));
      if (stale.length === 0) return current;
      const next = { ...current };
      for (const id of stale) delete next[id];
      return next;
    });
  }, [todaysLog]);

  useEffect(
    () => () => {
      for (const id of Object.keys(timers.current)) commitRef.current(id);
    },
    [],
  );

  const give = (id: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPending((current) => ({ ...current, [id]: { committed: false } }));
    timers.current[id] = setTimeout(() => commitRef.current(id), UNDO_MS);
  };

  const undoPending = (id: string) => {
    void Haptics.selectionAsync();
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setPending((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const undoSaved = (log: MedicationLog, name: string) => {
    Alert.alert("Undo this dose?", `${name} will show as not given today.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLog.mutate(log.id, {
            onSuccess: (removed) => {
              if (!removed) Alert.alert("Could not undo", "This dose is already saved and cannot be removed yet.");
            },
            onError: () => Alert.alert("Could not undo", "Check the connection and try again."),
          }),
      },
    ]);
  };

  useEffect(() => {
    const reminders = meds
      .filter((med) => med.reminderTime && med.frequency !== "as_needed" && !isFinished(med))
      .map((med) => ({
        id: med.id,
        name: med.medicationName,
        dose: med.dosage,
        frequency: med.frequency,
        startDate: med.startDate,
        time: med.reminderTime as string,
      }));
    void syncMedicationReminders(reminders, dogName).catch(() => undefined);
  }, [meds, dogName]);

  const active = meds.filter((med) => !isFinished(med));
  const finished = meds.filter((med) => isFinished(med));
  const dueToday = active
    .filter((med) => dueOn(med, today))
    .sort((a, b) => (a.reminderTime ?? "99").localeCompare(b.reminderTime ?? "99"));
  const asNeeded = active.filter((med) => med.frequency === "as_needed");
  const later = active
    .filter((med) => med.frequency !== "as_needed" && !dueOn(med, today))
    .map((med) => ({ med, next: nextDue(med, addDays(today, 1)) }))
    .filter((item): item is { med: Medication; next: string } => Boolean(item.next))
    .sort((a, b) => a.next.localeCompare(b.next));

  const isGiven = (id: string) => todaysLog.has(id) || Boolean(pending[id]);
  const left = dueToday.filter((med) => !isGiven(med.id)).length;

  const headline =
    meds.length === 0
      ? `Nothing on ${dogName}'s list`
      : dueToday.length === 0
        ? "Nothing due today"
        : left === 0
          ? "All given today"
          : `${left} ${left === 1 ? "dose" : "doses"} left today`;

  const subline =
    meds.length === 0
      ? "Add a medication once and PAWS keeps the schedule, the reminders and the record."
      : left > 0
        ? `Next: ${dueToday.find((med) => !isGiven(med.id))?.medicationName}${
            dueToday.find((med) => !isGiven(med.id))?.reminderTime
              ? ` at ${prettyClock(dueToday.find((med) => !isGiven(med.id))!.reminderTime!)}`
              : ""
          }`
        : later[0]
          ? `Next: ${later[0].med.medicationName}, ${relativeDay(later[0].next)}`
          : "Everything is up to date.";

  const [flowOpen, setFlowOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [detail, setDetail] = useState<Medication | null>(null);

  const openAdd = () => {
    setDraft(blankDraft());
    setFlowOpen(true);
  };

  const openEdit = (med: Medication) => {
    setDetail(null);
    setDraft(draftFrom(med));
    setTimeout(() => setFlowOpen(true), 380);
  };

  const saveDraft = async () => {
    const plan = planOf(draft);
    if (draft.remind && plan.reminderTime) await requestNotificationPermissions().catch(() => false);
    const reminderTime = draft.remind ? plan.reminderTime : null;
    const done = () => setFlowOpen(false);
    const failed = () => Alert.alert("Not saved", "Check the connection and try again.");
    if (draft.id) {
      updateMed.mutate(
        {
          id: draft.id,
          patch: {
            medicationName: draft.name.trim(),
            dosage: draft.dose.trim() || null,
            frequency: plan.frequency,
            startDate: plan.startDate,
            endDate: plan.endDate,
            reminderTime,
            notes: draft.notes.trim() || null,
          },
        },
        { onSuccess: done, onError: failed },
      );
    } else {
      saveMed.mutate(
        {
          medicationName: draft.name.trim(),
          dosage: draft.dose.trim() || null,
          frequency: plan.frequency,
          startDate: plan.startDate,
          endDate: plan.endDate,
          reminderTime,
          notes: draft.notes.trim() || null,
        },
        { onSuccess: done, onError: failed },
      );
    }
  };

  const stop = (med: Medication) => {
    Alert.alert(`Stop ${med.medicationName}?`, "It leaves today's list and the reminders stop. Past doses stay in the record.", [
      { text: "Keep giving", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          setDetail(null);
          stopMed.mutate(med.id);
        },
      },
    ]);
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const enter = (order: number) =>
    reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  return (
    <DetailShell
      title="Medication"
      glyph={<PillIcon size={iconSize.standard} color={text.primary} weight="regular" />}
      action={{
        label: "Add a medication",
        icon: <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: openAdd,
      }}
    >
      <Animated.View entering={enter(0)}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>
      </Animated.View>

      {active.length > 0 ? (
        <Animated.View entering={enter(1)}>
          <WeekStrip meds={active} logs={history} pendingToday={Object.keys(pending)} />
        </Animated.View>
      ) : null}

      {dueToday.length > 0 ? (
        <Animated.View entering={enter(2)} layout={settle}>
          <Text style={styles.section}>Today</Text>
          <View style={styles.list}>
            {dueToday.map((med, index) => (
              <DoseRow
                key={med.id}
                med={med}
                ruled={index > 0}
                log={todaysLog.get(med.id) ?? null}
                pending={pending[med.id] ?? null}
                onGive={() => give(med.id)}
                onUndoPending={() => undoPending(med.id)}
                onUndoSaved={(log) => undoSaved(log, med.medicationName)}
                onOpen={() => setDetail(med)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {asNeeded.length > 0 ? (
        <Animated.View entering={enter(3)} layout={settle}>
          <Text style={styles.section}>When needed</Text>
          <View style={styles.list}>
            {asNeeded.map((med, index) => (
              <DoseRow
                key={med.id}
                med={med}
                ruled={index > 0}
                log={todaysLog.get(med.id) ?? null}
                pending={pending[med.id] ?? null}
                giveLabel="Log"
                onGive={() => give(med.id)}
                onUndoPending={() => undoPending(med.id)}
                onUndoSaved={(log) => undoSaved(log, med.medicationName)}
                onOpen={() => setDetail(med)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {later.length > 0 ? (
        <Animated.View entering={enter(4)} layout={settle}>
          <Text style={styles.section}>Coming up</Text>
          <View style={styles.list}>
            {later.map(({ med, next }, index) => (
              <PressScale
                key={med.id}
                accessibilityRole="button"
                accessibilityLabel={`${med.medicationName}, next ${shortDay(next)}`}
                scaleTo={0.985}
                style={[styles.row, index > 0 && styles.ruled]}
                onPress={() => setDetail(med)}
              >
                <View style={styles.dateTile}>
                  <Text style={styles.dateDay}>{new Date(`${next}T00:00:00`).getDate()}</Text>
                  <Text style={styles.dateMonth}>{shortDay(next).split(" ")[2]}</Text>
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {med.medicationName}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[med.dosage, cadence(med)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={styles.when}>{relativeDay(next)}</Text>
              </PressScale>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {finished.length > 0 ? (
        <Animated.View entering={enter(5)} layout={settle}>
          <Text style={styles.section}>Finished courses</Text>
          <View style={styles.list}>
            {finished.map((med, index) => (
              <View key={med.id} style={[styles.row, index > 0 && styles.ruled]}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, styles.muted]}>{med.medicationName}</Text>
                  <Text style={styles.rowMeta}>{courseNote(med)}</Text>
                </View>
                <PressScale accessibilityRole="button" accessibilityLabel={`Clear ${med.medicationName}`} scaleTo={0.95} style={styles.ghost} onPress={() => stopMed.mutate(med.id)}>
                  <Text style={styles.ghostText}>Clear</Text>
                </PressScale>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {meds.length === 0 && !medications.isLoading ? (
        <Animated.View entering={enter(2)} style={styles.empty}>
          {PRESETS.slice(0, 4).map((preset) => (
            <PressScale
              key={preset.key}
              accessibilityRole="button"
              accessibilityLabel={`Add ${preset.name}`}
              scaleTo={0.97}
              style={styles.quickAdd}
              onPress={() => {
                setDraft({ ...blankDraft(), name: preset.name, dose: preset.dose, frequency: preset.frequency, days: preset.days });
                setFlowOpen(true);
              }}
            >
              <PlusIcon size={14} color={text.primary} weight="bold" />
              <Text style={styles.quickAddText}>{preset.name}</Text>
            </PressScale>
          ))}
        </Animated.View>
      ) : null}

      <MedFlow
        open={flowOpen}
        draft={draft}
        dogName={dogName}
        busy={saveMed.isPending || updateMed.isPending}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onClose={() => setFlowOpen(false)}
        onSave={() => void saveDraft()}
      />

      <MedDetail
        med={detail}
        logs={history}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
        onStop={stop}
      />
    </DetailShell>
  );
}

const WeekStrip = ({
  meds,
  logs,
  pendingToday,
}: {
  meds: readonly Medication[];
  logs: readonly MedicationLog[];
  pendingToday: readonly string[];
}) => {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <View style={styles.week} accessibilityLabel="The last seven days">
      {days.map((day) => {
        const due = meds.filter((med) => dueOn(med, day));
        const given = due.filter(
          (med) =>
            logs.some((log) => log.medicationId === med.id && log.givenDate === day) ||
            (day === today && pendingToday.includes(med.id)),
        ).length;
        const state =
          due.length === 0 ? "none" : given === due.length ? "done" : day === today ? "open" : given > 0 ? "partial" : "missed";
        return (
          <View key={day} style={styles.weekDay}>
            <Text style={[styles.weekLabel, day === today && styles.weekLabelToday]}>
              {day === today ? "Today" : shortDay(day).split(" ")[0]}
            </Text>
            <View
              style={[
                styles.weekDot,
                state === "done" && styles.dotDone,
                state === "partial" && styles.dotPartial,
                state === "missed" && styles.dotMissed,
                state === "open" && styles.dotOpen,
              ]}
            >
              {state === "done" ? <CheckIcon size={12} color={text.primary} weight="bold" /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const DoseRow = ({
  med,
  ruled,
  log,
  pending,
  giveLabel = "Give",
  onGive,
  onUndoPending,
  onUndoSaved,
  onOpen,
}: {
  med: Medication;
  ruled: boolean;
  log: MedicationLog | null;
  pending: { committed: boolean } | null;
  giveLabel?: string;
  onGive: () => void;
  onUndoPending: () => void;
  onUndoSaved: (log: MedicationLog) => void;
  onOpen: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const given = Boolean(log) || Boolean(pending);
  const undoable = pending && !pending.committed;

  const pop = useSharedValue(given ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (given ? 1 : 0) : withSpring(given ? 1 : 0, { duration: 360, dampingRatio: 0.65 });
  }, [given, pop, reduceMotion]);
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + pop.value * 0.4 }], opacity: pop.value }));

  const drain = useSharedValue(1);
  useEffect(() => {
    if (!undoable) return;
    drain.value = 1;
    drain.value = withTiming(0, { duration: UNDO_MS, easing: Easing.linear });
  }, [undoable, drain]);
  const drainStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: drain.value }] }));

  const time = med.reminderTime;

  return (
    <View style={[styles.dose, ruled && styles.ruled, given && styles.doseGiven]}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${med.medicationName}. ${med.dosage ?? ""}. Open details`}
        scaleTo={0.985}
        style={styles.doseMain}
        onPress={onOpen}
      >
        <View style={styles.timeCol}>
          {time ? (
            <>
              <Text style={styles.timeBig}>{prettyClock(time).split(" ")[0]}</Text>
              <Text style={styles.timeSmall}>{prettyClock(time).split(" ")[1]}</Text>
            </>
          ) : (
            <ClockIcon size={iconSize.standard} color={text.tertiary} weight="regular" />
          )}
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {med.medicationName}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {log ? `Given at ${givenAt(log)}` : undoable ? "Given just now" : [med.dosage, courseNote(med) === "Ongoing" ? null : courseNote(med)].filter(Boolean).join(" · ") || "Any time today"}
          </Text>
        </View>
      </PressScale>

      {undoable ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Undo" scaleTo={0.95} style={styles.undo} onPress={onUndoPending}>
          <ArrowCounterClockwiseIcon size={14} color={text.primary} weight="bold" />
          <Text style={styles.undoText}>Undo</Text>
          <Animated.View style={[styles.undoBar, drainStyle]} />
        </PressScale>
      ) : given ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${med.medicationName} given. Tap to undo`}
          scaleTo={0.92}
          style={[styles.give, styles.giveDone]}
          onPress={() => log && onUndoSaved(log)}
        >
          <Animated.View style={tick}>
            <CheckIcon size={iconSize.standard} color={text.primary} weight="bold" />
          </Animated.View>
        </PressScale>
      ) : (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${giveLabel} ${med.medicationName}`}
          scaleTo={0.92}
          style={styles.give}
          onPress={onGive}
        >
          <Text style={styles.giveText}>{giveLabel}</Text>
        </PressScale>
      )}
    </View>
  );
};

const MedDetail = ({
  med,
  logs,
  onClose,
  onEdit,
  onStop,
}: {
  med: Medication | null;
  logs: readonly MedicationLog[];
  onClose: () => void;
  onEdit: (med: Medication) => void;
  onStop: (med: Medication) => void;
}) => {
  const today = todayKey();
  const [shown, setShown] = useState<Medication | null>(med);
  useEffect(() => {
    if (med) setShown(med);
  }, [med]);
  if (!shown) return null;

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, i - (HISTORY_DAYS - 1)));
  const due = days.filter((day) => dueOn(shown, day) || (shown.frequency === "as_needed" && logs.some((l) => l.medicationId === shown.id && l.givenDate === day)));
  const given = days.filter((day) => logs.some((log) => log.medicationId === shown.id && log.givenDate === day));
  const givenToday = logs.some((log) => log.medicationId === shown.id && log.givenDate === today);
  const next = upcomingDoses(shown, 3, givenToday ? addDays(today, 1) : today);

  return (
    <FlowSheet
      open={Boolean(med)}
      title={shown.medicationName}
      lede={[shown.dosage, cadence(shown)].filter(Boolean).join(" · ")}
      step={0}
      total={1}
      direction={1}
      primary={{ label: "Edit schedule", onPress: () => onEdit(shown) }}
      onBack={onClose}
      onClose={onClose}
    >
      <FieldLabel>{`Last ${HISTORY_DAYS} days`}</FieldLabel>
      <View style={styles.history}>
        {days.map((day) => {
          const wasDue = due.includes(day);
          const wasGiven = given.includes(day);
          return (
            <View key={day} style={styles.historyCell} accessibilityLabel={`${shortDay(day)}: ${wasGiven ? "given" : wasDue ? "missed" : "not due"}`}>
              <View style={[styles.historyDot, wasGiven && styles.dotDone, wasDue && !wasGiven && day !== today && styles.dotMissed]} />
              <Text style={styles.historyLabel}>{new Date(`${day}T00:00:00`).getDate()}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.detailNote}>
        {shown.frequency === "as_needed"
          ? `${given.length} ${given.length === 1 ? "dose" : "doses"} logged in the last two weeks.`
          : `${given.length} of ${due.length} given.`}
      </Text>

      {next.length > 0 ? (
        <>
          <FieldLabel>Next doses</FieldLabel>
          {next.map((day) => (
            <View key={day} style={styles.nextRow}>
              <Text style={styles.nextDay}>{relativeDay(day)}</Text>
              <Text style={styles.nextTime}>{shown.reminderTime ? prettyClock(shown.reminderTime) : "Any time"}</Text>
            </View>
          ))}
        </>
      ) : null}

      <FieldLabel>Course</FieldLabel>
      <Text style={styles.detailBody}>{courseNote(shown)}</Text>
      {shown.notes ? <Text style={[styles.detailBody, styles.detailNotes]}>{shown.notes}</Text> : null}

      <PressScale accessibilityRole="button" accessibilityLabel={`Stop ${shown.medicationName}`} scaleTo={0.97} style={styles.stop} onPress={() => onStop(shown)}>
        <ProhibitIcon size={iconSize.inline} color={text.secondary} weight="bold" />
        <Text style={styles.stopText}>Stop giving this</Text>
      </PressScale>
    </FlowSheet>
  );
};

const MedFlow = ({
  open,
  draft,
  dogName,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: Draft;
  dogName: string;
  busy: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pickStart, setPickStart] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(draft.id ? 1 : 0);
      setDirection(1);
      setPickStart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = (next: number) => {
    void Haptics.selectionAsync();
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const plan = planOf(draft);
  const upcoming = upcomingDoses(plan, 3);
  const scheduled = draft.frequency !== "as_needed";

  const titles = [
    "What is it?",
    `When does ${dogName} get it?`,
    draft.id ? "Save the changes?" : "Ready to track",
  ];

  const primary =
    step === 0
      ? { label: "Next", disabled: draft.name.trim().length < 2, onPress: () => go(1) }
      : step === 1
        ? { label: "Next", onPress: () => go(2) }
        : { label: draft.id ? "Save changes" : "Start tracking", busy, onPress: onSave };

  const pick = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    void Haptics.selectionAsync();
    onChange({ [key]: value } as Partial<Draft>);
  };

  return (
    <FlowSheet
      open={open}
      title={titles[step]}
      step={step}
      total={3}
      direction={direction}
      primary={primary}
      onBack={() => go(step - 1)}
      onClose={onClose}
    >
      {step === 0 ? (
        <>
          <View style={styles.presetGrid}>
            {PRESETS.map((preset) => {
              const on = draft.name === preset.name;
              return (
                <PressScale
                  key={preset.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${preset.name}, ${preset.purpose}`}
                  scaleTo={0.96}
                  style={[styles.preset, on && styles.presetOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onChange({ name: preset.name, dose: preset.dose, frequency: preset.frequency, days: preset.days });
                  }}
                >
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetPurpose}>{preset.purpose}</Text>
                </PressScale>
              );
            })}
          </View>
          <FieldLabel>Or type the name</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.name}
            onChangeText={(name) => onChange({ name })}
            placeholder="As it says on the packet"
            placeholderTextColor={text.tertiary}
            accessibilityLabel="Medication name"
          />
          <FieldLabel>Dose</FieldLabel>
          <Pills options={DOSES} value={draft.dose} onPick={(dose) => pick("dose", dose)} />
          <TextInput
            style={[styles.input, styles.inputGap]}
            value={DOSES.includes(draft.dose) ? "" : draft.dose}
            onChangeText={(dose) => onChange({ dose })}
            placeholder="Or type it, like 0.5 ml"
            placeholderTextColor={text.tertiary}
            accessibilityLabel="Dose"
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <FieldLabel>How often</FieldLabel>
          <Pills
            options={FREQUENCIES.map((f) => f.label)}
            value={FREQUENCIES.find((f) => f.key === draft.frequency)?.label ?? ""}
            onPick={(label) => pick("frequency", FREQUENCIES.find((f) => f.label === label)?.key ?? "daily")}
          />

          {scheduled ? (
            <>
              <FieldLabel>What time</FieldLabel>
              <Pills
                options={[...TIMES.map(prettyClock), "No set time"]}
                value={draft.time ? prettyClock(draft.time) : "No set time"}
                onPick={(label) => pick("time", TIMES.find((t) => prettyClock(t) === label) ?? null)}
              />

              <FieldLabel>Starting</FieldLabel>
              <Pills
                options={["Today", "Tomorrow", pickStart || (draft.start !== todayKey() && draft.start !== addDays(todayKey(), 1)) ? shortDay(draft.start) : "Pick a day"]}
                value={draft.start === todayKey() ? "Today" : draft.start === addDays(todayKey(), 1) ? "Tomorrow" : shortDay(draft.start)}
                onPick={(label) => {
                  if (label === "Today") pick("start", todayKey());
                  else if (label === "Tomorrow") pick("start", addDays(todayKey(), 1));
                  else setPickStart((value) => !value);
                }}
              />
              {pickStart ? (
                <View style={styles.calendar}>
                  <MonthPicker
                    selected={draft.start}
                    reduceMotion={reduceMotion}
                    onPick={(day) => {
                      onChange({ start: day.key });
                      setPickStart(false);
                    }}
                  />
                </View>
              ) : null}
              {draft.frequency !== "daily" ? (
                <Text style={styles.hint}>
                  {draft.frequency === "weekly"
                    ? `Every ${weekdayOf(draft.start)}, because that is the day you start.`
                    : `On the ${ordinalDay(draft.start)} of each month, because that is the day you start.`}
                </Text>
              ) : null}

              <FieldLabel>For how long</FieldLabel>
              <Pills
                options={COURSES.map((c) => c.label)}
                value={COURSES.find((c) => c.days === draft.days)?.label ?? ""}
                onPick={(label) => pick("days", COURSES.find((c) => c.label === label)?.days ?? null)}
              />
            </>
          ) : (
            <Text style={styles.hint}>No schedule and no reminders. Log each dose when you give it.</Text>
          )}
        </>
      ) : null}

      {step === 2 ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter)}>
          <View style={styles.summary}>
            <Text style={styles.summaryName}>{draft.name.trim()}</Text>
            <Text style={styles.summaryLine}>
              {[draft.dose.trim() || null, cadence(plan)]
                .filter(Boolean)
                .map((part, index) => (index > 0 ? part!.charAt(0).toLowerCase() + part!.slice(1) : part))
                .join(", ")}
              {plan.endDate ? `, until ${shortDay(plan.endDate)}` : ""}.
            </Text>
            {upcoming.length > 0 ? (
              <View style={styles.summaryNext}>
                {upcoming.map((day, index) => (
                  <View key={day} style={styles.summaryDose}>
                    <View style={[styles.summaryDot, index === 0 && styles.summaryDotFirst]} />
                    <Text style={styles.summaryDoseText}>
                      {relativeDay(day)}
                      {plan.reminderTime ? `, ${prettyClock(plan.reminderTime)}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {scheduled && draft.time ? (
            <View style={styles.remind}>
              <BellIcon size={iconSize.standard} color={text.primary} weight="regular" />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Remind me</Text>
                <Text style={styles.rowMeta}>{`A notification at ${prettyClock(draft.time)} on dose days`}</Text>
              </View>
              <Switch
                value={draft.remind}
                onValueChange={(remind) => pick("remind", remind)}
                trackColor={{ true: accent.deep, false: border.default }}
                accessibilityLabel="Remind me"
              />
            </View>
          ) : null}

          <FieldLabel>Notes</FieldLabel>
          <TextInput
            style={[styles.input, styles.inputTall]}
            value={draft.notes}
            onChangeText={(notes) => onChange({ notes })}
            placeholder="Prescribing vet, give with food, what to watch for"
            placeholderTextColor={text.tertiary}
            multiline
            accessibilityLabel="Notes"
          />
        </Animated.View>
      ) : null}
    </FlowSheet>
  );
};

const Pills = ({ options, value, onPick }: { options: readonly string[]; value: string; onPick: (option: string) => void }) => (
  <View style={styles.pills}>
    {options.map((option) => {
      const on = option === value;
      return (
        <PressScale
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={option}
          scaleTo={0.95}
          style={[styles.pill, on && styles.pillOn]}
          onPress={() => onPick(option)}
        >
          <Text style={[styles.pillText, on && styles.pillTextOn]}>{option}</Text>
        </PressScale>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  headline: { ...type.hero, fontSize: 34, lineHeight: 38, color: text.primary, marginTop: space.md },
  subline: { ...type.body, color: text.secondary, marginTop: space.sm },
  section: { ...type.sectionTitle, color: text.primary, marginTop: space.section, marginBottom: space.md },

  week: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.xxl,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  weekDay: { alignItems: "center", gap: space.sm, flex: 1 },
  weekLabel: { ...type.caption, color: text.tertiary },
  weekLabelToday: { color: text.primary, fontWeight: "700" },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: accent.deep },
  dotPartial: { backgroundColor: accent.primary },
  dotMissed: { backgroundColor: bg.canvas, borderWidth: 2, borderColor: accent.band },
  dotOpen: { backgroundColor: bg.canvas, borderWidth: 2, borderColor: text.primary, borderStyle: "dashed" },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    backgroundColor: bg.canvas,
  },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowMeta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  muted: { color: text.secondary },
  when: { ...type.caption, fontWeight: "700", color: text.primary },

  dose: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingRight: space.lg,
    backgroundColor: bg.canvas,
  },
  doseGiven: { backgroundColor: accent.soft },
  doseMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, paddingVertical: space.lg },
  timeCol: { width: 48, alignItems: "flex-start" },
  timeBig: { ...type.sectionTitle, color: text.primary, fontVariant: ["tabular-nums"] },
  timeSmall: { ...type.caption, color: text.tertiary, marginTop: -2 },
  give: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  giveDone: { minWidth: 40, width: 40, paddingHorizontal: 0, backgroundColor: accent.deep },
  giveText: { ...type.supporting, fontWeight: "700", color: text.inverse },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    overflow: "hidden",
  },
  undoText: { ...type.supporting, fontWeight: "700", color: text.primary },
  undoBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: accent.band,
    transformOrigin: "left",
  },

  dateTile: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: { ...type.cardTitle, fontWeight: "700", color: text.primary, lineHeight: 18 },
  dateMonth: { ...type.caption, fontSize: 10, lineHeight: 12, color: text.secondary },

  ghost: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: bg.subtle },
  ghostText: { ...type.caption, fontWeight: "700", color: text.secondary },

  empty: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xxl },
  quickAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  quickAddText: { ...type.supporting, fontWeight: "700", color: text.primary },

  history: { flexDirection: "row", justifyContent: "space-between" },
  historyCell: { alignItems: "center", gap: 6 },
  historyDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: bg.subtle },
  historyLabel: { ...type.caption, fontSize: 10, color: text.tertiary, fontVariant: ["tabular-nums"] },
  detailNote: { ...type.caption, color: text.secondary, marginTop: space.md },
  nextRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border.soft },
  nextDay: { ...type.supporting, fontWeight: "600", color: text.primary },
  nextTime: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },
  detailBody: { ...type.supporting, color: text.primary },
  detailNotes: { color: text.secondary, marginTop: space.sm },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: space.xxl,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  stopText: { ...type.supporting, fontWeight: "600", color: text.secondary },

  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  preset: {
    width: "48%",
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  presetOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  presetName: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  presetPurpose: { ...type.caption, color: text.tertiary, marginTop: 2 },

  input: {
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
    ...type.body,
    color: text.primary,
  },
  inputGap: { marginTop: space.sm },
  inputTall: { height: 88, paddingTop: space.md, textAlignVertical: "top" },
  hint: { ...type.caption, color: text.secondary, marginTop: space.md, lineHeight: 17 },
  calendar: { marginTop: space.md, padding: space.sm, borderRadius: radius.card, backgroundColor: bg.subtle },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  pillOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  pillText: { ...type.supporting, color: text.secondary },
  pillTextOn: { color: text.primary, fontWeight: "600" },

  summary: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card + 4, backgroundColor: accent.primary },
  summaryName: { ...type.pageTitle, color: text.primary },
  summaryLine: { ...type.body, color: text.primary, marginTop: space.sm },
  summaryNext: { marginTop: space.lg, gap: space.sm },
  summaryDose: { flexDirection: "row", alignItems: "center", gap: space.sm },
  summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.band },
  summaryDotFirst: { backgroundColor: text.primary },
  summaryDoseText: { ...type.supporting, color: text.secondary },

  remind: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
});
