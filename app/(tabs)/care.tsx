import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { ProfileIconButton } from "@/components/navigation/ProfileIconButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { todayKey, useCompleteDailyQuest, useDailyQuests } from "@/hooks/useDailyQuests";
import {
  useCareEvents,
  useCareRoutineCompletions,
  useCareRoutines,
  useCompleteCareRoutine,
  useSaveCareRoutineSetup,
} from "@/hooks/useCareEvents";
import {
  useCareProfile,
  useGroomingLogs,
  useMedications,
  useTodayExerciseLogs,
  useTodayMedicationLogs,
  useUpsertCareProfile,
  useVaccinations,
  useLogExercise,
  useLogMedicationGiven,
} from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { defaultCareRoutineTemplates, type CareRoutineDraft } from "@/services/careService";
import { requestNotificationPermissions, rescheduleAllRoutineReminders } from "@/services/notificationService";
import { BREED_EXERCISE_DATA, GROOMING_TYPES, VACCINE_SCHEDULE, getBreedExerciseGoal, getBreedDailyStepGoal, getBreedEnergyTier, BREED_STEPS_PER_MINUTE, isGroomingOverdue, daysUntilGrooming } from "@/constants/careHealth";
import type { CareEvent, CareRoutine, DailyQuest } from "@/types/domain";

const TIME_OPTIONS = ["06:00","07:00","08:00","09:00","10:00","12:00","14:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
};

// ── Icon maps (all Ionicons) ──────────────────────────────────────────────────

type IconDef = { name: keyof typeof Ionicons.glyphMap; color: string; bg: string };

const ROUTINE_ICON: Record<string, IconDef> = {
  walk:               { name: "footsteps-outline",  color: theme.colors.primary,    bg: theme.colors.primarySoft },
  "bowl-mix":         { name: "nutrition-outline",  color: "#C47A2B",               bg: "#FAE4C4" },
  water:              { name: "water-outline",      color: "#4A90D9",               bg: "#DCF0FF" },
  brain:              { name: "bulb-outline",       color: "#9E5EEA",               bg: "#EDE4FF" },
  star:               { name: "barbell-outline",    color: theme.colors.primaryDark, bg: theme.colors.primarySoft },
  custom:             { name: "add-circle-outline", color: theme.colors.textMuted,  bg: theme.colors.cardMuted },
};

const EVENT_ICON: Record<string, IconDef> = {
  vet:       { name: "medical-outline",   color: "#D94F4F", bg: "#FFE8E8" },
  grooming:  { name: "cut-outline",       color: "#4A90D9", bg: "#DCF0FF" },
  medication:{ name: "medkit-outline",    color: "#C47A2B", bg: "#FAE4C4" },
  walk:      { name: "footsteps-outline", color: theme.colors.primary,    bg: theme.colors.primarySoft },
  training:  { name: "barbell-outline",   color: "#9E5EEA", bg: "#EDE4FF" },
};

const routineIcon = (key: string): IconDef =>
  ROUTINE_ICON[key] ?? { name: "star-outline", color: theme.colors.gold, bg: theme.colors.goldSoft };
const eventIcon = (type: string): IconDef =>
  EVENT_ICON[type] ?? { name: "heart-outline", color: "#D94F4F", bg: "#FFE8E8" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysUntil = (v: string) => Math.max(0, Math.ceil((new Date(v).getTime() - Date.now()) / MS_PER_DAY));
const dailySilver = (r: CareRoutine[], q: DailyQuest[]) =>
  r.reduce((s, x) => s + x.silverReward, 0) + q.reduce((s, x) => s + (x.silverReward ?? 0), 0);
const progressMsg = (done: number, total: number) => {
  if (total === 0) return "Set up your routine to get started";
  if (done === 0)  return "Let's start your day!";
  if (done === total) return "All done for today!";
  const left = total - done;
  return `${left} more task${left > 1 ? "s" : ""} to go`;
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Task templates for the add-task modal ─────────────────────────────────────

const TASK_TEMPLATES: Array<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap; iconKey: string }> = [
  { key: "walk",       label: "Walk",          icon: "footsteps-outline",   iconKey: "walk"     },
  { key: "feeding",    label: "Feeding",        icon: "nutrition-outline",   iconKey: "bowl-mix" },
  { key: "water",      label: "Water bowl",     icon: "water-outline",       iconKey: "water"    },
  { key: "medication", label: "Medication",     icon: "medkit-outline",      iconKey: "star"     },
  { key: "training",   label: "Training",       icon: "barbell-outline",     iconKey: "brain"    },
  { key: "play",       label: "Playtime",       icon: "tennisball-outline",  iconKey: "star"     },
  { key: "grooming",   label: "Grooming",       icon: "cut-outline",         iconKey: "custom"   },
  { key: "vet",        label: "Vet visit",      icon: "medical-outline",     iconKey: "custom"   },
];

const routinesToDrafts = (routines: CareRoutine[]): CareRoutineDraft[] =>
  routines.map((r) => ({
    routineKey: r.routineKey,
    title: r.title,
    description: r.description,
    iconKey: r.iconKey,
    silverReward: r.silverReward,
    sortOrder: r.sortOrder,
    reminderTime: r.reminderTime,
  }));

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CareTabScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const date = todayKey();

  const quests            = useDailyQuests(dogId, date);
  const completeQuest     = useCompleteDailyQuest(dogId);
  const events            = useCareEvents(dogId);
  const routines          = useCareRoutines(dogId);
  const routineCompletions = useCareRoutineCompletions(dogId, date);
  const completeRoutine   = useCompleteCareRoutine(dogId, date);
  const saveRoutines      = useSaveCareRoutineSetup(dogId);

  // Health data
  const careProfile       = useCareProfile(dogId);
  const vaccinations      = useVaccinations(dogId);
  const medications       = useMedications(dogId);
  const todayMedLogs      = useTodayMedicationLogs(dogId);
  const exerciseLogs      = useTodayExerciseLogs(dogId);
  const groomingLogs      = useGroomingLogs(dogId);
  const upsertProfile     = useUpsertCareProfile(dogId);
  const logExercise       = useLogExercise(dogId);
  const logMedGiven       = useLogMedicationGiven(dogId);

  // Care onboarding (modal — kept for backward compat)
  const [onboardOpen, setOnboardOpen]           = useState(false);
  const [onboardStep, setOnboardStep]           = useState(0);
  const [onboardGoal, setOnboardGoal]           = useState(60);

  // Care setup hero card
  const [heroExerciseGoal, setHeroExerciseGoal] = useState(() =>
    dog.data?.breed ? Math.round(((() => {
      const n = dog.data!.breed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const entry = Object.entries(BREED_EXERCISE_DATA).find(([k]) => n.includes(k) || k.includes(n.split("_")[0]));
      const d = entry?.[1];
      return d ? (d.minutesMin + d.minutesMax) / 2 : 60;
    })())) : 60
  );
  const [heroRoutineKeys, setHeroRoutineKeys]   = useState<string[]>(["walk", "feeding", "water", "training_practice"]);
  const [exerciseLogOpen, setExerciseLogOpen]   = useState(false);
  const [quickExActivity, setQuickExActivity]   = useState<"walk" | "run" | "play">("walk");
  const [quickExWalkCount, setQuickExWalkCount] = useState(1);
  const [quickExDuration, setQuickExDuration]   = useState("30");

  const [setupOpen, setSetupOpen]               = useState(false);
  const [selectedKeys, setSelectedKeys]         = useState(defaultCareRoutineTemplates.slice(0, 3).map((t) => t.routineKey));
  const [customList, setCustomList]             = useState<CareRoutineDraft[]>([]);
  const [customTitle, setCustomTitle]           = useState("");
  const [customDesc, setCustomDesc]             = useState("");
  const [customReward, setCustomReward]         = useState("5");
  const [addingCustom, setAddingCustom]         = useState(false);
  const [reminderTimes, setReminderTimes]       = useState<Record<string, string>>({});
  const [timePickerOpenFor, setTimePickerOpenFor] = useState<string | null>(null);

  const [activeTab, setActiveTab]         = useState<"today" | "schedule" | "health">("today");

  // Water tracking (persisted per dog per day via AsyncStorage)
  const waterStorageKey = `paws:water:${dogId}:${date}`;
  const [waterBowls, setWaterBowls]       = useState(0);
  const waterGoal = 4;

  useEffect(() => {
    if (!dogId) return;
    AsyncStorage.getItem(waterStorageKey).then((v) => {
      if (v !== null) setWaterBowls(parseInt(v, 10) || 0);
    }).catch(() => {});
  }, [waterStorageKey]);

  const adjustWater = (delta: number) => {
    setWaterBowls((prev) => {
      const next = Math.max(0, Math.min(waterGoal + 4, prev + delta));
      AsyncStorage.setItem(waterStorageKey, String(next)).catch(() => {});
      return next;
    });
  };

  // Task management
  const [taskAddOpen, setTaskAddOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskIconKey, setNewTaskIconKey] = useState("custom");

  const openAddTask = (template?: (typeof TASK_TEMPLATES)[number]) => {
    setNewTaskName(template?.label ?? "");
    setNewTaskIconKey(template?.iconKey ?? "custom");
    setTaskAddOpen(true);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim() || saveRoutines.isPending) return;
    const newItem: CareRoutineDraft = {
      routineKey: `custom_${Date.now()}`,
      title: newTaskName.trim(),
      description: "",
      iconKey: newTaskIconKey,
      silverReward: 5,
      sortOrder: activeRoutines.length + 1,
    };
    saveRoutines.mutate([...routinesToDrafts(activeRoutines), newItem], {
      onSuccess: () => { setNewTaskName(""); setNewTaskIconKey("custom"); setTaskAddOpen(false); },
    });
  };

  const handleDeleteTask = (routineKey: string, title: string) => {
    Alert.alert("Remove task", `Remove "${title}" from your daily tasks?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => saveRoutines.mutate(routinesToDrafts(activeRoutines.filter((r) => r.routineKey !== routineKey))),
      },
    ]);
  };

  const [selectedDate, setSelectedDate]   = useState<string>(todayKey());
  const [calMode, setCalMode]             = useState<"week" | "month">("week");
  const calFade = useRef(new Animated.Value(1)).current;

  const switchCal = (mode: "week" | "month") => {
    if (mode === calMode) return;
    Animated.timing(calFade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setCalMode(mode);
      Animated.timing(calFade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };

  const completedIds = useMemo(
    () => new Set((routineCompletions.data ?? []).map((c) => c.routineId)),
    [routineCompletions.data],
  );
  const selectedDayEvents = useMemo(
    () => (events.data ?? []).filter((e) => e.startTime.slice(0, 10) === selectedDate),
    [events.data, selectedDate],
  );

  // Sync hero exercise goal when dog breed loads
  useEffect(() => {
    if (dog.data?.breed) {
      setHeroExerciseGoal(getBreedExerciseGoal(dog.data.breed));
      setOnboardGoal(getBreedExerciseGoal(dog.data.breed));
    }
  }, [dog.data?.breed]);

  // Derived health stats
  const goalMinutes = careProfile.data?.dailyExerciseGoalMinutes ?? onboardGoal;
  const totalExToday = (exerciseLogs.data ?? []).reduce((s, l) => s + l.durationMinutes, 0);
  const exerciseProgress = Math.min(totalExToday / goalMinutes, 1);

  const givenMedIds = new Set((todayMedLogs.data ?? []).map((l) => l.medicationId));
  const pendingMeds = (medications.data ?? []).filter(
    (m) => m.frequency === "daily" && !givenMedIds.has(m.id)
  );

  const latestVaccByKey = new Map<string, import("@/services/careHealthService").Vaccination>();
  for (const v of vaccinations.data ?? []) {
    if (!latestVaccByKey.has(v.vaccineKey)) latestVaccByKey.set(v.vaccineKey, v);
  }
  const overdueVaccines = VACCINE_SCHEDULE.filter((vs) => {
    const rec = latestVaccByKey.get(vs.key);
    if (!rec?.nextDueDate) return false;
    return new Date(rec.nextDueDate + "T00:00:00") <= new Date();
  });

  const latestGroomByType = new Map<string, import("@/services/careHealthService").GroomingLog>();
  for (const g of groomingLogs.data ?? []) {
    if (!latestGroomByType.has(g.groomingType)) latestGroomByType.set(g.groomingType, g);
  }
  const overdueGrooming = GROOMING_TYPES.filter((gt) => {
    const rec = latestGroomByType.get(gt.key);
    return !rec || isGroomingOverdue(rec.doneDate, gt.intervalDays);
  });

  // Steps estimation from exercise logs
  const breedTier = dog.data?.breed ? getBreedEnergyTier(dog.data.breed) : "medium";
  const walkStepsPerMin = BREED_STEPS_PER_MINUTE[breedTier];
  const estimatedSteps = (exerciseLogs.data ?? []).reduce((sum, log) => {
    const rate = log.activityType === "run" ? 120
      : log.activityType === "play" ? 40
      : walkStepsPerMin;
    return sum + Math.round(log.durationMinutes * rate);
  }, 0);
  const dailyStepGoal = dog.data?.breed ? getBreedDailyStepGoal(dog.data.breed) : 8000;
  const stepProgress = Math.min(estimatedSteps / dailyStepGoal, 1);

  // Smart alerts — only show when actionable
  type AlertItem = { key: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; text: string; action?: () => void };
  const now48h = Date.now() + 48 * 60 * 60 * 1000;
  const upcoming48hEvent = (events.data ?? []).find((e) => {
    const t = new Date(e.startTime).getTime();
    return t > Date.now() && t <= now48h;
  });
  const smartAlerts: AlertItem[] = [];
  if (overdueVaccines.length > 0) {
    smartAlerts.push({
      key: "vacc",
      icon: "shield-outline",
      color: theme.colors.error,
      bg: "#FEE2E2",
      text: overdueVaccines.length === 1 ? `${overdueVaccines[0].name} vaccination overdue` : `${overdueVaccines.length} vaccinations overdue`,
      action: () => router.push("/care/vaccinations"),
    });
  }
  if (pendingMeds.length > 0) {
    smartAlerts.push({
      key: "meds",
      icon: "medkit-outline",
      color: "#C47A2B",
      bg: "#FFF3CD",
      text: pendingMeds.length === 1 ? `${pendingMeds[0].medicationName} not given yet today` : `${pendingMeds.length} medications due today`,
      action: () => router.push("/care/medications"),
    });
  } else if ((medications.data ?? []).length === 0 && !medications.isLoading) {
    smartAlerts.push({
      key: "no-meds",
      icon: "medkit-outline",
      color: theme.colors.textMuted,
      bg: theme.colors.cardMuted,
      text: `Set up medications for ${dog.data?.name ?? "your dog"}`,
      action: () => router.push("/care/medications"),
    });
  }
  if (upcoming48hEvent) {
    const evDate = new Date(upcoming48hEvent.startTime);
    const isToday = evDate.toDateString() === new Date().toDateString();
    smartAlerts.push({
      key: `event-${upcoming48hEvent.id}`,
      icon: "calendar-outline",
      color: "#4A78E0",
      bg: "#EAF2FF",
      text: `${upcoming48hEvent.title} ${isToday ? "today" : "tomorrow"} at ${evDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
      action: () => setActiveTab("schedule"),
    });
  }

  const completeOnboarding = () => {
    upsertProfile.mutate({
      dailyExerciseGoalMinutes: onboardGoal,
      onboardingCompleted: true,
    }, { onSuccess: () => setOnboardOpen(false) });
  };

  if (dog.isLoading || quests.isLoading || events.isLoading || routines.isLoading || routineCompletions.isLoading)
    return <ScreenContainer centered><LoadingState message="Loading care plan..." /></ScreenContainer>;

  if (quests.error || events.error || routines.error || routineCompletions.error)
    return (
      <ScreenContainer centered>
        <ErrorState
          message="Care could not load."
          onRetry={() => { void quests.refetch(); void events.refetch(); void routines.refetch(); void routineCompletions.refetch(); }}
        />
      </ScreenContainer>
    );

  const activeRoutines = routines.data ?? [];
  const hasSetup       = activeRoutines.length > 0;
  const careSetupDone  = hasSetup || !!careProfile.data?.onboardingCompleted;
  const doneRoutines   = activeRoutines.filter((r) => completedIds.has(r.id)).length;
  const doneQuests     = (quests.data ?? []).filter((q) => q.status === "completed").length;
  const totalItems     = (quests.data ?? []).length + activeRoutines.length;
  const doneItems      = doneRoutines + doneQuests;
  const progress       = totalItems > 0 ? doneItems / totalItems : 0;

  const completeHeroSetup = (skip = false) => {
    const selected = skip ? [] : defaultCareRoutineTemplates
      .filter((t) => heroRoutineKeys.includes(t.routineKey))
      .map((t) => ({ ...t, reminderTime: null }));
    const doProfile = () => {
      upsertProfile.mutate({
        dailyExerciseGoalMinutes: skip ? 60 : heroExerciseGoal,
        onboardingCompleted: true,
      });
    };
    if (selected.length > 0) {
      saveRoutines.mutate(selected, { onSuccess: doProfile });
    } else {
      doProfile();
    }
  };

  const saveRoutineSetup = () => {
    const selected = defaultCareRoutineTemplates
      .filter((t) => selectedKeys.includes(t.routineKey))
      .map((t) => ({ ...t, reminderTime: reminderTimes[t.routineKey] ?? null }));
    const withCustom = [
      ...selected,
      ...customList.map((c) => ({ ...c, reminderTime: reminderTimes[c.routineKey] ?? null })),
    ];
    saveRoutines.mutate(withCustom, {
      onSuccess: (saved) => {
        setSetupOpen(false);
        void rescheduleAllRoutineReminders(saved);
      },
    });
  };

  const handleSetReminder = async (routineKey: string) => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert("Notifications off", "Enable notifications in Settings to get reminders.");
      return;
    }
    setTimePickerOpenFor(routineKey);
  };

  const addCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    setCustomList((prev) => [...prev, {
      routineKey: `custom_${Date.now()}`,
      title,
      description: customDesc.trim() || "Custom daily routine",
      iconKey: "custom",
      silverReward: Number(customReward) || 5,
      sortOrder: defaultCareRoutineTemplates.length + prev.length,
    }]);
    setCustomTitle(""); setCustomDesc(""); setAddingCustom(false);
  };

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <View style={styles.header}>
        <ProfileIconButton label={dog.data?.name} />
        <Text style={styles.title} numberOfLines={1}>Care</Text>
        <Pressable style={styles.headerBtn} onPress={() => router.push("/notifications-settings")} accessibilityRole="button">
          <Ionicons name="notifications-outline" size={20} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Care Setup Hero (shown until setup is complete) ── */}
      {!careSetupDone && (
        <View style={heroStyles.card}>
          {/* Header */}
          <View style={heroStyles.header}>
            <View style={heroStyles.headerIcon}>
              <Ionicons name="heart" size={22} color="#fff" />
            </View>
            <View style={heroStyles.headerText}>
              <Text style={heroStyles.headerTitle}>Set up {dog.data?.name ?? "your dog"}'s care plan</Text>
              <Text style={heroStyles.headerSub}>
                {dog.data?.breed ? `Personalized for ${dog.data.breed}` : "Personalized for your dog"}
              </Text>
            </View>
          </View>

          {/* Section 1 — Daily exercise */}
          <View style={heroStyles.section}>
            <View style={heroStyles.sectionHeader}>
              <Ionicons name="footsteps-outline" size={15} color={theme.colors.primaryDark} />
              <Text style={heroStyles.sectionLabel}>DAILY EXERCISE GOAL</Text>
            </View>
            {dog.data?.breed ? (
              <Text style={heroStyles.sectionHint}>
                {dog.data.breed} · recommended {getBreedExerciseGoal(dog.data.breed)} min/day
              </Text>
            ) : null}
            <View style={heroStyles.chipRow}>
              {[20, 30, 45, 60, 90, 120].map((m) => (
                <Pressable
                  key={m}
                  style={[heroStyles.chip, heroExerciseGoal === m && heroStyles.chipActive]}
                  onPress={() => setHeroExerciseGoal(m)}
                  accessibilityRole="button"
                >
                  <Text style={[heroStyles.chipText, heroExerciseGoal === m && heroStyles.chipTextActive]}>
                    {m} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 2 — Daily routines */}
          <View style={heroStyles.section}>
            <View style={heroStyles.sectionHeader}>
              <Ionicons name="list-outline" size={15} color={theme.colors.primaryDark} />
              <Text style={heroStyles.sectionLabel}>DAILY ROUTINES</Text>
            </View>
            <Text style={heroStyles.sectionHint}>Pick tasks to track every day and earn silver rewards.</Text>
            <View style={heroStyles.routineGrid}>
              {defaultCareRoutineTemplates.map((t) => {
                const sel = heroRoutineKeys.includes(t.routineKey);
                const def = routineIcon(t.iconKey);
                return (
                  <Pressable
                    key={t.routineKey}
                    style={[heroStyles.routineChip, sel && heroStyles.routineChipActive]}
                    onPress={() =>
                      setHeroRoutineKeys((prev) =>
                        prev.includes(t.routineKey)
                          ? prev.filter((k) => k !== t.routineKey)
                          : [...prev, t.routineKey],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: sel }}
                  >
                    <View style={[heroStyles.routineChipIcon, { backgroundColor: sel ? def.color : def.bg }]}>
                      <Ionicons name={def.name} size={14} color={sel ? "#fff" : def.color} />
                    </View>
                    <Text style={[heroStyles.routineChipText, sel && heroStyles.routineChipTextActive]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    {sel && <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} style={{ marginLeft: "auto" }} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section 3 — Grooming */}
          <View style={heroStyles.section}>
            <View style={heroStyles.sectionHeader}>
              <Ionicons name="cut-outline" size={15} color={theme.colors.primaryDark} />
              <Text style={heroStyles.sectionLabel}>GROOMING REMINDERS</Text>
            </View>
            <Text style={heroStyles.sectionHint}>We'll track when each task is due and alert you.</Text>
            <View style={heroStyles.groomRow}>
              {GROOMING_TYPES.slice(0, 4).map((g) => (
                <View key={g.key} style={heroStyles.groomItem}>
                  <Ionicons name={g.icon as never} size={13} color={theme.colors.primaryDark} />
                  <Text style={heroStyles.groomLabel}>{g.label}</Text>
                  <Text style={heroStyles.groomInterval}>
                    {g.intervalDays === 1 ? "daily" : `every ${g.intervalDays}d`}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={[heroStyles.cta, (saveRoutines.isPending || upsertProfile.isPending) && heroStyles.ctaLoading]}
            onPress={() => completeHeroSetup(false)}
            disabled={saveRoutines.isPending || upsertProfile.isPending}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={heroStyles.ctaText}>
              {(saveRoutines.isPending || upsertProfile.isPending)
                ? "Setting up…"
                : `Complete ${dog.data?.name ?? "your dog"}'s care setup`}
            </Text>
          </Pressable>

          <Pressable
            style={heroStyles.skip}
            onPress={() => completeHeroSetup(true)}
            disabled={saveRoutines.isPending || upsertProfile.isPending}
            accessibilityRole="button"
          >
            <Text style={heroStyles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      )}

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {(["today", "schedule", "health"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "today" ? "Today" : tab === "schedule" ? "Schedule" : "Health"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ════════════════════════════════════════
          TODAY TAB
      ════════════════════════════════════════ */}
      {activeTab === "today" && (
        <>

          {/* ── Steps hero card (Apple Health style) ── */}
          <View style={aStyles.heroCard}>
            {/* Top row: ring + stats */}
            <View style={aStyles.heroTop}>
              {/* Activity ring */}
              <Pressable style={aStyles.ringWrap} onPress={() => setExerciseLogOpen(true)} accessibilityRole="button" accessibilityLabel="Log activity">
                <View style={aStyles.ringTrack}>
                  <View style={[aStyles.ringFill, { transform: [{ rotate: `${stepProgress * 360}deg` }] }]} />
                  <View style={aStyles.ringInner}>
                    <Ionicons name="footsteps-outline" size={22} color={stepProgress >= 1 ? theme.colors.primaryDark : theme.colors.textMuted} />
                  </View>
                </View>
                {stepProgress >= 1 && (
                  <View style={aStyles.ringBadge}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </Pressable>

              {/* Steps count */}
              <View style={aStyles.statsBlock}>
                <View style={aStyles.statsRow}>
                  <Text style={aStyles.stepCount}>
                    {estimatedSteps >= 1000
                      ? `${(estimatedSteps / 1000).toFixed(1)}k`
                      : estimatedSteps.toLocaleString()}
                  </Text>
                  <Text style={aStyles.stepUnit}> steps</Text>
                </View>
                <Text style={aStyles.stepGoal}>
                  Goal: {dailyStepGoal >= 1000 ? `${(dailyStepGoal / 1000).toFixed(0)}k` : dailyStepGoal} · {dog.data?.breed ?? "Today"}
                </Text>
                {/* Progress bar */}
                <View style={aStyles.progressTrack}>
                  <View style={[aStyles.progressFill, { width: `${stepProgress * 100}%` }]} />
                </View>
                <Text style={aStyles.progressLabel}>
                  {stepProgress >= 1
                    ? "Goal reached!"
                    : `${Math.round((1 - stepProgress) * dailyStepGoal).toLocaleString()} to go`}
                </Text>
              </View>

              {/* Log button */}
              <Pressable
                style={aStyles.logBtn}
                onPress={() => setExerciseLogOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Log activity"
              >
                <Ionicons name="add" size={18} color={theme.colors.primaryDark} />
              </Pressable>
            </View>

            {/* Divider */}
            <View style={aStyles.divider} />

            {/* Water row */}
            <View style={aStyles.waterRow}>
              <View style={aStyles.waterLeft}>
                <Ionicons name="water-outline" size={18} color="#4A90D9" />
                <Text style={aStyles.waterLabel}>Water today</Text>
              </View>
              <View style={aStyles.waterCounter}>
                <Pressable style={aStyles.counterBtn} onPress={() => adjustWater(-1)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="remove" size={16} color={theme.colors.primaryDark} />
                </Pressable>
                <View style={aStyles.counterDisplay}>
                  {Array.from({ length: waterGoal }, (_, i) => (
                    <Ionicons key={i} name="water" size={14} color={i < waterBowls ? "#4A90D9" : theme.colors.border} />
                  ))}
                  <Text style={aStyles.counterText}>{waterBowls}/{waterGoal}</Text>
                </View>
                <Pressable style={aStyles.counterBtn} onPress={() => adjustWater(1)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── Smart alerts (only when actionable) ── */}
          {smartAlerts.map((alert) => (
            <Pressable
              key={alert.key}
              style={[aStyles.alertBanner, { backgroundColor: alert.bg }]}
              onPress={alert.action}
              accessibilityRole="button"
            >
              <View style={[aStyles.alertIconWrap, { backgroundColor: `${alert.color}22` }]}>
                <Ionicons name={alert.icon} size={16} color={alert.color} />
              </View>
              <Text style={[aStyles.alertText, { color: alert.color }]} numberOfLines={2}>{alert.text}</Text>
              <Ionicons name="chevron-forward" size={14} color={alert.color} />
            </Pressable>
          ))}

          {/* Today's Tasks */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>Today's Tasks</Text>
              {doneItems > 0 && doneItems === totalItems ? (
                <View style={styles.allDoneChip}>
                  <Text style={styles.allDoneText}>+10 🥈 earned!</Text>
                </View>
              ) : totalItems > 0 ? (
                <View style={styles.rewardHint}>
                  <View style={styles.goldBarSm} />
                  <Text style={styles.rewardHintText}>+10 when done</Text>
                </View>
              ) : null}
            </View>

            {/* Progress */}
            {totalItems > 0 && (
              <View style={styles.progressWrap}>
                <ProgressBar progress={progress} accessibilityLabel="Today's task progress" />
                <View style={styles.progressMeta}>
                  <Text style={styles.progressMsg}>{progressMsg(doneItems, totalItems)}</Text>
                  <Text style={styles.progressCount}>{doneItems}/{totalItems}</Text>
                </View>
              </View>
            )}

            {/* Routine tasks */}
            {activeRoutines.map((r) => (
              <TaskItem
                key={r.id}
                icon={routineIcon(r.iconKey)}
                title={r.title}
                subtitle={r.description}
                done={completedIds.has(r.id)}
                onComplete={() => completeRoutine.mutate(r.id)}
                onDelete={() => handleDeleteTask(r.routineKey, r.title)}
              />
            ))}

            {/* Quest tasks */}
            {(quests.data ?? []).map((q) => (
              <TaskItem
                key={q.id}
                icon={{ name: "trophy-outline", color: theme.colors.gold, bg: theme.colors.goldSoft }}
                title={q.title ?? "Daily quest"}
                subtitle={q.description ?? ""}
                done={q.status === "completed"}
                onComplete={() => completeQuest.mutate(q.id)}
              />
            ))}

            {/* Add task row — always visible, prominent */}
            <Pressable
              style={aStyles.addTaskRow}
              onPress={() => openAddTask()}
              accessibilityRole="button"
              accessibilityLabel={`Add task for ${dog.data?.name ?? "your dog"}`}
            >
              <View style={aStyles.addTaskIcon}>
                <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
              </View>
              <Text style={aStyles.addTaskText}>
                Add task for {dog.data?.name ?? "your dog"}…
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ════════════════════════════════════════
          SCHEDULE TAB
      ════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <>
          {/* Calendar card */}
          <View style={styles.card}>
            <View style={styles.calTop}>
              <View style={styles.segPill}>
                {(["Week", "Month"] as const).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.segBtn, calMode === m.toLowerCase() && styles.segBtnActive]}
                    onPress={() => switchCal(m.toLowerCase() as "week" | "month")}
                  >
                    <Text style={[styles.segText, calMode === m.toLowerCase() && styles.segTextActive]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.todayChip} onPress={() => setSelectedDate(todayKey())}>
                <Text style={styles.todayChipText}>Today</Text>
              </Pressable>
            </View>

            <Animated.View style={{ opacity: calFade }}>
              {calMode === "week" ? (
                <WeekView events={events.data ?? []} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              ) : (
                <MonthView events={events.data ?? []} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              )}
            </Animated.View>

            <Pressable style={styles.addEventBtn} onPress={() => router.push("/care/event-form")}>
              <Ionicons name="add" size={16} color={theme.colors.white} />
              <Text style={styles.addEventText}>Add Event</Text>
            </Pressable>

            {selectedDayEvents.length > 0 && (
              <View style={styles.dayEventsPanel}>
                <Text style={styles.dayEventsLabel}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </Text>
                {selectedDayEvents.map((e, i) => <ScheduleRow key={e.id} event={e} index={i} />)}
              </View>
            )}
          </View>

          {/* Upcoming events */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>Upcoming</Text>
              <Pressable style={styles.addLink} onPress={() => router.push("/care/event-form")}>
                <Ionicons name="add-circle-outline" size={16} color={theme.colors.primaryDark} />
                <Text style={styles.addLinkText}>Add</Text>
              </Pressable>
            </View>
            {(events.data ?? []).length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-outline" size={32} color={theme.colors.borderStrong} />
                <Text style={styles.emptyText}>No upcoming events</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push("/care/event-form")}>
                  <Text style={styles.emptyBtnText}>Schedule one</Text>
                </Pressable>
              </View>
            ) : (
              (events.data ?? []).slice(0, 5).map((e, i) => <ScheduleRow key={e.id} event={e} index={i} />)
            )}
          </View>
        </>
      )}

      {/* ════════════════════════════════════════
          HEALTH TAB
      ════════════════════════════════════════ */}
      {activeTab === "health" && (
        <>
          {/* Vaccinations card */}
          <Pressable style={hStyles.healthCard} onPress={() => router.push("/care/vaccinations")} accessibilityRole="button">
            <View style={hStyles.healthCardLeft}>
              <View style={[hStyles.healthIcon, { backgroundColor: overdueVaccines.length > 0 ? "#FEE2E2" : theme.colors.primarySoft }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={overdueVaccines.length > 0 ? theme.colors.error : theme.colors.primaryDark} />
              </View>
              <View style={hStyles.healthBody}>
                <Text style={hStyles.healthTitle}>Vaccinations</Text>
                <Text style={[hStyles.healthStatus, overdueVaccines.length > 0 && hStyles.healthStatusRed]}>
                  {overdueVaccines.length > 0
                    ? `${overdueVaccines.length} overdue — action needed`
                    : latestVaccByKey.size === 0
                      ? "No records yet — tap to add"
                      : "All up to date"}
                </Text>
                {overdueVaccines.length > 0 && (
                  <Text style={hStyles.healthDetail} numberOfLines={1}>
                    {overdueVaccines.map((v) => v.name).join(", ")}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          {/* Medications card */}
          <Pressable style={hStyles.healthCard} onPress={() => router.push("/care/medications")} accessibilityRole="button">
            <View style={hStyles.healthCardLeft}>
              <View style={[hStyles.healthIcon, { backgroundColor: pendingMeds.length > 0 ? "#FFF3CD" : theme.colors.primarySoft }]}>
                <Ionicons name="medkit-outline" size={22} color={pendingMeds.length > 0 ? "#C47A2B" : theme.colors.primaryDark} />
              </View>
              <View style={hStyles.healthBody}>
                <Text style={hStyles.healthTitle}>Medications</Text>
                <Text style={[hStyles.healthStatus, pendingMeds.length > 0 && hStyles.healthStatusAmber]}>
                  {pendingMeds.length > 0
                    ? `${pendingMeds.length} due today`
                    : (medications.data ?? []).length === 0
                      ? "No medications logged"
                      : "All given today"}
                </Text>
                {pendingMeds.length > 0 && (
                  <Text style={hStyles.healthDetail} numberOfLines={1}>
                    {pendingMeds.map((m) => m.medicationName).join(", ")}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          {/* Exercise card */}
          <Pressable style={hStyles.healthCard} onPress={() => router.push("/care/exercise")} accessibilityRole="button">
            <View style={hStyles.healthCardLeft}>
              <View style={hStyles.ringWrapSm}>
                <View style={hStyles.ringTrackSm}>
                  <View style={[hStyles.ringFillSm, { transform: [{ rotate: `${exerciseProgress * 360}deg` }] }]} />
                  <View style={hStyles.ringCenterSm}>
                    <Text style={hStyles.ringNumSm}>{totalExToday}</Text>
                  </View>
                </View>
              </View>
              <View style={hStyles.healthBody}>
                <Text style={hStyles.healthTitle}>Exercise</Text>
                <Text style={[hStyles.healthStatus, totalExToday >= goalMinutes && hStyles.healthStatusGreen]}>
                  {totalExToday >= goalMinutes
                    ? "Daily goal reached!"
                    : `${goalMinutes - totalExToday} min remaining today`}
                </Text>
                <Text style={hStyles.healthDetail}>Goal: {goalMinutes} min/day</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          {/* Grooming card */}
          <Pressable style={hStyles.healthCard} onPress={() => router.push("/care/grooming")} accessibilityRole="button">
            <View style={hStyles.healthCardLeft}>
              <View style={[hStyles.healthIcon, { backgroundColor: overdueGrooming.length > 0 ? "#FEE2E2" : theme.colors.primarySoft }]}>
                <Ionicons name="cut-outline" size={22} color={overdueGrooming.length > 0 ? theme.colors.error : theme.colors.primaryDark} />
              </View>
              <View style={hStyles.healthBody}>
                <Text style={hStyles.healthTitle}>Grooming & Hygiene</Text>
                <Text style={[hStyles.healthStatus, overdueGrooming.length > 0 && hStyles.healthStatusRed]}>
                  {overdueGrooming.length > 0
                    ? `${overdueGrooming.length} task${overdueGrooming.length > 1 ? "s" : ""} overdue`
                    : "All on schedule"}
                </Text>
                {overdueGrooming.length > 0 && (
                  <Text style={hStyles.healthDetail} numberOfLines={1}>
                    {overdueGrooming.slice(0, 3).map((g) => g.label).join(", ")}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <Text style={styles.disclaimer}>PAWS care info is not veterinary advice.</Text>
        </>
      )}

      {/* Modals always rendered regardless of active tab */}
      {/* ── Add task modal ── */}
      <Modal visible={taskAddOpen} transparent animationType="slide" onRequestClose={() => setTaskAddOpen(false)}>
        <Pressable style={obStyles.overlay} onPress={() => setTaskAddOpen(false)}>
          <Pressable style={taskModalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={obStyles.handle} />
            <Text style={taskModalTitle}>Add task for {dog.data?.name ?? "your dog"}</Text>
            <Text style={taskModalSub}>Pick a category or type your own</Text>

            {/* Category chips */}
            <View style={taskModalGrid}>
              {TASK_TEMPLATES.map((t) => {
                const active = newTaskIconKey === t.iconKey && newTaskName === t.label;
                return (
                  <Pressable
                    key={t.key}
                    style={[taskModalChip, active && taskModalChipActive]}
                    onPress={() => { setNewTaskName(t.label); setNewTaskIconKey(t.iconKey); }}
                    accessibilityRole="button"
                  >
                    <Ionicons name={t.icon} size={20} color={active ? "#fff" : theme.colors.primaryDark} />
                    <Text style={[taskModalChipText, active && taskModalChipTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Task name input */}
            <View style={taskModalInputWrap}>
              <TextInput
                style={taskModalInput}
                value={newTaskName}
                onChangeText={(t) => { setNewTaskName(t); setNewTaskIconKey("custom"); }}
                placeholder="Or type a custom task name…"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleAddTask}
                autoFocus={false}
              />
              {newTaskName.length > 0 && (
                <Pressable onPress={() => { setNewTaskName(""); setNewTaskIconKey("custom"); }} hitSlop={8} style={taskModalInputClear}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </View>

            <Pressable
              style={[taskModalSaveBtn, (!newTaskName.trim() || saveRoutines.isPending) && taskModalSaveBtnDisabled]}
              onPress={handleAddTask}
              disabled={!newTaskName.trim() || saveRoutines.isPending}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={taskModalSaveBtnText}>
                {saveRoutines.isPending ? "Adding…" : `Add to daily tasks`}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Quick exercise log modal ── */}
      <Modal visible={exerciseLogOpen} transparent animationType="slide" onRequestClose={() => setExerciseLogOpen(false)}>
        <Pressable style={obStyles.overlay} onPress={() => setExerciseLogOpen(false)}>
          <Pressable style={qStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={qStyles.topRow}>
              <View style={obStyles.handle} />
              <Pressable style={qStyles.closeBtn} onPress={() => setExerciseLogOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <Text style={qStyles.title}>Log activity</Text>

            {/* Activity type */}
            <Text style={qStyles.label}>Activity</Text>
            <View style={qStyles.actRow}>
              {([
                { key: "walk", icon: "footsteps-outline", label: "Walk" },
                { key: "run",  icon: "flash-outline",     label: "Run"  },
                { key: "play", icon: "tennisball-outline", label: "Play" },
              ] as const).map((a) => (
                <Pressable
                  key={a.key}
                  style={[qStyles.actChip, quickExActivity === a.key && qStyles.actChipActive]}
                  onPress={() => setQuickExActivity(a.key)}
                >
                  <Ionicons name={a.icon} size={18} color={quickExActivity === a.key ? "#fff" : theme.colors.primaryDark} />
                  <Text style={[qStyles.actChipText, quickExActivity === a.key && qStyles.actChipTextActive]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Walk count (only for walk) */}
            {quickExActivity === "walk" && (
              <>
                <Text style={qStyles.label}>Number of walks</Text>
                <View style={qStyles.stepperRow}>
                  <Pressable
                    style={qStyles.stepperBtn}
                    onPress={() => setQuickExWalkCount((n) => Math.max(1, n - 1))}
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={20} color={theme.colors.primaryDark} />
                  </Pressable>
                  <View style={qStyles.stepperValue}>
                    <Text style={qStyles.stepperNum}>{quickExWalkCount}</Text>
                    <Text style={qStyles.stepperUnit}>{quickExWalkCount === 1 ? "walk" : "walks"}</Text>
                  </View>
                  <Pressable
                    style={qStyles.stepperBtn}
                    onPress={() => setQuickExWalkCount((n) => Math.min(10, n + 1))}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.primaryDark} />
                  </Pressable>
                </View>
              </>
            )}

            {/* Duration */}
            <Text style={qStyles.label}>Duration</Text>
            <View style={qStyles.durationGrid}>
              {["15","20","30","45","60","90"].map((d) => (
                <Pressable
                  key={d}
                  style={[qStyles.durChip, quickExDuration === d && qStyles.durChipActive]}
                  onPress={() => setQuickExDuration(d)}
                >
                  <Text style={[qStyles.durChipText, quickExDuration === d && qStyles.durChipTextActive]}>{d} min</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={qStyles.customInput}
              value={quickExDuration}
              onChangeText={setQuickExDuration}
              keyboardType="numeric"
              placeholder="Or type custom minutes…"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Pressable
              style={[qStyles.logBtn, (!quickExDuration || logExercise.isPending) && qStyles.logBtnDisabled]}
              onPress={() => {
                const mins = parseInt(quickExDuration, 10);
                if (!mins) return;
                logExercise.mutate({
                  activityType: quickExActivity,
                  durationMinutes: mins,
                  walkCount: quickExActivity === "walk" ? quickExWalkCount : null,
                }, {
                  onSuccess: () => {
                    setExerciseLogOpen(false);
                    setQuickExActivity("walk");
                    setQuickExWalkCount(1);
                    setQuickExDuration("30");
                  },
                });
              }}
              disabled={!quickExDuration || logExercise.isPending}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={qStyles.logBtnText}>{logExercise.isPending ? "Saving…" : "Log activity"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Care onboarding modal ── */}
      <Modal visible={onboardOpen} transparent animationType="fade" onRequestClose={() => setOnboardOpen(false)}>
        <View style={obStyles.backdrop}>
          <View style={obStyles.card}>
            {onboardStep === 0 && (
              <>
                <View style={obStyles.heroIcon}>
                  <Ionicons name="heart" size={36} color={theme.colors.primaryDark} />
                </View>
                <Text style={obStyles.heroTitle}>Let's set up {dog.data?.name ?? "your dog"}'s care profile</Text>
                <Text style={obStyles.heroSub}>
                  Track vaccinations, medications, exercise goals, and grooming schedules — all in one place.
                </Text>
                <View style={obStyles.featureList}>
                  {[
                    { icon: "shield-checkmark-outline", text: "Vaccine reminders before boosters are due" },
                    { icon: "medkit-outline", text: "Daily medication check-ins" },
                    { icon: "walk-outline", text: "Breed-based daily exercise goal" },
                    { icon: "cut-outline", text: "Grooming schedule with streak tracking" },
                  ].map((f) => (
                    <View key={f.icon} style={obStyles.featureRow}>
                      <Ionicons name={f.icon as never} size={18} color={theme.colors.primaryDark} />
                      <Text style={obStyles.featureText}>{f.text}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={obStyles.nextBtn} onPress={() => setOnboardStep(1)}>
                  <Text style={obStyles.nextBtnText}>Set up care profile</Text>
                </Pressable>
                <Pressable onPress={() => setOnboardOpen(false)} style={obStyles.skipBtn}>
                  <Text style={obStyles.skipText}>Maybe later</Text>
                </Pressable>
              </>
            )}

            {onboardStep === 1 && (
              <>
                <View style={obStyles.stepPill}><Text style={obStyles.stepPillText}>Step 1 of 3</Text></View>
                <Text style={obStyles.stepTitle}>Daily exercise goal</Text>
                <Text style={obStyles.stepSub}>
                  {dog.data?.breed
                    ? `Based on ${dog.data.breed}'s energy level, we recommend ${onboardGoal} min/day.`
                    : "Set a daily exercise target for your dog."}
                </Text>
                <View style={hStyles.goalRow}>
                  {[20, 30, 45, 60, 90, 120].map((m) => (
                    <Pressable
                      key={m}
                      style={[hStyles.goalChip, onboardGoal === m && hStyles.goalChipActive]}
                      onPress={() => setOnboardGoal(m)}
                    >
                      <Text style={[hStyles.goalChipText, onboardGoal === m && hStyles.goalChipTextActive]}>{m} min</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={obStyles.navRow}>
                  <Pressable style={obStyles.backBtn} onPress={() => setOnboardStep(0)}>
                    <Text style={obStyles.backBtnText}>Back</Text>
                  </Pressable>
                  <Pressable style={obStyles.nextBtn} onPress={() => setOnboardStep(2)}>
                    <Text style={obStyles.nextBtnText}>Next</Text>
                  </Pressable>
                </View>
              </>
            )}

            {onboardStep === 2 && (
              <>
                <View style={obStyles.stepPill}><Text style={obStyles.stepPillText}>Step 2 of 3</Text></View>
                <Text style={obStyles.stepTitle}>Vaccinations</Text>
                <Text style={obStyles.stepSub}>Head to the Vaccinations screen after setup to log your dog's vaccine history and set up reminders.</Text>
                <View style={obStyles.infoCard}>
                  {VACCINE_SCHEDULE.slice(0, 3).map((v) => (
                    <View key={v.key} style={obStyles.infoRow}>
                      <Ionicons name={v.required ? "shield-checkmark-outline" : "shield-outline"} size={16} color={v.required ? theme.colors.primaryDark : theme.colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={obStyles.infoLabel}>{v.name}</Text>
                        <Text style={obStyles.infoValue}>Every {v.intervalMonths} months{v.required ? " · core" : ""}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={obStyles.navRow}>
                  <Pressable style={obStyles.backBtn} onPress={() => setOnboardStep(1)}>
                    <Text style={obStyles.backBtnText}>Back</Text>
                  </Pressable>
                  <Pressable style={obStyles.nextBtn} onPress={() => setOnboardStep(3)}>
                    <Text style={obStyles.nextBtnText}>Next</Text>
                  </Pressable>
                </View>
              </>
            )}

            {onboardStep === 3 && (
              <>
                <View style={obStyles.stepPill}><Text style={obStyles.stepPillText}>Step 3 of 3</Text></View>
                <Text style={obStyles.stepTitle}>Grooming schedule</Text>
                <Text style={obStyles.stepSub}>We'll track when each grooming task is due and alert you when it's time.</Text>
                <View style={obStyles.infoCard}>
                  {GROOMING_TYPES.slice(0, 4).map((g) => (
                    <View key={g.key} style={obStyles.infoRow}>
                      <Ionicons name={g.icon as never} size={16} color={theme.colors.primaryDark} />
                      <View style={{ flex: 1 }}>
                        <Text style={obStyles.infoLabel}>{g.label}</Text>
                        <Text style={obStyles.infoValue}>Every {g.intervalDays === 1 ? "day" : `${g.intervalDays} days`}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={obStyles.navRow}>
                  <Pressable style={obStyles.backBtn} onPress={() => setOnboardStep(2)}>
                    <Text style={obStyles.backBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[obStyles.nextBtn, upsertProfile.isPending && { opacity: 0.6 }]}
                    onPress={completeOnboarding}
                    disabled={upsertProfile.isPending}
                  >
                    <Text style={obStyles.nextBtnText}>{upsertProfile.isPending ? "Saving…" : "All done!"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Setup sheet ── */}
      <Modal visible={setupOpen} transparent animationType="slide" onRequestClose={() => setSetupOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Daily Routine</Text>
            <Text style={styles.sheetSub}>Pick tasks to track each day and earn silver rewards.</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
              {defaultCareRoutineTemplates.map((t) => {
                const sel = selectedKeys.includes(t.routineKey);
                const def = routineIcon(t.iconKey);
                const pickerOpen = timePickerOpenFor === t.routineKey;
                const chosenTime = reminderTimes[t.routineKey];
                return (
                  <View key={t.routineKey}>
                    <Pressable
                      style={[styles.optionRow, sel && styles.optionRowSelected]}
                      onPress={() =>
                        setSelectedKeys((prev) =>
                          prev.includes(t.routineKey) ? prev.filter((k) => k !== t.routineKey) : [...prev, t.routineKey],
                        )
                      }
                    >
                      <View style={[styles.optionIcon, { backgroundColor: sel ? def.color : def.bg }]}>
                        <Ionicons name={def.name} size={20} color={sel ? "#fff" : def.color} />
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{t.title}</Text>
                        <Text style={styles.optionSub}>{t.description}</Text>
                      </View>
                      <View style={styles.optionReward}>
                        <Ionicons name="cash-outline" size={12} color={theme.colors.silver} />
                        <Text style={styles.optionRewardText}>+{t.silverReward}</Text>
                      </View>
                      <View style={[styles.optionCheck, sel && styles.optionCheckDone]}>
                        {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </Pressable>
                    {sel && (
                      <View style={styles.reminderRow}>
                        <Ionicons name="alarm-outline" size={14} color={theme.colors.textMuted} />
                        {!pickerOpen ? (
                          <Pressable
                            style={[styles.reminderChip, chosenTime && styles.reminderChipSet]}
                            onPress={() => void handleSetReminder(t.routineKey)}
                          >
                            <Text style={[styles.reminderChipText, chosenTime && styles.reminderChipTextSet]}>
                              {chosenTime ? fmtTime(chosenTime) : "Remind me"}
                            </Text>
                            {chosenTime && (
                              <Pressable
                                style={styles.reminderClear}
                                onPress={() => setReminderTimes((prev) => { const n = { ...prev }; delete n[t.routineKey]; return n; })}
                                hitSlop={8}
                              >
                                <Ionicons name="close-circle" size={14} color={theme.colors.primary} />
                              </Pressable>
                            )}
                          </Pressable>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll} contentContainerStyle={styles.timeScrollInner}>
                            {TIME_OPTIONS.map((opt) => (
                              <Pressable
                                key={opt}
                                style={[styles.timeChip, reminderTimes[t.routineKey] === opt && styles.timeChipActive]}
                                onPress={() => {
                                  setReminderTimes((prev) => ({ ...prev, [t.routineKey]: opt }));
                                  setTimePickerOpenFor(null);
                                }}
                              >
                                <Text style={[styles.timeChipText, reminderTimes[t.routineKey] === opt && styles.timeChipTextActive]}>
                                  {fmtTime(opt)}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Custom routines added this session */}
              {customList.map((t) => {
                const pickerOpen = timePickerOpenFor === t.routineKey;
                const chosenTime = reminderTimes[t.routineKey];
                return (
                  <View key={t.routineKey}>
                    <Pressable
                      style={[styles.optionRow, styles.optionRowSelected]}
                      onPress={() => setCustomList((prev) => prev.filter((x) => x.routineKey !== t.routineKey))}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: theme.colors.primaryDark }]}>
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{t.title}</Text>
                        <Text style={styles.optionSub}>{t.description}</Text>
                      </View>
                      <View style={styles.optionReward}>
                        <Ionicons name="cash-outline" size={12} color={theme.colors.silver} />
                        <Text style={styles.optionRewardText}>+{t.silverReward}</Text>
                      </View>
                      <View style={[styles.optionCheck, styles.optionCheckDone]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    </Pressable>
                    <View style={styles.reminderRow}>
                      <Ionicons name="alarm-outline" size={14} color={theme.colors.textMuted} />
                      {!pickerOpen ? (
                        <Pressable
                          style={[styles.reminderChip, chosenTime && styles.reminderChipSet]}
                          onPress={() => void handleSetReminder(t.routineKey)}
                        >
                          <Text style={[styles.reminderChipText, chosenTime && styles.reminderChipTextSet]}>
                            {chosenTime ? fmtTime(chosenTime) : "Remind me"}
                          </Text>
                          {chosenTime && (
                            <Pressable
                              style={styles.reminderClear}
                              onPress={() => setReminderTimes((prev) => { const n = { ...prev }; delete n[t.routineKey]; return n; })}
                              hitSlop={8}
                            >
                              <Ionicons name="close-circle" size={14} color={theme.colors.primary} />
                            </Pressable>
                          )}
                        </Pressable>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll} contentContainerStyle={styles.timeScrollInner}>
                          {TIME_OPTIONS.map((opt) => (
                            <Pressable
                              key={opt}
                              style={[styles.timeChip, reminderTimes[t.routineKey] === opt && styles.timeChipActive]}
                              onPress={() => {
                                setReminderTimes((prev) => ({ ...prev, [t.routineKey]: opt }));
                                setTimePickerOpenFor(null);
                              }}
                            >
                              <Text style={[styles.timeChipText, reminderTimes[t.routineKey] === opt && styles.timeChipTextActive]}>
                                {fmtTime(opt)}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Add custom */}
              {!addingCustom ? (
                <Pressable style={styles.addCustomTrigger} onPress={() => setAddingCustom(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.primaryDark} />
                  <Text style={styles.addCustomTriggerText}>Add custom routine</Text>
                </Pressable>
              ) : (
                <View style={styles.customForm}>
                  <Text style={styles.customFormTitle}>Custom Routine</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Brush teeth, brush fur..."
                    placeholderTextColor={theme.colors.textSubtle}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    accessibilityLabel="Custom routine name"
                  />
                  <View style={styles.customFormRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Short description"
                      placeholderTextColor={theme.colors.textSubtle}
                      value={customDesc}
                      onChangeText={setCustomDesc}
                      accessibilityLabel="Custom routine description"
                    />
                    <View style={styles.rewardPicker}>
                      {["5","10"].map((v) => (
                        <Pressable
                          key={v}
                          style={[styles.rewardChip, customReward === v && styles.rewardChipActive]}
                          onPress={() => setCustomReward(v)}
                        >
                          <Text style={[styles.rewardChipText, customReward === v && styles.rewardChipTextActive]}>+{v}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.customFormBtns}>
                    <Pressable style={styles.cancelBtn} onPress={() => setAddingCustom(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.confirmBtn} onPress={addCustom}>
                      <Text style={styles.confirmBtnText}>Add Routine</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>

            {saveRoutines.error ? <Text style={styles.errorText}>{saveRoutines.error.message}</Text> : null}

            <Pressable
              style={[styles.saveBtn, saveRoutines.isPending && styles.saveBtnDisabled]}
              disabled={saveRoutines.isPending}
              onPress={saveRoutineSetup}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{saveRoutines.isPending ? "Saving…" : "Save Routine"}</Text>
            </Pressable>
            <Pressable style={styles.laterBtn} onPress={() => setSetupOpen(false)}>
              <Text style={styles.laterBtnText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const WeekView = ({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: CareEvent[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const anchor = new Date(selectedDate + "T00:00:00");
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - anchor.getDay());
  const eventDates = useMemo(() => new Set(events.map((e) => e.startTime.slice(0, 10))), [events]);

  const days = WEEK_LABELS.map((label, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { iso, day: d.getDate(), label, isToday: iso === todayISO };
  });

  const prevWeek = () => { const d = new Date(selectedDate + "T00:00:00"); d.setDate(d.getDate() - 7); onSelectDate(d.toISOString().slice(0, 10)); };
  const nextWeek = () => { const d = new Date(selectedDate + "T00:00:00"); d.setDate(d.getDate() + 7); onSelectDate(d.toISOString().slice(0, 10)); };

  const weekLabel = `${sunday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].day}`;

  return (
    <View style={wStyles.wrap}>
      <View style={wStyles.nav}>
        <Pressable style={wStyles.navBtn} onPress={prevWeek}><Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} /></Pressable>
        <Text style={wStyles.navLabel}>{weekLabel}</Text>
        <Pressable style={wStyles.navBtn} onPress={nextWeek}><Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} /></Pressable>
      </View>
      <View style={wStyles.strip}>
        {days.map(({ iso, day, label, isToday }) => {
          const isSel = iso === selectedDate;
          const hasEv = eventDates.has(iso);
          return (
            <Pressable key={iso} style={wStyles.dayCol} onPress={() => onSelectDate(iso)} accessibilityRole="button">
              <Text style={[wStyles.dayLabel, isToday && wStyles.dayLabelToday]}>{label}</Text>
              <View style={[wStyles.dayCircle, isToday && !isSel && wStyles.dayCircleToday, isSel && wStyles.dayCircleSel]}>
                <Text style={[wStyles.dayNum, (isToday && !isSel) && wStyles.dayNumToday, isSel && wStyles.dayNumSel]}>{day}</Text>
              </View>
              <View style={[wStyles.dot, hasEv && (isSel ? wStyles.dotSel : wStyles.dotActive)]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const MonthView = ({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: CareEvent[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) => {
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const eventDates = useMemo(() => new Set(events.map((e) => e.startTime.slice(0, 10))), [events]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const prev = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const next = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  return (
    <View style={mStyles.wrap}>
      <View style={mStyles.nav}>
        <Pressable style={wStyles.navBtn} onPress={prev}><Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} /></Pressable>
        <Text style={mStyles.navLabel}>{MONTH_NAMES[month]} {year}</Text>
        <Pressable style={wStyles.navBtn} onPress={next}><Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} /></Pressable>
      </View>
      <View style={mStyles.weekRow}>{WEEK_LABELS.map((d) => <Text key={d} style={mStyles.weekLabel}>{d}</Text>)}</View>
      {rows.map((row, ri) => (
        <View key={ri} style={mStyles.gridRow}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={mStyles.cell} />;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = iso === todayISO;
            const isSel = iso === selectedDate;
            const hasEv = eventDates.has(iso);
            return (
              <Pressable key={di} style={mStyles.cell} onPress={() => onSelectDate(iso)} accessibilityRole="button">
                <View style={[mStyles.circle, isToday && !isSel && mStyles.circleToday, isSel && mStyles.circleSel]}>
                  <Text style={[mStyles.num, isToday && !isSel && mStyles.numToday, isSel && mStyles.numSel]}>{day}</Text>
                </View>
                <View style={[mStyles.dot, hasEv && (isSel ? mStyles.dotSel : mStyles.dotActive)]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const ScheduleRow = ({ event, index }: { event: CareEvent; index: number }) => {
  const palettes = [
    { bg: "#EAF2FF", fg: "#4A78E0" },
    { bg: "#FFF0EC", fg: "#D9604A" },
    { bg: "#EDE4FF", fg: "#8B5CF6" },
  ];
  const pal = palettes[index % 3];
  const def = eventIcon(event.eventType);
  return (
    <View style={sStyles.row}>
      <View style={[sStyles.icon, { backgroundColor: pal.bg }]}>
        <Ionicons name={def.name} size={20} color={pal.fg} />
      </View>
      <View style={sStyles.copy}>
        <Text style={sStyles.title} numberOfLines={1}>{event.title}</Text>
        <Text style={sStyles.sub} numberOfLines={1}>{event.eventType} · {event.description || "Care reminder"}</Text>
        <View style={sStyles.dateRow}>
          <Ionicons name="calendar-outline" size={11} color={pal.fg} />
          <Text style={[sStyles.date, { color: pal.fg }]}>
            {new Date(event.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      </View>
      <View style={[sStyles.daysBox, { backgroundColor: pal.bg }]}>
        <Text style={[sStyles.daysNum, { color: pal.fg }]}>{daysUntil(event.startTime)}</Text>
        <Text style={[sStyles.daysLabel, { color: pal.fg }]}>days</Text>
      </View>
    </View>
  );
};


const TaskItem = ({
  icon, title, subtitle, done, onComplete, onDelete,
}: {
  icon: IconDef;
  title: string;
  subtitle: string;
  done: boolean;
  onComplete: () => void;
  onDelete?: () => void;
}) => (
  <View style={[tStyles.row, done && tStyles.rowDone]}>
    {/* Tap to complete — left circle */}
    <Pressable
      style={[tStyles.check, done && tStyles.checkDone]}
      onPress={!done ? onComplete : undefined}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? `${title} completed` : `Mark ${title} done`}
      hitSlop={6}
    >
      {done && <Ionicons name="checkmark" size={14} color="#fff" />}
    </Pressable>

    {/* Icon */}
    <View style={[tStyles.icon, { backgroundColor: done ? icon.color + "88" : icon.bg }]}>
      <Ionicons name={icon.name} size={18} color={done ? "#fff" : icon.color} />
    </View>

    {/* Text */}
    <Pressable style={tStyles.copy} onPress={!done ? onComplete : undefined}>
      <Text style={[tStyles.title, done && tStyles.titleDone]} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={tStyles.sub} numberOfLines={1}>{subtitle}</Text> : null}
    </Pressable>

    {/* Delete — only on incomplete tasks */}
    {onDelete && !done ? (
      <Pressable onPress={onDelete} hitSlop={10} style={tStyles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Remove ${title}`}>
        <Ionicons name="trash-outline" size={16} color={theme.colors.textSubtle} />
      </Pressable>
    ) : null}
  </View>
);

// ── Scoped stylesheet blocks ──────────────────────────────────────────────────

const wStyles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.text },
  strip: { flexDirection: "row" },
  dayCol: { flex: 1, alignItems: "center", gap: 4 },
  dayLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted },
  dayLabelToday: { color: theme.colors.primaryDark },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { borderWidth: 1.5, borderColor: theme.colors.primaryDark },
  dayCircleSel: { backgroundColor: theme.colors.primaryDark },
  dayNum: { fontSize: theme.typography.sm, fontWeight: "700", color: theme.colors.text },
  dayNumToday: { color: theme.colors.primaryDark, fontWeight: "900" },
  dayNumSel: { color: "#fff", fontWeight: "900" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent" },
  dotActive: { backgroundColor: theme.colors.primary },
  dotSel: { backgroundColor: "#fff" },
});

const mStyles = StyleSheet.create({
  wrap: { gap: 6 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navLabel: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  weekRow: { flexDirection: "row" },
  weekLabel: { flex: 1, textAlign: "center", fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  gridRow: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  circleToday: { borderWidth: 1.5, borderColor: theme.colors.primaryDark },
  circleSel: { backgroundColor: theme.colors.primaryDark },
  num: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.text },
  numToday: { color: theme.colors.primaryDark, fontWeight: "900" },
  numSel: { color: "#fff", fontWeight: "900" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent", marginTop: 1 },
  dotActive: { backgroundColor: theme.colors.primary },
  dotSel: { backgroundColor: "#fff" },
});

const sStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  icon: { width: 40, height: 40, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.text },
  sub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 1 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  date: { fontSize: theme.typography.xs },
  daysBox: { width: 48, height: 48, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  daysNum: { fontSize: theme.typography.md, fontWeight: "900" },
  daysLabel: { fontSize: 10, fontWeight: "700" },
});

const tStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, minHeight: 52 },
  rowDone: { opacity: 0.55 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  icon: { width: 38, height: 38, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.text },
  titleDone: { textDecorationLine: "line-through", color: theme.colors.textSubtle },
  sub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 1 },
  deleteBtn: { paddingHorizontal: 4, flexShrink: 0 },
});

// ── Quick log modal styles ─────────────────────────────────────────────────────

const qStyles = StyleSheet.create({
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative" },
  closeBtn: { position: "absolute", right: 0, top: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900", color: theme.colors.text, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  actRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  actChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  actChipText: { fontSize: 13, fontWeight: "700", color: theme.colors.primaryDark },
  actChipTextActive: { color: "#fff" },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 0, backgroundColor: theme.colors.cardMuted, borderRadius: 16, paddingVertical: 8, marginBottom: 20 },
  stepperBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  stepperValue: { flex: 1, alignItems: "center" },
  stepperNum: { fontSize: 28, fontWeight: "900", color: theme.colors.primaryDark },
  stepperUnit: { fontSize: 11, fontWeight: "600", color: theme.colors.textMuted, marginTop: -2 },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  durChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  durChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  durChipText: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  durChipTextActive: { color: "#fff" },
  customInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.card, marginBottom: 20 },
  logBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 16 },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { fontSize: 16, fontWeight: "900", color: "#fff" },
});

// ── Main stylesheet ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingBottom: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  title: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.3 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  tabBar: { flexDirection: "row", backgroundColor: theme.colors.cardMuted, borderRadius: 12, padding: 3, marginBottom: theme.spacing.md, gap: 2 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: theme.colors.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.colors.textMuted },
  tabTextActive: { color: theme.colors.primaryDark, fontWeight: "800" },

  nudge: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.md, ...theme.shadows.soft },
  nudgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  nudgeCopy: { flex: 1, minWidth: 0 },
  nudgeTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  nudgeSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 2 },

  card: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.soft },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  cardTitle: { flex: 1, minWidth: 0, fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text },

  calTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm, flexWrap: "wrap" },
  segPill: { flexDirection: "row", backgroundColor: theme.colors.cardMuted, borderRadius: 999, padding: 3, gap: 2, flexShrink: 0 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  segBtnActive: { backgroundColor: theme.colors.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segText: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  segTextActive: { color: theme.colors.text, fontWeight: "900" },
  todayChip: { borderRadius: 999, backgroundColor: theme.colors.cardMuted, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
  todayChipText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },

  addEventBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, borderRadius: 999, backgroundColor: theme.colors.primaryDark },
  addEventText: { color: "#fff", fontSize: theme.typography.xs, fontWeight: "900" },

  dayEventsPanel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md, gap: theme.spacing.sm },
  dayEventsLabel: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  addLink: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  addLinkText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.primaryDark },
  emptyBox: { alignItems: "center", paddingVertical: theme.spacing.lg, gap: theme.spacing.sm },
  emptyText: { fontSize: theme.typography.sm, color: theme.colors.textMuted },
  emptyBtn: { borderRadius: 999, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 16, paddingVertical: 8 },
  emptyBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },

  silverChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: theme.colors.silverSoft, paddingHorizontal: 10, paddingVertical: 4 },
  silverChipText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.silver },
  allDoneChip: { borderRadius: 999, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4 },
  allDoneText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.primaryDark },
  rewardHint: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: theme.colors.goldSoft, paddingHorizontal: 10, paddingVertical: 4 },
  rewardHintText: { fontSize: theme.typography.xs, fontWeight: "700", color: "#8B6800" },
  goldBarSm: { width: 16, height: 9, borderRadius: 2, backgroundColor: theme.colors.gold, borderBottomWidth: 1.5, borderBottomColor: "#A07800" },
  progressWrap: { gap: 6 },
  progressMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressMsg: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  progressCount: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },

  setupCta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.md, paddingHorizontal: 14, paddingVertical: 12 },
  setupCtaText: { flex: 1, fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.primaryDark },

  disclaimer: { fontSize: theme.typography.xs, color: theme.colors.textSubtle, textAlign: "center", lineHeight: 16 },

  // Sheet
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,28,22,0.45)" },
  sheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.lg, gap: theme.spacing.md, maxHeight: "88%", ...theme.shadows.raised },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: theme.colors.border, alignSelf: "center" },
  sheetTitle: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text, textAlign: "center" },
  sheetSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, textAlign: "center", lineHeight: 18 },
  sheetScroll: { flexGrow: 0 },

  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: theme.radii.md, borderWidth: 1.5, borderColor: "transparent", marginBottom: 6 },
  optionRowSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft + "44" },
  optionIcon: { width: 40, height: 40, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.text },
  optionSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 1 },
  optionReward: { flexDirection: "row", alignItems: "center", gap: 3 },
  optionRewardText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.silver },
  optionCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionCheckDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },

  addCustomTrigger: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  addCustomTriggerText: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.primaryDark },

  customForm: { borderRadius: theme.radii.md, backgroundColor: theme.colors.backgroundSoft, padding: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  customFormTitle: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.text },
  input: { minHeight: 40, borderRadius: theme.radii.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, color: theme.colors.text, fontSize: theme.typography.xs, paddingHorizontal: 10 },
  customFormRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  rewardPicker: { flexDirection: "row", gap: 6, flexShrink: 0 },
  rewardChip: { borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  rewardChipActive: { borderColor: theme.colors.silver, backgroundColor: theme.colors.silverSoft },
  rewardChipText: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  rewardChipTextActive: { color: theme.colors.silver, fontWeight: "800" },
  customFormBtns: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },
  confirmBtn: { flex: 1, minHeight: 36, borderRadius: 999, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },

  reminderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingBottom: 8, flexWrap: "wrap" },
  reminderChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  reminderChipSet: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  reminderChipText: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  reminderChipTextSet: { color: theme.colors.primaryDark, fontWeight: "800" },
  reminderClear: { marginLeft: 2 },
  timeScroll: { flex: 1 },
  timeScrollInner: { flexDirection: "row", gap: 6, paddingRight: 4 },
  timeChip: { borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  timeChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryDark },
  timeChipText: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  timeChipTextActive: { color: "#fff", fontWeight: "800" },

  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 999, backgroundColor: theme.colors.primaryDark },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { fontSize: theme.typography.sm, fontWeight: "900", color: "#fff" },
  laterBtn: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  laterBtnText: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.primaryDark },
  errorText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.error, textAlign: "center" },
});

// ── Health section styles ─────────────────────────────────────────────────────

const hStyles = StyleSheet.create({
  exerciseCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 16, marginBottom: 10, ...theme.shadows.soft },
  ringWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ringTrack: { width: 64, height: 64, borderRadius: 32, borderWidth: 7, borderColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  ringFill: { position: "absolute", width: 64, height: 64, borderRadius: 32, borderWidth: 7, borderColor: "transparent", borderTopColor: theme.colors.primaryDark },
  ringCenter: { flexDirection: "row", alignItems: "baseline", gap: 1 },
  ringNum: { fontSize: 16, fontWeight: "900", color: theme.colors.primaryDark },
  ringSub: { fontSize: 10, color: theme.colors.textMuted, fontWeight: "600" },
  exerciseBody: { flex: 1 },
  exerciseTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  exerciseSub: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 6 },
  exerciseBar: { height: 4, borderRadius: 2, backgroundColor: theme.colors.primarySoft, overflow: "hidden" },
  exerciseBarFill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.primaryDark },
  quickLogBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  alertRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  alertCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 12, alignItems: "center", gap: 4, ...theme.shadows.soft },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  alertLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted },
  alertCount: { fontSize: 11, fontWeight: "800", color: theme.colors.primaryDark, textAlign: "center" },
  alertCountRed: { color: theme.colors.error },
  alertCountAmber: { color: "#C47A2B" },
  groomingStrip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF3CD", borderRadius: theme.radii.md, padding: 10, marginBottom: 10 },
  groomingStripText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#C47A2B" },
  goalRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 16 },
  goalChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border },
  goalChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  goalChipText: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  goalChipTextActive: { color: "#fff" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border },
  durationChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  durationChipText: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  durationChipTextActive: { color: "#fff" },
  durationInput: { marginTop: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.card },

  // Health tab cards
  healthCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: 16, marginBottom: 10, ...theme.shadows.soft },
  healthCardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  healthIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  healthBody: { flex: 1 },
  healthTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  healthStatus: { fontSize: 12, fontWeight: "600", color: theme.colors.textMuted },
  healthStatusRed: { color: theme.colors.error },
  healthStatusAmber: { color: "#C47A2B" },
  healthStatusGreen: { color: theme.colors.success },
  healthDetail: { fontSize: 11, color: theme.colors.textSubtle, marginTop: 2 },

  // Small ring for health tab exercise card
  ringWrapSm: { width: 48, height: 48, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ringTrackSm: { width: 48, height: 48, borderRadius: 24, borderWidth: 5, borderColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  ringFillSm: { position: "absolute", width: 48, height: 48, borderRadius: 24, borderWidth: 5, borderColor: "transparent", borderTopColor: theme.colors.primaryDark },
  ringCenterSm: { alignItems: "center" },
  ringNumSm: { fontSize: 13, fontWeight: "900", color: theme.colors.primaryDark },
});

// ── Activity hero + smart alert styles ───────────────────────────────────────

const aStyles = StyleSheet.create({
  // Steps hero card
  heroCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: 16,
    gap: 12,
    ...theme.shadows.soft,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  // Ring
  ringWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" },
  ringTrack: { width: 80, height: 80, borderRadius: 40, borderWidth: 9, borderColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  ringFill: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 9, borderColor: "transparent", borderTopColor: theme.colors.primaryDark },
  ringInner: { alignItems: "center", justifyContent: "center" },
  ringBadge: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: theme.colors.card },

  // Stats block
  statsBlock: { flex: 1, gap: 3 },
  statsRow: { flexDirection: "row", alignItems: "baseline" },
  stepCount: { fontSize: 32, fontWeight: "900", color: theme.colors.text, letterSpacing: -1 },
  stepUnit: { fontSize: 14, fontWeight: "700", color: theme.colors.textMuted },
  stepGoal: { fontSize: 12, fontWeight: "600", color: theme.colors.textMuted },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: theme.colors.primarySoft, overflow: "hidden", marginTop: 4 },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: theme.colors.primaryDark },
  progressLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.primaryDark },

  logBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },

  // Water row
  waterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waterLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  waterLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  waterCounter: { flexDirection: "row", alignItems: "center", gap: 6 },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  counterDisplay: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 80, justifyContent: "center" },
  counterText: { fontSize: 13, fontWeight: "800", color: theme.colors.text, marginLeft: 4 },

  // Smart alert banners
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: theme.radii.lg, paddingHorizontal: 14, paddingVertical: 12 },
  alertIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  alertText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },

  // Add task row — persistent at bottom of task list
  addTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    paddingBottom: 2,
  },
  addTaskIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addTaskText: { fontSize: 14, fontWeight: "700", color: theme.colors.primaryDark, opacity: 0.8 },
});

// ── Add-task modal styles ─────────────────────────────────────────────────────

const { taskModalSheet, taskModalTitle, taskModalSub, taskModalGrid, taskModalChip, taskModalChipActive, taskModalChipText, taskModalChipTextActive, taskModalInputWrap, taskModalInput, taskModalInputClear, taskModalSaveBtn, taskModalSaveBtnDisabled, taskModalSaveBtnText } = StyleSheet.create({
  taskModalSheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  taskModalTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  taskModalSub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 20 },
  taskModalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  taskModalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    minWidth: "44%",
    flex: 1,
  },
  taskModalChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  taskModalChipText: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  taskModalChipTextActive: { color: "#fff" },
  taskModalInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radii.md, backgroundColor: theme.colors.card, paddingHorizontal: 14, marginBottom: 20 },
  taskModalInput: { flex: 1, fontSize: 15, color: theme.colors.text, paddingVertical: 12 },
  taskModalInputClear: { paddingLeft: 8 },
  taskModalSaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 15 },
  taskModalSaveBtnDisabled: { opacity: 0.4 },
  taskModalSaveBtnText: { fontSize: 15, fontWeight: "900", color: "#fff" },
});

// ── Care setup hero card styles ──────────────────────────────────────────────

const heroStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    ...theme.shadows.soft,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.75)", marginTop: 2 },

  section: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingBottom: 16,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionHint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundSoft,
  },
  chipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  chipTextActive: { color: "#fff" },

  routineGrid: { gap: 8 },
  routineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundSoft,
  },
  routineChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft + "55",
  },
  routineChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  routineChipText: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.colors.textMuted },
  routineChipTextActive: { color: theme.colors.primaryDark },

  groomRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groomItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groomLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.primaryDark },
  groomInterval: { fontSize: 11, fontWeight: "600", color: theme.colors.primary },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 18,
    marginBottom: 10,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
    paddingVertical: 16,
    minHeight: 54,
  },
  ctaLoading: { opacity: 0.6 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#fff" },

  skip: { alignItems: "center", paddingVertical: 10, marginBottom: 6 },
  skipText: { fontSize: 13, fontWeight: "700", color: theme.colors.textMuted },
});

// ── Onboarding modal styles ───────────────────────────────────────────────────

const obStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: theme.colors.background, borderRadius: 24, padding: 24, width: "100%", maxWidth: 400 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontSize: 20, fontWeight: "900", color: theme.colors.text, marginBottom: 8 },
  heroSub: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 20 },
  featureList: { gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureText: { fontSize: 14, color: theme.colors.text, flex: 1, lineHeight: 20 },
  stepPill: { alignSelf: "flex-start", backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  stepPillText: { fontSize: 11, fontWeight: "800", color: theme.colors.primaryDark },
  stepTitle: { fontSize: 20, fontWeight: "900", color: theme.colors.text, marginBottom: 6 },
  stepSub: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 8 },
  infoCard: { backgroundColor: theme.colors.cardMuted, borderRadius: theme.radii.md, padding: 14, gap: 12, marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  infoValue: { fontSize: 12, color: theme.colors.textMuted },
  navRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  backBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border },
  backBtnText: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  nextBtn: { flex: 1, backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 14, alignItems: "center" },
  nextBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  skipBtn: { alignItems: "center", marginTop: 12, paddingVertical: 6 },
  skipText: { fontSize: 14, color: theme.colors.textMuted },
});
