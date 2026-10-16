import { type ComponentType, useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  CheckIcon,
  FlagCheckeredIcon,
  PauseIcon,
  PlayIcon,
  type IconProps,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { HoldToEnd } from "@/features/care/walk/HoldToEnd";
import { GoogleWalkMap, type MapMode } from "@/features/care/walk/GoogleWalkMap";
import { useWalkTracker } from "@/features/care/walk/useWalkTracker";
import { formatClock, formatPace, type LatLng, type WalkRoute } from "@/features/care/walk/walkRoutes";
import { blockLoop, distanceKm, loopVia, walkThrough, type NavStep, type PlannedRoute } from "@/features/care/walk/routePlanner";
import { useTurnByTurn } from "@/features/care/walk/useTurnByTurn";
import { logWalkDone } from "@/features/care/state/todayChecks";
import { takeHandoff, type WalkStart } from "@/features/care/walk/walkHandoff";
import { PressScale } from "@/components/ui/PressScale";
import { useCareRoutines, useCompleteCareRoutine } from "@/hooks/useCareEvents";
import { useLogExercise } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { shortPlaceName } from "@/features/care/walk/routePlanner";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

type Phase = "walking" | "done";

const routeWords = (routeName: string) =>
  routeName === "Free walk" ? "" : routeName === "Around the block" ? "around the block" : `to ${shortPlaceName(routeName)}`;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation();

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";

  const [chosen, setChosen] = useState<{ route: PlannedRoute; start: WalkStart } | null>(() => takeHandoff());
  const [phase, setPhase] = useState<Phase>("walking");
  const [paused, setPaused] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!chosen) router.replace("/care/plan-walk?mode=now" as never);
  }, [chosen]);

  const route: WalkRoute = chosen?.route ?? EMPTY_ROUTE;
  // A walk set up from somewhere else begins when the phone gets there, so the route and the record match.
  const fromElsewhere = Boolean(chosen) && chosen!.start.source !== "here";
  const walk = useWalkTracker(route, Boolean(chosen) && phase === "walking" && !paused, fromElsewhere);
  const waiting = phase === "walking" && walk.status !== "walking";
  // Directions only make sense while you are actually on the route.
  const onRoute = Boolean(walk.position) && route.path.some((point) => distanceKm(point, walk.position!) <= 0.3);
  const turns = useTurnByTurn(chosen?.route.steps, walk.position, phase === "walking" && !waiting && !paused);
  const free = chosen?.route.kind === "free";

  // Getting to a start you chose happens inside PAWS: a walking route from where you are to the start, with turns.
  const [approach, setApproach] = useState<{ path: LatLng[]; steps: NavStep[]; minutes: number } | null>(null);
  const startPoint = route.path[0] ?? null;
  useEffect(() => {
    if (!waiting || !walk.position || !startPoint) return;
    if (distanceKm(walk.position, startPoint) > APPROACH_MAX_KM) {
      setApproach(null);
      return;
    }
    // Still on the way we already worked out: keep it rather than asking Google again every step.
    if (approach && approach.path.some((point) => distanceKm(point, walk.position!) <= 0.06)) return;
    let live = true;
    void walkThrough([walk.position, startPoint]).then((found) => {
      if (live) setApproach(found ? { path: found.path, steps: found.steps, minutes: found.minutes } : null);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, walk.position?.latitude, walk.position?.longitude]);
  const approachTurns = useTurnByTurn(approach?.steps, walk.position, waiting && Boolean(approach));

  // Started somewhere other than the planned start? Ask once: set it up again from here, or go to the start.
  const [decision, setDecision] = useState<"keep" | "here" | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [replanFailed, setReplanFailed] = useState(false);
  const offByKm = waiting && walk.status === "away" && walk.position && startPoint ? distanceKm(walk.position, startPoint) : null;
  const elsewhere = decision === null && offByKm != null && offByKm > ELSEWHERE_KM;

  const setUpFromHere = async () => {
    if (!chosen || !walk.position || replanning) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReplanning(true);
    setReplanFailed(false);
    const here = walk.position;
    const planned = chosen.route;
    // Same walk, new start: the same place as a there-and-back if it is reachable, else a loop of the same length.
    let next: PlannedRoute | null = null;
    if (planned.via && planned.kind !== "block") next = await loopVia(here, planned.via, planned.name, planned.kind, planned.id).catch(() => null);
    if (!next) next = await blockLoop(here, planned.minutes).catch(() => null);
    setReplanning(false);
    if (!next) {
      setReplanFailed(true);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setChosen({ route: next, start: { point: here, label: "Current location", source: "here" } });
    setApproach(null);
    setDecision("here");
    walk.begin();
  };
  const farFromStart = waiting && Boolean(walk.position && startPoint) && distanceKm(walk.position!, startPoint!) > APPROACH_MAX_KM;

  const logExercise = useLogExercise(dogId);
  const routines = useCareRoutines(dogId);
  const completeRoutine = useCompleteCareRoutine(dogId, isoDate(new Date()));

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: phase === "done" });
  }, [navigation, phase]);

  const mode: MapMode = phase === "walking" ? "walking" : "done";

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
          logWalkDone();
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
        routes={[route]}
        selectedId={route.id}
        mode={mode}
        progress={walk.progress}
        position={walk.position}
        trail={walk.trail}
        away={waiting}
        approach={waiting ? approach?.path : undefined}
      />

      {phase === "walking" && !waiting && !free && onRoute && turns.current ? (
        <View style={[styles.navWrap, { top: insets.top + space.sm }]} pointerEvents="none">
          <NavBanner turns={turns} arrive="You are back where you started" />
        </View>
      ) : waiting && approach && approachTurns.current ? (
        <View style={[styles.navWrap, { top: insets.top + space.sm }]} pointerEvents="none">
          <NavBanner turns={approachTurns} arrive="You are at the start" />
        </View>
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

        <Animated.View key={elsewhere ? "elsewhere" : waiting ? "away" : phase} entering={enterContent}>
          {elsewhere && chosen && offByKm != null ? (
            <Elsewhere
              startLabel={chosen.start.label}
              offByKm={offByKm}
              busy={replanning}
              failed={replanFailed}
              onSetUpHere={() => void setUpFromHere()}
              onKeep={() => {
                void Haptics.selectionAsync();
                setDecision("keep");
              }}
              onCancel={() => goBack("/(tabs)/care")}
            />
          ) : waiting && chosen ? (
            <HeadToStart
              name={name}
              startLabel={chosen.start.label}
              routeName={route.name}
              locating={walk.status === "locating"}
              minutesAway={approach?.minutes ?? null}
              far={farFromStart}
              onBegin={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                walk.begin();
              }}
              onCancel={() => goBack("/(tabs)/care")}
            />
          ) : phase === "walking" ? (
            <Walking
              name={name}
              route={route}
              elapsed={walk.elapsed}
              distanceKm={walk.distanceKm}
              progress={free ? Math.min(1, walk.elapsed / 60 / Math.max(1, route.minutes)) : walk.progress}
              free={free}
              locationDenied={walk.permission === "denied" || walk.permission === "unavailable"}
              paused={paused}
              onPause={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setPaused((value) => !value);
              }}
              onEnd={() => setPhase("done")}
            />
          ) : (
            <Done
              name={name}
              route={route}
              elapsed={walk.elapsed}
              distanceKm={walk.distanceKm}
              progress={walk.progress}
              free={free}
              saving={logExercise.isPending}
              error={saveError}
              onSave={save}
              onDiscard={() => goBack("/(tabs)/care")}
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

const HeadToStart = ({
  name,
  startLabel,
  routeName,
  locating,
  minutesAway,
  far,
  onBegin,
  onCancel,
}: {
  name: string;
  startLabel: string;
  routeName: string;
  locating: boolean;
  minutesAway: number | null;
  far: boolean;
  onBegin: () => void;
  onCancel: () => void;
}) => (
  <View>
    <View style={styles.status}>
      <View style={[styles.statusDot, styles.statusDotAway]} />
      <Text style={styles.statusText} numberOfLines={1}>
        {locating ? "Finding where you are" : minutesAway ? `Head to the start, about ${minutesAway} min away` : "Head to the start"}
      </Text>
    </View>
    <Text style={styles.awayPlace} numberOfLines={2}>
      {shortPlaceName(startLabel)}
    </Text>
    <Text style={styles.awayNote}>
      {far
        ? `The walk ${routeWords(routeName)} starts there, which is too far to walk to from here. PAWS starts the clock when you arrive.`
        : `Follow the dotted line on the map. The walk ${routeWords(routeName)} starts there, and PAWS starts the clock when you arrive.`}
    </Text>
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Start walking ${name} from where you are now`}
      scaleTo={0.97}
      style={styles.cta}
      onPress={onBegin}
    >
      <View style={styles.ctaInner}>
        <Text style={styles.ctaText}>I am here, start now</Text>
      </View>
    </PressScale>
    <PressScale accessibilityRole="button" accessibilityLabel="Cancel this walk" scaleTo={0.96} style={styles.quiet} onPress={onCancel}>
      <Text style={styles.quietText}>Cancel</Text>
    </PressScale>
  </View>
);

/** Further than this from the planned start when the walk begins, PAWS asks whether to set it up again from here. */
const ELSEWHERE_KM = 0.4;

const kmText = (km: number) => (km >= 10 ? `${Math.round(km).toLocaleString()} km` : km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000 / 10) * 10} m`);

/** The walk was planned from somewhere else: offer to rebuild it from here, or keep it and go to the start. */
const Elsewhere = ({
  startLabel,
  offByKm,
  busy,
  failed,
  onSetUpHere,
  onKeep,
  onCancel,
}: {
  startLabel: string;
  offByKm: number;
  busy: boolean;
  failed: boolean;
  onSetUpHere: () => void;
  onKeep: () => void;
  onCancel: () => void;
}) => (
  <View>
    <View style={styles.status}>
      <View style={[styles.statusDot, styles.statusDotAway]} />
      <Text style={styles.statusText} numberOfLines={1}>
        You seem to be somewhere else
      </Text>
    </View>
    <Text style={styles.awayPlace} numberOfLines={2}>
      {`${kmText(offByKm)} from ${shortPlaceName(startLabel)}`}
    </Text>
    <Text style={styles.awayNote}>
      {failed
        ? "PAWS could not find a walk from here. Head to the planned start, or plan a new walk."
        : "This walk was set up to start there. Set it up again from where you are now?"}
    </Text>
    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Set the walk up again from where you are"
      accessibilityState={{ busy }}
      scaleTo={0.97}
      disabled={busy}
      style={[styles.cta, busy && styles.ctaBusy]}
      onPress={onSetUpHere}
    >
      <View style={styles.ctaInner}>
        <Text style={styles.ctaText}>{busy ? "Setting up from here..." : "Set up from here"}</Text>
      </View>
    </PressScale>
    <PressScale accessibilityRole="button" accessibilityLabel="Keep the plan and go to the planned start" scaleTo={0.97} style={styles.ctaSecondary} onPress={onKeep}>
      <Text style={styles.ctaSecondaryText}>Go to the planned start</Text>
    </PressScale>
    <PressScale accessibilityRole="button" accessibilityLabel="Cancel this walk" scaleTo={0.96} style={styles.quiet} onPress={onCancel}>
      <Text style={styles.quietText}>Cancel</Text>
    </PressScale>
  </View>
);

/** Beyond this the start is a drive away, not a walk; PAWS does not draw walking directions to it. */
const APPROACH_MAX_KM = 5;

const MANEUVER: Record<string, ComponentType<IconProps>> = {
  TURN_LEFT: ArrowBendUpLeftIcon,
  TURN_SHARP_LEFT: ArrowBendUpLeftIcon,
  TURN_RIGHT: ArrowBendUpRightIcon,
  TURN_SHARP_RIGHT: ArrowBendUpRightIcon,
  TURN_SLIGHT_LEFT: ArrowUpLeftIcon,
  FORK_LEFT: ArrowUpLeftIcon,
  RAMP_LEFT: ArrowUpLeftIcon,
  TURN_SLIGHT_RIGHT: ArrowUpRightIcon,
  FORK_RIGHT: ArrowUpRightIcon,
  RAMP_RIGHT: ArrowUpRightIcon,
  UTURN_LEFT: ArrowUUpLeftIcon,
  UTURN_RIGHT: ArrowUUpRightIcon,
};

const meters = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(value / 10) * 10)} m`);

/** The next turn, big and plain, like a nav app: distance first, then what to do. */
const NavBanner = ({ turns, arrive }: { turns: ReturnType<typeof useTurnByTurn>; arrive: string }) => {
  const reduceMotion = useReducedMotion();
  const next = turns.upcoming;
  const Glyph = next ? (MANEUVER[next.maneuver] ?? ArrowUpIcon) : FlagCheckeredIcon;
  const headline = turns.meters === null ? "Now" : `In ${meters(turns.meters)}`;
  const doing = next ? next.instruction : arrive;
  return (
    <Animated.View
      key={next?.instruction ?? "arrive"}
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select).withInitialValues({ opacity: 0, transform: [{ translateY: -6 }] })}
      style={styles.nav}
      accessibilityRole="alert"
      accessibilityLabel={`${headline}, ${doing}`}
    >
      <View style={styles.navIcon}>
        <Glyph size={26} color={text.primary} weight="bold" />
      </View>
      <View style={styles.navText}>
        <Text style={styles.navDistance}>{headline}</Text>
        <Text style={styles.navDo} numberOfLines={2}>
          {doing}
        </Text>
      </View>
    </Animated.View>
  );
};

const EMPTY_ROUTE: WalkRoute = { id: "none", name: "", note: "", distanceKm: 0, minutes: 0, path: [] };

const Walking = ({
  name,
  route,
  elapsed,
  distanceKm,
  progress,
  paused,
  free,
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
  free: boolean;
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
        {`${paused ? "Paused" : `Walking ${name}`} ${free ? "wherever you go" : routeWords(route.name)}`.trim()}
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
      <Figure value={String(Math.round(progress * 100))} unit="%" label={free ? `Of ${route.minutes} min` : "Of the route"} />
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
  free,
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
  free: boolean;
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
      <Fact label="Route" value={free ? "Free walk, your own way" : `${route.name}, ${Math.round(progress * 100)}%`} />
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
  place: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    maxWidth: "100%",
    marginBottom: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  placeText: { ...type.caption, fontWeight: "600", color: text.secondary, flexShrink: 1 },
  placeLink: { ...type.caption, fontWeight: "700", color: text.primary, textDecorationLine: "underline" },
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
  ctaSecondary: {
    height: layout.controlHeight,
    marginTop: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSecondaryText: { ...type.cardTitle, fontWeight: "600", color: text.primary },

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
  navWrap: { position: "absolute", left: layout.gutter - 8, right: layout.gutter - 8 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: text.primary,
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  navIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  navText: { flex: 1 },
  navDistance: { fontSize: 24, lineHeight: 28, letterSpacing: -0.4, fontWeight: "800", color: text.inverse, fontVariant: ["tabular-nums"] },
  navDo: { ...type.supporting, fontSize: 15, fontWeight: "600", color: text.inverse, marginTop: 2 },
  statusDotAway: { backgroundColor: accent.deep },
  awayPlace: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontWeight: "700", color: text.primary, marginTop: space.md },
  awayNote: { ...type.supporting, color: text.secondary, marginTop: space.sm },
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
