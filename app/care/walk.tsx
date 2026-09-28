import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  SlideInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CaretLeftIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { HoldToEnd } from "@/features/care/walk/HoldToEnd";
import { GoogleWalkMap, type MapMode } from "@/features/care/walk/GoogleWalkMap";
import { useWalkTracker } from "@/features/care/walk/useWalkTracker";
import {
  HOME,
  MOCK_ROUTES,
  formatClock,
  formatPace,
  suggestRoutes,
  type WalkRoute,
} from "@/features/care/walk/walkRoutes";
import { scheduleWalk, useCareOnboarding } from "@/features/care/state/careOnboarding";
import { PressScale } from "@/components/ui/PressScale";
import { useCareRoutines, useCompleteCareRoutine } from "@/hooks/useCareEvents";
import { useLogExercise } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

type Phase = "plan" | "walking" | "done" | "scheduled";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const slotLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;

const upcomingSlots = (now: Date, taken: readonly string[]) => {
  const start = Math.ceil((now.getHours() * 60 + now.getMinutes() + 20) / 30) * 30;
  const out: string[] = [];
  for (let m = Math.max(start, 6 * 60); m <= 22 * 60 + 30 && out.length < 3; m += 30) {
    const slot = slotLabel(m);
    if (!taken.includes(slot)) out.push(slot);
  }
  return out;
};

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation();

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";

  const { choice } = useCareOnboarding();
  const [routes, setRoutes] = useState<readonly WalkRoute[]>(MOCK_ROUTES);
  const [routeId, setRouteId] = useState(MOCK_ROUTES[0].id);
  const [when, setWhen] = useState<string>("now");
  const [phase, setPhase] = useState<Phase>("plan");
  const [paused, setPaused] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const walk = useWalkTracker(route, phase === "walking" && !paused);

  const logExercise = useLogExercise(dogId);
  const routines = useCareRoutines(dogId);
  const completeRoutine = useCompleteCareRoutine(dogId, isoDate(new Date()));

  const slots = useMemo(
    () => (choice ? upcomingSlots(new Date(), choice.walkTimes ?? []) : []),
    [choice],
  );

  useEffect(() => {
    let live = true;
    void suggestRoutes(HOME).then((found) => {
      if (live && found.length > 0) setRoutes(found);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: phase === "plan" || phase === "scheduled" });
  }, [navigation, phase]);

  const mode: MapMode = phase === "walking" ? "walking" : phase === "done" ? "done" : "plan";

  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPaused(false);
    setPhase("walking");
  };

  const schedule = () => {
    if (scheduleWalk(when, { name: route.name, minutes: route.minutes })) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("scheduled");
    }
  };

  const save = () => {
    setSaveError(false);
    logExercise.mutate(
      {
        activityType: "walk",
        durationMinutes: Math.max(1, Math.round(walk.elapsed / 60)),
        distanceMiles: Math.round(walk.distanceKm * 0.621371 * 100) / 100,
        walkCount: 1,
        notes: route.name,
      },
      {
        onSuccess: () => {
          const walkRoutine = routines.data?.find((item) => item.iconKey === "walk");
          if (walkRoutine) completeRoutine.mutate(walkRoutine.id);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          goBack("/(tabs)/care");
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setSaveError(true);
        },
      },
    );
  };

  const enterContent = reduceMotion
    ? undefined
    : FadeIn.duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });

  return (
    <View style={styles.screen}>
      <GoogleWalkMap
        routes={routes}
        selectedId={route.id}
        mode={mode}
        progress={walk.progress}
        position={walk.position}
        trail={walk.trail}
      />

      {phase === "plan" || phase === "scheduled" ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
          style={[styles.topBar, { top: insets.top + space.sm }]}
        >
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.floatButton}
            onPress={() => goBack("/(tabs)/care")}
          >
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Past walks"
            style={styles.floatButton}
            onPress={() => router.push("/care/exercise")}
          >
            <ClockCounterClockwiseIcon size={iconSize.nav} color={text.primary} weight="regular" />
          </PressScale>
        </Animated.View>
      ) : null}

      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)
        }
        layout={
          reduceMotion
            ? undefined
            : LinearTransition.duration(300).easing(motion.easing.drawer)
        }
        style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
      >
        <View style={styles.grabber} />

        <Animated.View key={phase} entering={enterContent}>
          {phase === "plan" ? (
            <Plan
              name={name}
              routes={routes}
              route={route}
              when={when}
              slots={slots}
              onRoute={(id) => {
                void Haptics.selectionAsync();
                setRouteId(id);
              }}
              onWhen={(next) => {
                void Haptics.selectionAsync();
                setWhen(next);
              }}
              onStart={start}
              onSchedule={schedule}
            />
          ) : phase === "walking" ? (
            <Walking
              name={name}
              route={route}
              elapsed={walk.elapsed}
              distanceKm={walk.distanceKm}
              progress={walk.progress}
              locationDenied={walk.permission === "denied" || walk.permission === "unavailable"}
              paused={paused}
              onPause={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setPaused((value) => !value);
              }}
              onEnd={() => setPhase("done")}
            />
          ) : phase === "done" ? (
            <Done
              name={name}
              route={route}
              elapsed={walk.elapsed}
              distanceKm={walk.distanceKm}
              progress={walk.progress}
              saving={logExercise.isPending}
              error={saveError}
              onSave={save}
              onDiscard={() => goBack("/(tabs)/care")}
            />
          ) : (
            <Scheduled
              name={name}
              route={route}
              time={when}
              onDone={() => goBack("/(tabs)/care")}
              onWalkNow={() => {
                setWhen("now");
                start();
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const Headline = ({ lead, focus }: { lead: string; focus: string }) => (
  <Text style={styles.headline} accessibilityRole="header">
    <Text style={styles.headlineLead}>{lead}</Text>
    {"\n"}
    {focus}
  </Text>
);

const Plan = ({
  name,
  routes,
  route,
  when,
  slots,
  onRoute,
  onWhen,
  onStart,
  onSchedule,
}: {
  name: string;
  routes: readonly WalkRoute[];
  route: WalkRoute;
  when: string;
  slots: readonly string[];
  onRoute: (id: string) => void;
  onWhen: (when: string) => void;
  onStart: () => void;
  onSchedule: () => void;
}) => {
  const now = when === "now";
  return (
    <View>
      <Animated.View key={route.id} entering={FadeIn.duration(motion.duration.select)}>
        <Headline lead={`${route.minutes} min with ${name}`} focus={route.name} />
      </Animated.View>

      <View style={styles.routes} accessibilityRole="radiogroup">
        {routes.map((item) => {
          const on = item.id === route.id;
          return (
            <PressScale
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.name}, ${item.distanceKm} kilometres, about ${item.minutes} minutes. ${item.note}`}
              scaleTo={0.96}
              style={[styles.route, on && styles.routeOn]}
              onPress={() => onRoute(item.id)}
            >
              <Text style={styles.routeKm}>
                {item.distanceKm}
                <Text style={styles.routeUnit}> km</Text>
              </Text>
              <Text style={styles.routeName} numberOfLines={2}>
                {item.name}
              </Text>
            </PressScale>
          );
        })}
      </View>
      <Text style={styles.routeNote}>{route.note}</Text>

      {slots.length > 0 ? (
        <View style={styles.whenRow} accessibilityRole="radiogroup">
          {["now", ...slots].map((slot) => {
            const on = slot === when;
            return (
              <PressScale
                key={slot}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={slot === "now" ? "Walk now" : `Schedule for ${prettyTime(slot)}`}
                scaleTo={0.94}
                style={[styles.when, on && styles.whenOn]}
                onPress={() => onWhen(slot)}
              >
                <Text style={[styles.whenText, on && styles.whenTextOn]}>
                  {slot === "now" ? "Now" : prettyTime(slot)}
                </Text>
              </PressScale>
            );
          })}
        </View>
      ) : null}

      <PressScale
        accessibilityRole="button"
        accessibilityLabel={now ? `Start the walk on ${route.name}` : `Schedule ${route.name} for ${prettyTime(when)}`}
        scaleTo={0.97}
        style={styles.cta}
        onPress={now ? onStart : onSchedule}
      >
        <Animated.View
          key={now ? "start" : "schedule"}
          entering={FadeIn.duration(motion.duration.select)}
          style={styles.ctaInner}
        >
          <Text style={styles.ctaText}>{now ? "Start walk" : `Schedule for ${prettyTime(when)}`}</Text>
          {now ? (
            <ArrowRightIcon size={iconSize.button} color={text.primary} weight="bold" />
          ) : (
            <CalendarCheckIcon size={iconSize.button} color={text.primary} weight="bold" />
          )}
        </Animated.View>
      </PressScale>
    </View>
  );
};

const Walking = ({
  name,
  route,
  elapsed,
  distanceKm,
  progress,
  paused,
  locationDenied,
  onPause,
  onEnd,
}: {
  name: string;
  route: WalkRoute;
  elapsed: number;
  distanceKm: number;
  progress: number;
  paused: boolean;
  locationDenied: boolean;
  onPause: () => void;
  onEnd: () => void;
}) => (
  <View>
    {locationDenied ? (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Location is off. Open Settings to turn it on for PAWS."
        scaleTo={0.98}
        style={styles.locationNotice}
        onPress={() => void Linking.openSettings()}
      >
        <Text style={styles.locationNoticeText}>
          Location is off, so distance is not tracking. Tap to open Settings.
        </Text>
      </PressScale>
    ) : null}

    <View style={styles.status}>
      <View style={[styles.statusDot, paused && styles.statusDotPaused]} />
      <Text style={styles.statusText} numberOfLines={1}>
        {paused ? `Paused on ${route.name}` : `Walking ${name} on ${route.name}`}
      </Text>
    </View>

    <Text
      style={[styles.timer, paused && styles.timerPaused]}
      accessibilityLabel={`Time ${formatClock(elapsed)}`}
    >
      {formatClock(elapsed)}
    </Text>

    <View style={styles.figures}>
      <Figure value={distanceKm.toFixed(2)} unit="km" label="Distance" />
      <View style={styles.figureRule} />
      <Figure value={formatPace(elapsed, distanceKm)} unit={distanceKm < 0.02 ? undefined : "/km"} label="Pace" />
      <View style={styles.figureRule} />
      <Figure value={String(Math.round(progress * 100))} unit="%" label="Of the route" />
    </View>

    <View style={styles.controls}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={paused ? "Resume the walk" : "Pause the walk"}
        scaleTo={0.92}
        style={[styles.pause, paused && styles.pauseOn]}
        onPress={onPause}
      >
        <Animated.View key={paused ? "play" : "pause"} entering={FadeIn.duration(motion.duration.select)}>
          {paused ? (
            <PlayIcon size={24} color={text.primary} weight="fill" />
          ) : (
            <PauseIcon size={24} color={text.primary} weight="fill" />
          )}
        </Animated.View>
      </PressScale>
      <HoldToEnd onEnd={onEnd} />
    </View>
  </View>
);

const Done = ({
  name,
  route,
  elapsed,
  distanceKm,
  progress,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  name: string;
  route: WalkRoute;
  elapsed: number;
  distanceKm: number;
  progress: number;
  saving: boolean;
  error: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) => (
  <View>
    <Headline
      lead={`Good walk, ${name}.`}
      focus={`${distanceKm.toFixed(2)} km in ${formatClock(elapsed)}.`}
    />

    <View style={styles.facts}>
      <Fact label="Route" value={`${route.name}, ${Math.round(progress * 100)}%`} />
      <Fact ruled label="Average pace" value={distanceKm < 0.02 ? "Not enough distance" : `${formatPace(elapsed, distanceKm)} per km`} />
    </View>

    {error ? (
      <Text style={styles.error}>Not saved. PAWS could not reach the server, so try again in a moment.</Text>
    ) : null}

    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Save the walk"
      accessibilityState={{ busy: saving }}
      disabled={saving}
      scaleTo={0.97}
      style={[styles.cta, saving && styles.ctaBusy]}
      onPress={onSave}
    >
      <View style={styles.ctaInner}>
        <Text style={styles.ctaText}>{saving ? "Saving" : error ? "Try again" : "Save walk"}</Text>
        <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />
      </View>
    </PressScale>

    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Discard the walk"
      scaleTo={0.96}
      style={styles.quiet}
      onPress={onDiscard}
    >
      <Text style={styles.quietText}>Discard</Text>
    </PressScale>
  </View>
);

const Scheduled = ({
  name,
  route,
  time,
  onDone,
  onWalkNow,
}: {
  name: string;
  route: WalkRoute;
  time: string;
  onDone: () => void;
  onWalkNow: () => void;
}) => {
  const minutesAway = minutesOf(time) - (new Date().getHours() * 60 + new Date().getMinutes());
  return (
    <View>
      <Headline lead={`${name} has a walk at ${prettyTime(time)}.`} focus={route.name} />
      <Text style={styles.scheduledNote}>
        {minutesAway > 60
          ? `In ${Math.floor(minutesAway / 60)} h ${minutesAway % 60} min. It is on Today's care with a reminder.`
          : `In ${Math.max(1, minutesAway)} min. It is on Today's care with a reminder.`}
      </Text>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Back to care"
        scaleTo={0.97}
        style={styles.cta}
        onPress={onDone}
      >
        <View style={styles.ctaInner}>
          <Text style={styles.ctaText}>Back to care</Text>
          <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />
        </View>
      </PressScale>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Walk now instead"
        scaleTo={0.96}
        style={styles.quiet}
        onPress={onWalkNow}
      >
        <Text style={styles.quietText}>Walk now instead</Text>
      </PressScale>
    </View>
  );
};

const Figure = ({ value, unit, label }: { value: string; unit?: string; label: string }) => (
  <View style={styles.figure} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
    <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
      {value}
      {unit ? <Text style={styles.figureUnit}> {unit}</Text> : null}
    </Text>
    <Text style={styles.figureLabel}>{label}</Text>
  </View>
);

const Fact = ({ label, value, ruled = false }: { label: string; value: string; ruled?: boolean }) => (
  <View style={[styles.fact, ruled && styles.factRuled]} accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const lift = Platform.select({
  ios: {
    shadowColor: text.primary,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 4 },
}) as object;

const sheetLift = Platform.select({
  ios: {
    shadowColor: text.primary,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  default: { elevation: 12 },
}) as object;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.stage },

  topBar: {
    position: "absolute",
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  floatButton: {
    width: layout.iconButton + 4,
    height: layout.iconButton + 4,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
    ...lift,
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: bg.canvas,
    ...sheetLift,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: border.default,
    marginTop: space.sm,
    marginBottom: space.lg,
  },

  headline: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    fontWeight: "700",
    color: text.primary,
  },
  headlineLead: { fontWeight: "500", color: text.secondary },

  routes: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  route: {
    flex: 1,
    minHeight: 84,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },
  routeOn: { borderColor: text.primary, backgroundColor: accent.primary },
  routeKm: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  routeUnit: { ...type.supporting, fontWeight: "500", color: text.secondary },
  routeName: { ...type.caption, fontWeight: "500", color: text.secondary, marginTop: space.xs },
  routeNote: { ...type.supporting, color: text.secondary, marginTop: space.md },

  whenRow: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  when: {
    flex: 1,
    height: 40,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  whenOn: { backgroundColor: text.primary, borderColor: text.primary },
  whenText: { ...type.supporting, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  whenTextOn: { color: text.inverse },

  cta: {
    height: layout.controlHeight + 4,
    marginTop: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    justifyContent: "center",
  },
  ctaBusy: { opacity: 0.6 },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  ctaText: { ...type.cardTitle, fontSize: 17, fontWeight: "700", color: text.primary },

  quiet: { alignSelf: "center", paddingVertical: space.md, paddingHorizontal: space.xl, marginTop: space.xs },
  quietText: { ...type.supporting, fontWeight: "600", color: text.secondary },

  locationNotice: {
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: bg.stage,
  },
  locationNoticeText: { ...type.caption, fontWeight: "600", color: text.primary },

  status: { flexDirection: "row", alignItems: "center", gap: space.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.band },
  statusDotPaused: { backgroundColor: border.strong },
  statusText: { ...type.supporting, fontWeight: "500", color: text.secondary, flexShrink: 1 },
  timer: {
    fontSize: 76,
    lineHeight: 82,
    letterSpacing: -3,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
    marginTop: space.xs,
  },
  timerPaused: { color: text.tertiary },

  figures: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.soft,
  },
  figure: { flex: 1 },
  figureRule: { width: 1, backgroundColor: border.soft, marginHorizontal: space.md },
  figureValue: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  figureUnit: { ...type.caption, fontWeight: "500", color: text.secondary },
  figureLabel: { ...type.caption, color: text.tertiary, marginTop: 2 },

  controls: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  pause: {
    width: layout.controlHeight + 4,
    height: layout.controlHeight + 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseOn: { backgroundColor: accent.deep, borderColor: accent.deep },

  facts: {
    marginTop: space.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.soft,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.lg,
    minHeight: 50,
  },
  factRuled: { borderTopWidth: 1, borderTopColor: border.soft },
  factLabel: { ...type.supporting, color: text.secondary },
  factValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, flexShrink: 1 },

  error: { ...type.supporting, color: text.primary, marginTop: space.lg },
  scheduledNote: { ...type.supporting, color: text.secondary, marginTop: space.md },
});
