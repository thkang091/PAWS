import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CaretLeftIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  FootprintsIcon,
  PathIcon,
  HouseIcon,
  MapPinIcon,
  NavigationArrowIcon,
  TreeIcon,
  XCircleIcon,
  type IconProps,
} from "phosphor-react-native";

import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { useCareLocations } from "@/features/care/state/careLocations";
import { cancelPlannedWalk, getPlannedWalk, occursOn, planWalk, repeatLabel, usePlannedWalks } from "@/features/care/state/plannedWalks";
import { lastWalkMinutes, rememberWalk, useWalkPlaces } from "@/features/care/state/walkPlaces";
import { PlannerMap } from "@/features/care/walk/PlannerMap";
import {
  decodePolyline,
  distanceKm,
  encodePolyline,
  loopVia,
  shortPlaceName,
  type PlannedRoute,
  type Spot,
} from "@/features/care/walk/routePlanner";
import { routeToPin, routeToPlace, routeToSpot, useRouteOptions, useWalkStart } from "@/features/care/walk/useRouteOptions";
import { handOffWalk, type WalkStart } from "@/features/care/walk/walkHandoff";
import type { LatLng } from "@/features/care/walk/walkRoutes";
import { PressScale } from "@/components/ui/PressScale";
import { Ruler } from "@/components/ui/Ruler";
import Svg, { Circle } from "react-native-svg";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useCareProfile, useExerciseLogsBetween } from "@/hooks/useCareHealth";
import { useCareOnboarding } from "@/features/care/state/careOnboarding";
import { requestNotificationPermissions } from "@/services/notificationService";
import { searchPlaces, type PlaceHit } from "@/services/placeSearch";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

type Panel = "length" | "where" | "when" | null;
type Leg = "from" | "to";
type Step = "compose" | "when" | "length" | "route";
const ROUTE_STEPS: readonly Step[] = ["when", "length", "route"];
const FREE_STEPS: readonly Step[] = ["when", "length"];
const STEP_NAME: Record<Step, string> = { compose: "", when: "when", length: "how long", route: "where" };
type Search = {
  state: "idle" | "looking" | "found" | "empty" | "offline";
  hits: readonly PlaceHit[];
};

const MIN_LEN = 10;
const MAX_LEN = 90;
const LEN_STEP = 5;
const DAY_COUNT = 62;
const T0 = 5 * 60;
const T1 = 23 * 60;
const T_STEP = 5;
const T_COUNT = (T1 - T0) / T_STEP + 1;
const ROW = 56;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayAt = (i: number) => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
};
const dayName = (i: number) => {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  const d = dayAt(i);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
};
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const clock = (minutes: number) => prettyTime(hhmm(minutes));
const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();
const earliestToday = () => Math.ceil((nowMinutes() + 15) / T_STEP) * T_STEP;
const snapLength = (minutes: number) => Math.max(MIN_LEN, Math.min(MAX_LEN, Math.round(minutes / LEN_STEP) * LEN_STEP));
const span = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
const sameSpot = (a: LatLng, b: LatLng) => Math.abs(a.latitude - b.latitude) < 0.0003 && Math.abs(a.longitude - b.longitude) < 0.0003;

const useDebounced = <T,>(value: T, ms: number) => {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
};

export default function PlanWalkScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ mode?: string; plan?: string; day?: string }>();
  const dog = useCurrentDog();
  const dogName = dog.data?.name ?? "your dog";
  const { home } = useCareLocations();
  const dogId = dog.data?.id;
  const careProfile = useCareProfile(dogId);
  const { choice } = useCareOnboarding();
  const plannedAll = usePlannedWalks();
  const todayKey = keyOf(dayAt(0));
  const todayLogs = useExerciseLogsBetween(dogId, todayKey, todayKey);
  const recents = useWalkPlaces();

  const editing = useMemo(() => (params.plan ? getPlannedWalk(params.plan) : null), [params.plan]);
  const editingRoute = useMemo<PlannedRoute | null>(
    () =>
      editing?.route && editing.route.kind !== "free"
        ? {
            id: `plan-${editing.id}`,
            kind: editing.route.kind ?? "spot",
            via: editing.route.via ?? null,
            name: editing.route.name,
            note: editing.route.note,
            distanceKm: editing.route.distanceKm,
            minutes: editing.minutes,
            path: decodePolyline(editing.route.polyline),
            steps: editing.route.steps,
          }
        : null,
    [editing],
  );
  const initialStart: WalkStart | null = editing?.route
    ? {
        point: editing.route.start,
        label: editing.route.startLabel,
        source: editing.route.startLabel === "Current location" ? "here" : "search",
      }
    : null;

  const { state: startState, setStart, locate } = useWalkStart(initialStart);
  const start = startState.status === "ready" ? startState.start : null;

  const [wanted, setWanted] = useState(() => editing?.minutes ?? lastWalkMinutes() ?? 30);
  // "Just walk": no route to follow, PAWS records wherever the walk goes, like a run tracker.
  const [free, setFree] = useState(editing?.route?.kind === "free");
  const target = useDebounced(wanted, 550);
  const [extra, setExtra] = useState<PlannedRoute[]>(editingRoute ? [editingRoute] : []);
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(editingRoute?.id ?? null);
  const [picked, setPicked] = useState(Boolean(editingRoute));
  const [finding, setFinding] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);
  const [syncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [leg, setLeg] = useState<Leg>("to");
  const [focused, setFocused] = useState<Leg | null>(null);
  const [drafts, setDrafts] = useState<Record<Leg, string>>({
    from: "",
    to: "",
  });
  const [search, setSearch] = useState<Search>({ state: "idle", hits: [] });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(360);
  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);
  const placeOf = useRef(new Map<string, PlaceHit>());

  const soonIndex = (() => {
    if (!editing) return null;
    const [y, m, d] = editing.dayKey.split("-").map(Number);
    const diff = Math.round((new Date(y, m - 1, d).getTime() - dayAt(0).getTime()) / 86_400_000);
    return Math.max(0, Math.min(DAY_COUNT - 1, diff));
  })();
  const defaultLater = earliestToday() <= 20 * 60 ? { day: 0, time: Math.max(earliestToday(), T0) } : { day: 1, time: 7 * 60 + 30 };
  // "compose" is the walk you can start right now; Next walks through when, then where, to plan one ahead.
  // Opened from a day on the calendar: go straight to planning that day.
  const pickedDay = (() => {
    if (!params.day || editing) return null;
    const [y, m, d] = params.day.split("-").map(Number);
    const diff = Math.round((new Date(y, m - 1, d).getTime() - dayAt(0).getTime()) / 86_400_000);
    return diff >= 0 && diff < DAY_COUNT ? diff : null;
  })();
  const [step, setStep] = useState<Step>(pickedDay !== null ? "when" : "compose");
  const now = step === "compose";
  const [dayIndex, setDayIndex] = useState(soonIndex ?? pickedDay ?? defaultLater.day);
  const [time, setTime] = useState(
    editing
      ? Number(editing.time.slice(0, 2)) * 60 + Number(editing.time.slice(3, 5))
      : pickedDay && pickedDay > 0
        ? 7 * 60 + 30
        : defaultLater.time,
  );
  // A routine repeats on chosen weekdays; null means a one-off walk on dayIndex.
  const [repeat, setRepeat] = useState<number[] | null>(editing?.repeat?.length ? [...editing.repeat] : null);
  const routine = Boolean(repeat && repeat.length);
  const minTime = !routine && dayIndex === 0 ? Math.max(T0, earliestToday()) : T0;

  useEffect(() => {
    if (time < minTime) setTime(Math.min(T1, minTime));
  }, [minTime, time]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const options = useRouteOptions(start?.point ?? null, target, extra);
  const routes = useMemo(() => {
    const seen = new Set<string>();
    return options.routes.filter((route) => (seen.has(route.id) ? false : (seen.add(route.id), true)));
  }, [options.routes]);

  useEffect(() => {
    if (picked || routes.length === 0) return;
    const best = [...routes].sort((a, b) => Math.abs(a.minutes - target) - Math.abs(b.minutes - target))[0];
    setSelectedId(best.id);
  }, [routes, target, picked]);

  const routeChoice = routes.find((route) => route.id === selectedId) ?? null;
  const freeRoute = useMemo<PlannedRoute>(
    () => ({
      id: "free",
      kind: "free",
      via: null,
      name: "Free walk",
      note: "Wherever you go",
      distanceKm: 0,
      minutes: wanted,
      path: start && start.source === "here" ? [start.point] : [],
    }),
    [wanted, start],
  );
  const selected = free ? freeRoute : routeChoice;
  const minutes = picked && selected ? selected.minutes : wanted;

  const addRoute = async (id: string, build: () => Promise<PlannedRoute | null>, force = false) => {
    if (!start) return;
    const existing = force ? null : routes.find((route) => route.id === id);
    if (existing) {
      setPicked(true);
      setSelectedId(existing.id);
      return;
    }
    setFinding(true);
    setRouteFailed(false);
    const route = await build();
    setFinding(false);
    setPendingPin(null);
    if (!route) {
      setRouteFailed(true);
      // Nothing reachable to keep, so fall back to the best walk near the new start.
      if (force) {
        setPicked(false);
        setSelectedId(null);
      }
      return;
    }
    void Haptics.selectionAsync();
    setPicked(true);
    setExtra((current) => [route, ...current.filter((item) => item.id !== route.id && !(item.kind === "pin" && route.kind === "pin"))]);
    setSelectedId(route.id);
  };

  // A new start keeps the destination: the same place, walked from the new door.
  const keep = useRef({ selected, picked });
  keep.current = { selected, picked };
  const startKey = start ? `${start.point.latitude.toFixed(5)},${start.point.longitude.toFixed(5)}` : null;
  const firstStart = useRef(true);
  useEffect(() => {
    if (!start) return;
    if (firstStart.current) {
      firstStart.current = false;
      return;
    }
    const prev = keep.current.picked ? keep.current.selected : null;
    setExtra([]);
    if (prev?.via) {
      const via = prev.via;
      void addRoute(prev.id, () => loopVia(start.point, via, prev.name, prev.kind, prev.id), true);
    } else {
      setPicked(false);
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);

  const fromValue = !start
    ? startState.status === "failed"
      ? ""
      : "Finding you"
    : start.source === "here"
      ? "Current location"
      : start.label;
  const toValue = !selected ? "" : selected.kind === "block" ? "Around the block" : selected.name;
  const valueOf = (which: Leg) => (which === "from" ? fromValue : toValue);

  const query = focused ? drafts[focused].trim() : "";
  const typed = focused !== null && query.length >= 2 && query !== valueOf(focused);
  const searchTicket = useRef(0);
  useEffect(() => {
    if (!typed) {
      searchTicket.current += 1;
      setSearch({ state: "idle", hits: [] });
      return;
    }
    const ticket = ++searchTicket.current;
    setSearch((current) => ({ ...current, state: "looking" }));
    const id = setTimeout(() => {
      void searchPlaces(query, start?.point ?? home ?? null).then((result) => {
        if (ticket !== searchTicket.current) return;
        setSearch(result.state === "found" ? { state: "found", hits: result.hits } : { state: result.state, hits: [] });
      });
    }, 380);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, query]);

  const openWhere = (which: Leg) => {
    void Haptics.selectionAsync();
    setRouteFailed(false);
    setSyncNote(null);
    if (panel === "where" && leg === which) {
      setPanel(null);
      return;
    }
    setPanel("where");
    setLeg(which);
    if (which === "from" && startState.status === "failed") setTimeout(() => fromRef.current?.focus(), 60);
  };

  const toggle = (next: Exclude<Panel, "where">) => {
    void Haptics.selectionAsync();
    setRouteFailed(false);
    setSyncNote(null);
    Keyboard.dismiss();
    setPanel((current) => (current === next ? null : next));
  };

  const doneTyping = () => {
    Keyboard.dismiss();
    fromRef.current?.blur();
    toRef.current?.blur();
    setFocused(null);
  };

  const chooseRoute = (route: PlannedRoute) => {
    void Haptics.selectionAsync();
    setPicked(true);
    setSelectedId(route.id);
    setRouteFailed(false);
    doneTyping();
    setPanel(null);
  };

  const chooseDestination = (place: PlaceHit) => {
    if (!start) return;
    void Haptics.selectionAsync();
    const id = `place-${place.id}`;
    placeOf.current.set(id, place);
    setPendingPin({ latitude: place.latitude, longitude: place.longitude });
    doneTyping();
    setPanel(null);
    void addRoute(id, () => routeToPlace(start.point, place));
  };

  const chooseStart = (next: WalkStart | "here") => {
    void Haptics.selectionAsync();
    if (next === "here") locate();
    else setStart(next);
    doneTyping();
    setLeg("to");
  };

  /** A free walk needs no route: hand the tracker a start where the phone is and let the trail draw itself. */
  const goFree = (startNow: boolean) => {
    if (editing) cancelPlannedWalk(editing.id);
    rememberWalk({ minutes: snapLength(wanted), destination: null, start: null });
    const here: WalkStart = {
      point: start && start.source === "here" ? start.point : { latitude: 0, longitude: 0 },
      label: "Current location",
      source: "here",
    };
    if (startNow) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handOffWalk(freeRoute, here);
      router.replace("/care/walk" as never);
      return;
    }
    void requestNotificationPermissions().catch(() => false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    planWalk(
      {
        dayKey: routine ? todayKey : keyOf(dayAt(dayIndex)),
        repeat: routine ? repeat : null,
        time: hhmm(time),
        minutes: wanted,
        route: {
          kind: "free",
          name: "Free walk",
          note: "Wherever you go",
          polyline: "",
          distanceKm: 0,
          start: { latitude: here.point.latitude, longitude: here.point.longitude },
          startLabel: "Current location",
          via: null,
        },
      },
      dogName,
    );
    router.back();
  };

  const onSpot = (spot: Spot) => void addRoute(`spot-${spot.id}`, () => routeToSpot(start!.point, spot));
  const onPin = (point: LatLng) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingPin(point);
    void addRoute(`pin-${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`, () => routeToPin(start!.point, point));
  };

  const go = async (startNow = now) => {
    if (free) {
      goFree(startNow);
      return;
    }
    if (!selected || !start) return;
    // A start the guardian set is never second-guessed here: the walk begins there, and the walk screen
    // waits for them to arrive before the clock runs.
    if (editing) cancelPlannedWalk(editing.id);
    const via = selected.via;
    const known = placeOf.current.get(selected.id);
    rememberWalk({
      minutes: snapLength(selected.minutes),
      destination:
        via && selected.kind !== "pin"
          ? (known ?? {
              id: selected.id,
              name: selected.name,
              address: null,
              latitude: via.latitude,
              longitude: via.longitude,
              park: selected.kind === "spot",
            })
          : null,
      start:
        start.source === "search"
          ? {
              id: `start-${startKey}`,
              name: shortPlaceName(start.label),
              address: start.label,
              latitude: start.point.latitude,
              longitude: start.point.longitude,
              park: false,
            }
          : null,
    });
    if (startNow) {
      // The walk starts exactly where the plan says. "Here" was located when the planner opened; any other
      // start is kept as set, and the walk screen waits for the guardian to reach it.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handOffWalk(selected, start);
      router.replace("/care/walk" as never);
      return;
    }
    await requestNotificationPermissions().catch(() => false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    planWalk(
      {
        dayKey: routine ? todayKey : keyOf(dayAt(dayIndex)),
        repeat: routine ? repeat : null,
        time: hhmm(time),
        minutes: selected.minutes,
        route: {
          kind: selected.kind,
          name: selected.name,
          note: selected.note,
          polyline: encodePolyline(selected.path),
          distanceKm: selected.distanceKm,
          start: {
            latitude: start.point.latitude,
            longitude: start.point.longitude,
          },
          startLabel: start.label,
          via: via ? { latitude: via.latitude, longitude: via.longitude } : null,
          steps: selected.steps,
        },
      },
      dogName,
    );
    router.back();
  };

  const shown: Panel = step === "when" ? "when" : step === "length" ? "length" : step === "route" ? "where" : panel;

  const startPlanning = () => {
    void Haptics.selectionAsync();
    Keyboard.dismiss();
    setPanel(null);
    setSyncNote(null);
    setRouteFailed(false);
    setStep("when");
  };
  const stepBack = () => {
    void Haptics.selectionAsync();
    if (step === "when" && pickedDay !== null) {
      router.back();
      return;
    }
    doneTyping();
    setStep((current) => (current === "route" ? "length" : current === "length" ? "when" : "compose"));
  };
  const flow = free ? FREE_STEPS : ROUTE_STEPS;
  const chooseMode = (next: boolean) => {
    if (next === free) return;
    void Haptics.selectionAsync();
    doneTyping();
    setPanel(null);
    setRouteFailed(false);
    setFree(next);
  };
  const primaryPress = () => {
    if (step === "compose") void go(true);
    else if (step === "when") {
      void Haptics.selectionAsync();
      setStep("length");
    } else if (step === "length" && free) {
      void go(false);
    } else if (step === "length") {
      void Haptics.selectionAsync();
      setLeg("to");
      setStep("route");
    } else void go(false);
  };
  /** Tapping a highlighted part while planning ahead jumps straight to the step that changes it. */
  const jumpTo = (next: Step, which?: Leg) => {
    void Haptics.selectionAsync();
    doneTyping();
    if (which) setLeg(which);
    setStep(next);
  };

  const whenText = now ? "Now" : routine ? `${repeatLabel(repeat!)}, ${clock(time)}` : `${dayName(dayIndex)}, ${clock(time)}`;
  const fromText = !start
    ? startState.status === "failed"
      ? "a start"
      : "…"
    : start.source === "here"
      ? "here"
      : shortPlaceName(start.label);
  const toText = finding
    ? "…"
    : !selected
      ? options.loading
        ? "…"
        : "somewhere"
      : selected.kind === "block"
        ? "around the block"
        : shortPlaceName(selected.name);
  const offBy = selected ? selected.minutes - wanted : 0;
  const primaryLabel = syncing
    ? "Checking where you are"
    : finding
      ? "Finding the way"
      : step === "when" || (step === "length" && !free)
        ? "Next"
        : step === "length"
          ? `Plan for ${dayIndex < 2 ? dayName(dayIndex).toLowerCase() : dayName(dayIndex)}, ${clock(time)}`
        : step === "route"
          ? selected
            ? `Plan for ${dayIndex < 2 ? dayName(dayIndex).toLowerCase() : dayName(dayIndex)}, ${clock(time)}`
            : "Choose where to walk"
          : "Start walk";
  const primaryOff = free ? syncing : step !== "when" && step !== "length" && (!selected || finding || syncing);

  const mapPin =
    (finding && pendingPin) ||
    (selected?.via && selected.kind !== "block" && !options.spots.some((spot) => sameSpot(spot, selected.via!)) ? selected.via : null);

  const typing = focused !== null;
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.height.value - insets.bottom) }],
  }));
  const searchListMax = Math.max(ROW * 2, window.height - keyboardHeight - insets.top - 64 - 200);

  const settle = reduceMotion ? undefined : LinearTransition.duration(260).easing(motion.easing.drawer);

  // What the list under the route card offers, based on the leg being changed and what has been typed.
  const suggestions = (() => {
    if (focused && typed) {
      return search.hits.map((hit) => ({
        key: `hit-${hit.id}`,
        Glyph: hit.park ? TreeIcon : MapPinIcon,
        title: hit.name,
        meta: hit.address ?? "",
        on: false,
        trailing: null as string | null,
        onPress: () =>
          focused === "from"
            ? chooseStart({
                point: { latitude: hit.latitude, longitude: hit.longitude },
                label: hit.name,
                source: "search",
              })
            : chooseDestination(hit),
      }));
    }
    if (leg === "from") {
      const rows = [
        {
          key: "here",
          Glyph: NavigationArrowIcon,
          title: "Current location",
          meta: "Start where you are",
          on: start?.source === "here",
          trailing: null as string | null,
          onPress: () => chooseStart("here"),
        },
      ];
      if (home) {
        rows.push({
          key: "home",
          Glyph: HouseIcon,
          title: "Home",
          meta: home.label,
          on: start?.source !== "here" && !!start && sameSpot(start.point, home),
          trailing: null,
          onPress: () => chooseStart({ point: home, label: home.label, source: "home" }),
        });
      }
      recents.starts
        .filter((place) => !home || !sameSpot(place, home))
        .slice(0, 3)
        .forEach((place) =>
          rows.push({
            key: `start-${place.id}`,
            Glyph: ClockCounterClockwiseIcon,
            title: place.name,
            meta: place.address && place.address !== place.name ? place.address : "Recent start",
            on: !!start && start.source !== "here" && sameSpot(start.point, place),
            trailing: null,
            onPress: () =>
              chooseStart({
                point: { latitude: place.latitude, longitude: place.longitude },
                label: place.address ?? place.name,
                source: "search",
              }),
          }),
        );
      return rows;
    }
    const routeRows = routes.slice(0, 4).map((route) => ({
      key: route.id,
      Glyph: route.kind === "spot" ? TreeIcon : route.kind === "pin" ? MapPinIcon : ArrowsClockwiseIcon,
      title: route.kind === "block" ? "Around the block" : route.name,
      meta: route.kind === "block" ? "A loop from your start" : "There and back",
      on: route.id === selected?.id,
      trailing: span(route.minutes) as string | null,
      onPress: () => chooseRoute(route),
    }));
    const recentRows = recents.destinations
      .filter((place) => !routes.some((route) => route.name === place.name))
      .filter((place) => !start || distanceKm(start.point, place) <= 8)
      .slice(0, 2)
      .map((place) => ({
        key: `recent-${place.id}`,
        Glyph: ClockCounterClockwiseIcon,
        title: place.name,
        meta: place.address ?? "Walked here before",
        on: false,
        trailing: null as string | null,
        onPress: () => chooseDestination(place),
      }));
    return [...routeRows, ...recentRows];
  })();

  // What the dog needs today, and what is already done or planned, so the length is a considered choice.
  const goal = careProfile.data?.dailyExerciseGoalMinutes ?? choice?.exerciseMinutes ?? null;
  const planDayKey = keyOf(dayAt(step === "compose" ? 0 : dayIndex));
  const walkedToday = (todayLogs.data ?? []).reduce((sum, log) => sum + log.durationMinutes, 0);
  const plannedThatDay = plannedAll
    .filter((walk) => occursOn(walk, planDayKey) && walk.id !== editing?.id)
    .sort((a, b) => a.time.localeCompare(b.time));
  const alreadyThatDay = (planDayKey === todayKey ? walkedToday : 0) + plannedThatDay.reduce((sum, walk) => sum + walk.minutes, 0);
  const leftThatDay = goal ? Math.max(0, goal - alreadyThatDay) : null;
  const suggestedLength = leftThatDay ? snapLength(leftThatDay) : null;
  const usualTimes = (choice?.walkTimes ?? [])
    .map((value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)))
    .filter((value) => Number.isFinite(value) && value >= T0 && value <= T1)
    .sort((a, b) => a - b);
  const browseMax = Math.max(ROW * 3, window.height - insets.top - insets.bottom - 190 - 140 - 170);

  const listNote = (() => {
    if (focused && typed) {
      if (search.state === "looking" && search.hits.length === 0) return "Searching Google Maps";
      if (search.state === "empty") return `Nothing found for “${query}”. Try a park, a street or a ZIP code.`;
      if (search.state === "offline") return "Search is not reachable right now. Check the connection and try again.";
      return null;
    }
    if (leg === "from" && startState.status === "failed") {
      return startState.reason === "denied"
        ? "Location is off for PAWS. Search for where you start, or turn Location on in Settings."
        : "Could not find where you are. Search for where you start.";
    }
    if (leg === "to" && routeFailed) return "That is too far to walk from this start. Pick somewhere closer.";
    if (leg === "to" && routes.length === 0) {
      if (!start) return startState.status === "failed" ? "Choose where you start first." : null;
      return options.loading ? "Finding walks nearby" : "No walks came back from here. Search for a place above.";
    }
    return null;
  })();

  return (
    <View style={styles.screen}>
      {start ? (
        <PlannerMap
          start={start.point}
          spots={free ? [] : options.spots}
          routes={free ? [] : routes}
          selectedId={free ? null : (selected?.id ?? null)}
          pin={free ? null : mapPin}
          bottomInset={sheetHeight}
          onSelectRoute={(id) => {
            void Haptics.selectionAsync();
            setPicked(true);
            setSelectedId(id);
          }}
          onSelectSpot={onSpot}
          onDropPin={onPin}
        />
      ) : (
        <View style={[styles.waiting, { paddingBottom: sheetHeight }]}>
          {startState.status === "failed" ? (
            <Text style={styles.waitText}>Could not find where you are. Tap “a start” below to choose one.</Text>
          ) : (
            <>
              <ActivityIndicator color={text.secondary} />
              <Text style={styles.waitText}>Finding where you are</Text>
            </>
          )}
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => router.back()}>
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Past walks"
          style={styles.round}
          onPress={() => router.push("/care/exercise")}
        >
          <ClockCounterClockwiseIcon size={iconSize.nav} color={text.primary} weight="regular" />
        </PressScale>
      </View>

      <Animated.View style={[styles.dock, lift]} pointerEvents="box-none">
        <Animated.View
          layout={settle}
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              paddingBottom: typing ? space.md + insets.bottom : insets.bottom + space.md,
            },
          ]}
        >
          <View style={styles.grabber} />

          {step !== "compose" && !typing ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.stepHead}>
              <Text style={styles.stepText}>{`Plan ahead. Step ${flow.indexOf(step) + 1} of ${flow.length}, ${STEP_NAME[step]}`}</Text>
              <View style={styles.stepBars}>
                {flow.map((item, i) => (
                  <View key={item} style={[styles.stepBar, i <= flow.indexOf(step) && styles.stepBarOn]} />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {step === "compose" && !typing && shown !== "where" ? (
            <View style={styles.modes} accessibilityRole="tablist">
              {([
                [false, "Follow a route", PathIcon],
                [true, "Just walk", FootprintsIcon],
              ] as const).map(([value, label, Glyph]) => {
                const on = free === value;
                return (
                  <PressScale
                    key={label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={label}
                    scaleTo={0.97}
                    style={[styles.mode, on && styles.modeOn]}
                    onPress={() => chooseMode(value)}
                  >
                    <Glyph size={16} color={on ? text.primary : text.tertiary} weight={on ? "fill" : "regular"} />
                    <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
                  </PressScale>
                );
              })}
            </View>
          ) : null}

          {!typing && free ? (
            <View
              style={styles.sentence}
              accessibilityRole="summary"
              accessibilityLabel={`${whenText}, walk ${dogName} for ${minutes} minutes and see where you go.`}
            >
              <Token text={whenText} open={shown === "when"} onPress={() => (step === "compose" ? startPlanning() : jumpTo("when"))} suffix="," />
              <Plain text={`walk ${dogName} for`} />
              <Token text={span(minutes)} open={shown === "length"} onPress={() => (step === "compose" ? toggle("length") : jumpTo("length"))} />
              <Plain text="and see where you go." />
            </View>
          ) : null}

          {typing || shown === "where" || free ? null : (
            <View
              style={styles.sentence}
              accessibilityRole="summary"
              accessibilityLabel={`${whenText}, walk ${dogName} for ${minutes} minutes from ${fromText} to ${toText}.`}
            >
              <Token text={whenText} open={shown === "when"} onPress={() => (step === "compose" ? startPlanning() : jumpTo("when"))} suffix="," />
              <Plain text={`walk ${dogName} for`} />
              <Token text={span(minutes)} open={shown === "length"} onPress={() => (step === "compose" ? toggle("length") : jumpTo("length"))} />
              <Plain text="from" />
              <Token
                text={fromText}
                open={false}
                onPress={() => (step === "compose" ? openWhere("from") : jumpTo("route", "from"))}
                suffix={selected?.kind === "block" && !finding ? "," : undefined}
              />
              {selected?.kind === "block" && !finding ? null : <Plain text="to" />}
              <Token
                text={toText}
                open={false}
                onPress={() => (step === "compose" ? openWhere("to") : jumpTo("route", "to"))}
                suffix="."
              />
            </View>
          )}

          {shown === "where" ? null : free && step === "compose" && !typing ? (
            <Text style={styles.note}>No route to follow. PAWS draws your path as you go and counts the time and distance.</Text>
          ) : !typing && editing && step === "compose" && !syncNote && !routeFailed ? (
            <Text style={styles.note}>{`Planned for ${dayName(dayIndex).toLowerCase() === "today" || dayIndex === 1 ? dayName(dayIndex).toLowerCase() : dayName(dayIndex)}, ${clock(time)}. Tap Next to change it.`}</Text>
          ) : !typing && syncNote ? (
            <Animated.Text entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.note}>
              {syncNote}
            </Animated.Text>
          ) : !typing && routeFailed ? (
            <Animated.Text entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.note}>
              That is too far to walk from this start. Pick somewhere closer.
            </Animated.Text>
          ) : !typing && step === "compose" && selected && !picked && Math.abs(offBy) >= 5 && shown !== "length" ? (
            <Animated.Text entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.note}>
              {`The closest walk takes about ${span(selected.minutes)}.`}
            </Animated.Text>
          ) : null}

          {shown ? (
            <Animated.View
              key={shown}
              entering={
                reduceMotion
                  ? undefined
                  : FadeIn.duration(motion.duration.select).withInitialValues({
                      opacity: 0,
                      transform: [{ translateY: 8 }],
                    })
              }
              style={[styles.panel, (typing || shown === "where") && styles.panelTyping]}
            >
              {shown === "length" ? (
                <>
                  <Text style={styles.readout}>
                    {minutes}
                    <Text style={styles.readoutUnit}> min</Text>
                  </Text>
                  <Ruler
                    count={(MAX_LEN - MIN_LEN) / LEN_STEP + 1}
                    index={Math.max(0, Math.min((MAX_LEN - MIN_LEN) / LEN_STEP, Math.round((minutes - MIN_LEN) / LEN_STEP)))}
                    step={16}
                    majorEvery={2}
                    label={(i) => String(MIN_LEN + i * LEN_STEP)}
                    onChange={(i) => {
                      setPicked(false);
                      setWanted(MIN_LEN + i * LEN_STEP);
                    }}
                    markIndex={suggestedLength ? (suggestedLength - MIN_LEN) / LEN_STEP : undefined}
                    accessibilityLabel="Walk length"
                    valueText={`${minutes} minutes`}
                  />
                  {goal ? (
                    <DayGoal
                      dogName={dogName}
                      goal={goal}
                      already={alreadyThatDay}
                      minutes={minutes}
                      today={planDayKey === todayKey}
                      suggested={suggestedLength}
                      onUseSuggested={() => {
                        if (!suggestedLength) return;
                        void Haptics.selectionAsync();
                        setPicked(false);
                        setWanted(suggestedLength);
                      }}
                    />
                  ) : (
                    <Text style={styles.panelNote}>Walks nearby are matched to this length.</Text>
                  )}
                </>
              ) : null}

              {shown === "where" ? (
                <>
                  {typing ? null : (
                    <View style={styles.whereHead}>
                      <Text style={styles.whereTitle}>{leg === "from" ? "Where does the walk start?" : "Where to?"}</Text>
                      {step === "compose" ? (
                        <PressScale
                          accessibilityRole="button"
                          accessibilityLabel="Done choosing the route"
                          hitSlop={10}
                          scaleTo={0.94}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setPanel(null);
                          }}
                        >
                          <Text style={styles.doneText}>Done</Text>
                        </PressScale>
                      ) : null}
                    </View>
                  )}
                  <View style={styles.route}>
                    <View style={styles.routeLine} pointerEvents="none" />
                    <LegInput
                      inputRef={fromRef}
                      which="from"
                      here={start?.source === "here"}
                      active={leg === "from"}
                      focused={focused === "from"}
                      value={focused === "from" ? drafts.from : fromValue}
                      placeholder="Where do you start?"
                      busy={focused === "from" && search.state === "looking"}
                      onFocus={() => {
                        setLeg("from");
                        setFocused("from");
                        setDrafts((current) => ({
                          ...current,
                          from: fromValue === "Finding you" ? "" : fromValue,
                        }));
                      }}
                      onChange={(value) => setDrafts((current) => ({ ...current, from: value }))}
                      onBlur={() => setFocused((current) => (current === "from" ? null : current))}
                    />
                    <LegInput
                      inputRef={toRef}
                      which="to"
                      active={leg === "to"}
                      focused={focused === "to"}
                      value={focused === "to" ? drafts.to : toValue}
                      placeholder="Where to?"
                      busy={(focused === "to" && search.state === "looking") || finding}
                      onFocus={() => {
                        setLeg("to");
                        setFocused("to");
                        setDrafts((current) => ({ ...current, to: toValue }));
                      }}
                      onChange={(value) => setDrafts((current) => ({ ...current, to: value }))}
                      onBlur={() => setFocused((current) => (current === "to" ? null : current))}
                    />
                  </View>

                  <ScrollView
                    style={{ maxHeight: typing ? searchListMax : browseMax }}
                    contentContainerStyle={styles.list}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {suggestions.map(({ key, ...row }) => (
                      <Suggestion key={key} {...row} />
                    ))}
                    {listNote ? (
                      <View style={styles.listNote}>
                        {search.state === "looking" || (leg === "to" && options.loading && !typing) ? (
                          <ActivityIndicator color={text.secondary} />
                        ) : null}
                        <Text style={styles.listNoteText}>{listNote}</Text>
                      </View>
                    ) : null}
                  </ScrollView>

                  {typing ? (
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel="Done"
                      scaleTo={0.96}
                      style={styles.done}
                      onPress={doneTyping}
                    >
                      <Text style={styles.doneText}>Done</Text>
                    </PressScale>
                  ) : leg === "to" && start ? (
                    <Text style={styles.panelNote}>Or tap a park on the map. Hold anywhere to drop a pin.</Text>
                  ) : null}
                </>
              ) : null}

              {shown === "when" ? (
                <>
                  {
                    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}>
                      <Text style={styles.readout}>
                        {clock(time)}
                        <Text style={styles.readoutUnit}>{`  ${routine ? repeatLabel(repeat!) : dayName(dayIndex)}`}</Text>
                      </Text>
                      <RepeatSwitch
                        routine={routine}
                        onChange={(next) => {
                          void Haptics.selectionAsync();
                          setRepeat(next ? (repeat?.length ? repeat : [1, 2, 3, 4, 5]) : null);
                        }}
                      />
                      {routine ? (
                        <WeekdayPicker days={repeat!} onChange={setRepeat} />
                      ) : (
                        <Ruler
                          count={DAY_COUNT}
                          index={dayIndex}
                          step={92}
                          majorEvery={1}
                          label={dayName}
                          onChange={setDayIndex}
                          accessibilityLabel="Day"
                          valueText={dayName(dayIndex)}
                        />
                      )}
                      <Ruler
                        count={T_COUNT}
                        index={(Math.max(time, minTime) - T0) / T_STEP}
                        minIndex={(minTime - T0) / T_STEP}
                        step={10}
                        majorEvery={12}
                        label={(i) => clock(T0 + i * T_STEP).replace(":00", "")}
                        onChange={(i) => setTime(Math.max(minTime, T0 + i * T_STEP))}
                        accessibilityLabel="Time"
                        valueText={clock(time)}
                      />
                      {usualTimes.length ? (
                        <View style={styles.usual}>
                          <Text style={styles.usualLabel}>Your usual</Text>
                          {usualTimes.map((value) => {
                            const on = value === time;
                            const past = !routine && value < minTime;
                            return (
                              <PressScale
                                key={value}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on, disabled: past }}
                                accessibilityLabel={`Usual walk time ${clock(value)}`}
                                disabled={past}
                                scaleTo={0.95}
                                style={[styles.usualChip, on && styles.usualChipOn, past && styles.usualChipPast]}
                                onPress={() => {
                                  void Haptics.selectionAsync();
                                  setTime(value);
                                }}
                              >
                                <Text style={[styles.usualText, past && styles.usualTextPast]}>{clock(value)}</Text>
                              </PressScale>
                            );
                          })}
                        </View>
                      ) : null}
                      <Text style={styles.panelNote}>
                        {plannedThatDay.length
                          ? `Already planned ${dayIndex < 2 ? dayName(dayIndex).toLowerCase() : `for ${dayName(dayIndex)}`}: ${plannedThatDay
                              .map((walk) => `${clock(Number(walk.time.slice(0, 2)) * 60 + Number(walk.time.slice(3, 5)))} (${span(walk.minutes)})`)
                              .join(", ")}.`
                          : "PAWS reminds you when it is time."}
                      </Text>
                    </Animated.View>
                  }
                </>
              ) : null}
            </Animated.View>
          ) : null}

          {typing ? null : (
            <View style={styles.actions}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={step === "compose" ? "Next, plan this walk for later" : "Back"}
                scaleTo={0.96}
                style={styles.secondary}
                onPress={step === "compose" ? startPlanning : stepBack}
              >
                <Text style={styles.secondaryText}>{step === "compose" ? "Next" : "Back"}</Text>
              </PressScale>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                disabled={primaryOff}
                scaleTo={0.97}
                style={[styles.primary, primaryOff && styles.primaryOff]}
                onPress={primaryPress}
              >
                <Text style={[styles.primaryText, primaryOff && styles.primaryTextOff]} numberOfLines={1}>
                  {primaryLabel}
                </Text>
                {!primaryOff && !syncing && !finding ? <ArrowRightIcon size={iconSize.button} color={text.primary} weight="bold" /> : null}
              </PressScale>
            </View>
          )}

          {editing && !typing && step === "compose" ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Remove this planned walk"
              scaleTo={0.96}
              style={styles.remove}
              onPress={() => {
                void Haptics.selectionAsync();
                cancelPlannedWalk(editing.id);
                router.back();
              }}
            >
              <Text style={styles.removeText}>Remove this plan</Text>
            </PressScale>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const Plain = ({ text: words }: { text: string }) => (
  <>
    {words.split(" ").map((word, i) => (
      <Text key={`${word}-${i}`} style={[styles.sentenceText, styles.item]}>
        {word}
      </Text>
    ))}
  </>
);

const Token = ({
  text: value,
  open,
  linked = false,
  suffix,
  onPress,
}: {
  text: string;
  open: boolean;
  linked?: boolean;
  suffix?: string;
  onPress: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const level = open ? 1 : linked ? 0.45 : 0;
  const fill = useDerivedValue(
    () =>
      reduceMotion
        ? level
        : withTiming(level, {
            duration: motion.duration.select,
            easing: motion.easing.out,
          }),
    [level],
  );
  const wash = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.94 + fill.value * 0.06 }],
  }));
  return (
    <View style={[styles.item, styles.tokenRow]}>
      <PressScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${value}. Tap to change.`}
        scaleTo={0.97}
        style={styles.tokenPress}
        onPress={onPress}
      >
        <View>
          <Animated.View style={[styles.wash, wash]} />
          <View style={styles.underline} />
          <Text style={[styles.sentenceText, styles.tokenText]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </PressScale>
      {suffix ? <Text style={styles.sentenceText}>{suffix}</Text> : null}
    </View>
  );
};

/**
 * The day's walking as a ring: ink for what is already walked or planned, butter for this walk. One sentence says
 * where that leaves the dog, and a single chip fills the gap when there is one.
 */
const DayGoal = ({
  dogName,
  goal,
  already,
  minutes,
  today,
  suggested,
  onUseSuggested,
}: {
  dogName: string;
  goal: number;
  already: number;
  minutes: number;
  today: boolean;
  suggested: number | null;
  onUseSuggested: () => void;
}) => {
  const total = already + minutes;
  const covered = total >= goal;
  const R = 22;
  const C = 2 * Math.PI * R;
  const part = (value: number) => Math.min(1, value / goal) * C;
  const lead = covered ? `That covers ${dogName}'s day.` : `${span(goal - total)} short of ${dogName}'s day.`;
  const context = already > 0 ? `${span(already)} ${today ? "already walked or planned today" : "already planned that day"}. ` : "";
  return (
    <View style={styles.goal} accessibilityLabel={`${span(total)} of ${span(goal)} a day. ${lead}`}>
      <View style={styles.goalRing}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Circle cx={28} cy={28} r={R} stroke={border.soft} strokeWidth={6} fill="none" />
          <Circle
            cx={28}
            cy={28}
            r={R}
            stroke={accent.deep}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${part(total)} ${C}`}
            transform="rotate(-90 28 28)"
          />
          {already > 0 ? (
            <Circle
              cx={28}
              cy={28}
              r={R}
              stroke={text.primary}
              strokeWidth={6}
              fill="none"
              strokeDasharray={`${part(already)} ${C}`}
              transform="rotate(-90 28 28)"
            />
          ) : null}
        </Svg>
        <View style={styles.goalRingLabel} pointerEvents="none">
          {covered ? (
            <CheckIcon size={16} color={text.primary} weight="bold" />
          ) : (
            <Text style={styles.goalPct}>{`${Math.round((total / goal) * 100)}%`}</Text>
          )}
        </View>
      </View>
      <View style={styles.goalCopy}>
        <Text style={styles.goalLead}>
          <Text style={styles.goalStrong}>{`${span(total)} of ${span(goal)}`}</Text>
          {" a day"}
        </Text>
        <Text style={styles.goalText}>{context + lead}</Text>
      </View>
      {suggested && suggested !== minutes && !covered ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Make this walk ${span(suggested)}`}
          scaleTo={0.94}
          style={styles.goalUse}
          onPress={onUseSuggested}
        >
          <Text style={styles.goalUseText}>{span(suggested)}</Text>
        </PressScale>
      ) : null}
    </View>
  );
};

const LegInput = ({
  inputRef,
  which,
  here = false,
  active,
  focused,
  value,
  placeholder,
  busy,
  onFocus,
  onChange,
  onBlur,
}: {
  inputRef: React.RefObject<TextInput | null>;
  which: Leg;
  /** The start is the phone's own position, so it gets the location arrow. */
  here?: boolean;
  active: boolean;
  focused: boolean;
  value: string;
  placeholder: string;
  busy: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}) => (
  <PressScale
    accessibilityRole="search"
    accessibilityLabel={which === "from" ? "Start" : "Destination"}
    scaleTo={0.99}
    style={[styles.leg, active && styles.legActive]}
    onPress={() => inputRef.current?.focus()}
  >
    <View style={styles.legIcon}>
      {which === "from" ? (
        <View style={styles.dotFrom}>
          {here ? <NavigationArrowIcon size={11} color={text.inverse} weight="fill" /> : <View style={styles.dotFromCore} />}
        </View>
      ) : (
        <View style={styles.dotTo}>
          <MapPinIcon size={12} color={text.primary} weight="fill" />
        </View>
      )}
    </View>
    <TextInput
      ref={inputRef}
      style={styles.legInput}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={text.tertiary}
      onFocus={onFocus}
      onBlur={onBlur}
      onChangeText={onChange}
      selectTextOnFocus
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel={which === "from" ? "Search for where you start" : "Search for where to walk"}
    />
    {busy ? (
      <ActivityIndicator size="small" color={text.secondary} />
    ) : focused && value ? (
      <PressScale accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} scaleTo={0.9} onPress={() => onChange("")}>
        <XCircleIcon size={18} color={text.tertiary} weight="fill" />
      </PressScale>
    ) : null}
  </PressScale>
);

const Suggestion = ({
  Glyph,
  title,
  meta,
  on,
  trailing,
  onPress,
}: {
  Glyph: ComponentType<IconProps>;
  title: string;
  meta: string;
  on: boolean;
  trailing: string | null;
  onPress: () => void;
}) => (
  <PressScale
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    accessibilityLabel={[title, meta, trailing].filter(Boolean).join(", ")}
    scaleTo={0.98}
    style={[styles.row, on && styles.rowOn]}
    onPress={onPress}
  >
    <View style={[styles.rowIcon, on && styles.rowIconOn]}>
      <Glyph size={16} color={text.primary} weight={on ? "fill" : "regular"} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
    {trailing ? <Text style={styles.rowTrailing}>{trailing}</Text> : null}
    {on ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
  </PressScale>
);

const shadow = {
  shadowColor: "#1C1B1A",
  shadowOpacity: 0.14,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
};

/** Once, or a routine that repeats every week: a two-way switch, quiet until it is needed. */
const RepeatSwitch = ({ routine, onChange }: { routine: boolean; onChange: (routine: boolean) => void }) => (
  <View style={styles.repeatSwitch} accessibilityRole="tablist">
    {[
      { on: !routine, label: "Once", value: false },
      { on: routine, label: "Repeats", value: true },
    ].map((option) => (
      <PressScale
        key={option.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: option.on }}
        accessibilityLabel={option.label}
        scaleTo={0.96}
        style={[styles.repeatOption, option.on && styles.repeatOptionOn]}
        onPress={() => !option.on && onChange(option.value)}
      >
        <Text style={[styles.repeatText, option.on && styles.repeatTextOn]}>{option.label}</Text>
      </PressScale>
    ))}
  </View>
);

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const PRESETS: readonly { label: string; days: number[] }[] = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
];
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d) => b.includes(d));

/** Which days the routine runs: one tap presets, or tap single days. At least one day always stays on. */
const WeekdayPicker = ({ days, onChange }: { days: readonly number[]; onChange: (days: number[]) => void }) => (
  <View style={styles.weekPicker}>
    <View style={styles.weekRow}>
      {WEEK.map((day) => {
        const on = days.includes(day);
        return (
          <PressScale
            key={day}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}
            scaleTo={0.9}
            style={[styles.weekDay, on && styles.weekDayOn]}
            onPress={() => {
              if (on && days.length === 1) return;
              void Haptics.selectionAsync();
              onChange(on ? days.filter((d) => d !== day) : [...days, day]);
            }}
          >
            <Text style={[styles.weekDayText, on && styles.weekDayTextOn]}>{LETTER[day]}</Text>
          </PressScale>
        );
      })}
    </View>
    <View style={styles.presetRow}>
      {PRESETS.map((preset) => {
        const on = same(days, preset.days);
        return (
          <PressScale
            key={preset.label}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={preset.label}
            scaleTo={0.95}
            style={[styles.usualChip, on && styles.usualChipOn]}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange([...preset.days]);
            }}
          >
            <Text style={styles.usualText}>{preset.label}</Text>
          </PressScale>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  repeatSwitch: { flexDirection: "row", alignSelf: "flex-start", padding: 3, marginBottom: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  repeatOption: { height: 32, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: "center" },
  repeatOptionOn: { backgroundColor: bg.canvas, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  repeatText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  repeatTextOn: { color: text.primary },
  weekPicker: { marginTop: space.sm, marginBottom: space.md },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  weekDayOn: { backgroundColor: text.primary, borderColor: text.primary },
  weekDayText: { ...type.supporting, fontWeight: "600", color: text.primary },
  weekDayTextOn: { color: text.inverse },
  presetRow: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  screen: { flex: 1, backgroundColor: bg.stage },
  waiting: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  waitText: {
    ...type.supporting,
    color: text.secondary,
    textAlign: "center",
    paddingHorizontal: layout.gutter,
  },

  top: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
  },
  round: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },

  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: bg.canvas,
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: border.default,
    alignSelf: "center",
    marginBottom: space.lg,
  },

  sentence: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    rowGap: 6,
  },
  item: { marginRight: 6 },
  sentenceText: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontWeight: "500",
    color: text.secondary,
  },
  tokenRow: { flexDirection: "row", alignItems: "flex-end", maxWidth: "100%" },
  tokenPress: { flexShrink: 1 },
  tokenText: { fontWeight: "600", color: text.primary },
  wash: {
    position: "absolute",
    top: 1,
    bottom: -1,
    left: -6,
    right: -6,
    borderRadius: 10,
    backgroundColor: accent.primary,
  },
  underline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  note: { ...type.supporting, color: text.secondary, marginTop: space.md },

  panel: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: border.soft,
  },
  panelTyping: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  readout: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    fontWeight: "700",
    color: text.primary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  readoutUnit: {
    ...type.body,
    fontWeight: "600",
    color: text.secondary,
    letterSpacing: 0,
  },
  panelNote: {
    ...type.caption,
    color: text.tertiary,
    textAlign: "center",
    marginTop: space.md,
  },

  route: {
    padding: 6,
    gap: 4,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  routeLine: {
    position: "absolute",
    left: 6 + 12 + 13,
    top: 6 + 24 + 12,
    bottom: 6 + 24 + 12,
    width: 2,
    borderRadius: 1,
    backgroundColor: border.strong,
  },
  leg: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    height: 48,
    paddingLeft: 12,
    paddingRight: space.md,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  legActive: { backgroundColor: bg.canvas, borderColor: accent.deep },
  legIcon: { width: 28, alignItems: "center" },
  dotFrom: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFromCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
  dotTo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  legInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: text.primary,
    paddingVertical: 0,
  },

  list: { paddingTop: space.sm, gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: ROW,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
  },
  rowOn: { backgroundColor: accent.soft },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconOn: { backgroundColor: accent.primary },
  rowText: { flex: 1, gap: 1 },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    color: text.primary,
  },
  rowMeta: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 17,
    color: text.secondary,
  },
  rowTrailing: {
    ...type.supporting,
    fontWeight: "600",
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  listNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: ROW,
    paddingHorizontal: space.sm,
  },
  listNoteText: { ...type.supporting, color: text.secondary, flex: 1 },
  done: {
    alignSelf: "flex-end",
    marginTop: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  doneText: { ...type.supporting, fontWeight: "700", color: text.primary },

  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  secondary: {
    height: layout.controlHeight,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 16, lineHeight: 20, fontWeight: "700", color: text.primary },
  whereHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  whereTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontWeight: "700", color: text.primary },
  usual: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: space.lg },
  usualLabel: { ...type.caption, fontWeight: "600", color: text.secondary, marginRight: 2 },
  usualChip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: bg.subtle },
  usualChipOn: { backgroundColor: accent.primary },
  usualChipPast: { opacity: 0.45 },
  usualText: { ...type.supporting, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  usualTextPast: { textDecorationLine: "line-through" },
  modes: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: bg.subtle, marginBottom: space.lg },
  mode: { flex: 1, flexDirection: "row", gap: 6, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  modeOn: {
    backgroundColor: bg.canvas,
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  modeText: { ...type.supporting, fontWeight: "600", color: text.tertiary },
  modeTextOn: { color: text.primary, fontWeight: "700" },
  goal: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  goalRing: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  goalRingLabel: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  goalPct: { ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  goalCopy: { flex: 1 },
  goalLead: { ...type.supporting, color: text.secondary },
  goalStrong: { fontSize: 17, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  goalText: { ...type.caption, fontSize: 13, lineHeight: 18, color: text.secondary, marginTop: 2 },
  goalUse: { paddingHorizontal: space.md, height: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: accent.primary },
  goalUseText: { ...type.supporting, fontWeight: "700", color: text.primary },
  stepHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  stepText: { ...type.caption, fontWeight: "600", color: text.secondary },
  stepBars: { flexDirection: "row", gap: 4 },
  stepBar: { width: 20, height: 4, borderRadius: 2, backgroundColor: border.default },
  stepBarOn: { backgroundColor: accent.deep },
  primary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  primaryOff: { backgroundColor: bg.subtle },
  primaryText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: text.primary,
  },
  primaryTextOff: { color: text.disabled },
  remove: {
    alignSelf: "center",
    marginTop: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  saveText: { ...type.supporting, fontWeight: "700", color: text.primary },
  removeText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
