import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowsClockwiseIcon, CaretDownIcon, CaretLeftIcon, CheckIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ROOM_ERRORS, roomErrorText } from "@/features/rooms/roomCopy";
import { walkThrough } from "@/features/care/walk/routePlanner";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import { useRoom } from "@/hooks/useRoom";
import { proposeMafiaRoute, saveMafiaSetup } from "@/services/roomService";
import { validateSetup } from "../../../supabase/functions/rooms/logic";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

type LatLng = { latitude: number; longitude: number };
type Audience = "all" | "civilian" | "mafia";
type Pin = LatLng & { label: string; audience: Audience };
type Placing = "meet" | Audience;

const AUDIENCE_COLOR: Record<Audience, string> = { all: text.primary, civilian: "#3F7A5C", mafia: "#C2552A" };
const PLACE: { key: Placing; label: string; color: string }[] = [
  { key: "meet", label: "Meet", color: text.primary },
  { key: "all", label: "Everyone", color: AUDIENCE_COLOR.all },
  { key: "civilian", label: "Civilians", color: AUDIENCE_COLOR.civilian },
  { key: "mafia", label: "Mafia", color: AUDIENCE_COLOR.mafia },
];
const TAG: Record<Audience, string> = { all: "Everyone", civilian: "Civilians", mafia: "Mafia" };
const WALK = [10, 15, 20];
const TALK = [60, 120, 180];
const VOTE = [30, 60];
const ZOOM = { latitudeDelta: 0.009, longitudeDelta: 0.009 };

/** Default objectives written from the pins, which the host can edit. */
const objectiveFor = (pins: readonly Pin[], role: "civilian" | "mafia") => {
  const numbered = pins.map((p, i) => ({ ...p, n: i + 1 }));
  const shared = numbered.filter((p) => p.audience === "all").map((p) => p.n);
  const own = numbered.filter((p) => p.audience === role).map((p) => p.n);
  const list = (ns: number[]) => (ns.length > 1 ? `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}` : String(ns[0] ?? ""));
  if (role === "civilian") return `Walk to checkpoints ${list([...shared, ...own])}, then come back to the meeting point.`;
  return `Reach your secret checkpoint ${list(own)} without being noticed, then blend in by visiting ${shared.length ? list(shared) : "the others"}.`;
};

type Finding = "idle" | "finding" | "manual";

/**
 * The host's route for Find the Mafia. It opens with one already drawn from real street corners around the host: two
 * stops for everyone, one only Civilians get, one only the Mafia gets. Shuffle draws another; tapping the map adds a
 * stop by hand. Walking previews come from Google; where none is found, a dotted straight line says so.
 */
export default function MafiaSetupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // The room screen underneath keeps the live channel; this screen only reads the room.
  const room = useRoom(id, { live: false });
  const saved = room.state?.setup;
  const map = useRef<MapView | null>(null);
  const loaded = useRef(false);
  const here = useRef<LatLng | null>(null);

  const [meet, setMeet] = useState<LatLng | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [placing, setPlacing] = useState<Placing>("all");
  const [walk, setWalk] = useState(15);
  const [talk, setTalk] = useState(60);
  const [vote, setVote] = useState(30);
  const [civObjective, setCivObjective] = useState("");
  const [mafiaObjective, setMafiaObjective] = useState("");
  const [edited, setEdited] = useState({ civ: false, mafia: false });
  const [safe, setSafe] = useState(false);
  const [more, setMore] = useState(false);
  const [finding, setFinding] = useState<Finding>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<{ civilian: LatLng[] | null; mafia: LatLng[] | null; minutes: { civilian: number | null; mafia: number | null }; approximate: boolean }>({
    civilian: null,
    mafia: null,
    minutes: { civilian: null, mafia: null },
    approximate: false,
  });

  const fit = (points: LatLng[]) => {
    if (points.length < 2) return;
    map.current?.fitToCoordinates(points, { edgePadding: { top: insets.top + 72, right: 48, bottom: 88, left: 48 }, animated: !reduceMotion });
  };

  /** Asks the server for a route from real corners around the host (or the meeting point, when one is set). */
  const suggest = async (minutes = walk) => {
    if (!id) return;
    setError(null);
    setFinding("finding");
    try {
      let from = here.current;
      if (!from) {
        const access = await LocationTracking.requestAccess();
        from = access === "granted" ? await LocationTracking.current() : null;
        here.current = from;
      }
      if (!from) throw Object.assign(new Error("location_needed"), { code: "location_needed" });
      const r = await proposeMafiaRoute(id, from, minutes);
      setMeet(r.meet);
      setPins(r.checkpoints);
      setPlacing("all");
      setSafe(false);
      setFinding("idle");
      void Haptics.selectionAsync();
      fit([r.meet, ...r.checkpoints]);
    } catch (e) {
      setFinding("manual");
      setError(roomErrorText((e as { code?: string }).code));
      if (here.current) map.current?.animateToRegion({ ...here.current, ...ZOOM }, 0);
    }
  };

  // Start from the saved plan, or draw one from where the host is standing.
  useEffect(() => {
    if (loaded.current || !room.state) return;
    loaded.current = true;
    if (saved && saved.checkpoints?.length) {
      const m = saved.meet_lat != null && saved.meet_lng != null ? { latitude: saved.meet_lat, longitude: saved.meet_lng } : null;
      setMeet(m);
      setPins(saved.checkpoints);
      setWalk(saved.settings?.walkMinutes ?? 15);
      setTalk(saved.settings?.discussionSeconds ?? 60);
      setVote(saved.settings?.votingSeconds ?? 30);
      setCivObjective(saved.civilian_objective);
      setMafiaObjective(saved.mafia_objective);
      setEdited({ civ: Boolean(saved.civilian_objective), mafia: Boolean(saved.mafia_objective) });
      setSafe(saved.confirmed_safe);
      setTimeout(() => fit([...(m ? [m] : []), ...saved.checkpoints]), 300);
    } else {
      void suggest(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.state, saved]);

  // Objectives follow the pins until the host writes their own.
  useEffect(() => {
    if (!edited.civ) setCivObjective(pins.some((p) => p.audience !== "mafia") ? objectiveFor(pins, "civilian") : "");
    if (!edited.mafia) setMafiaObjective(pins.some((p) => p.audience === "mafia") ? objectiveFor(pins, "mafia") : "");
  }, [pins, edited]);

  // Walking previews for each role: the meeting point, that role's stops in order, and back.
  const order = useMemo(() => {
    const path = (role: "civilian" | "mafia") => (meet ? [meet, ...pins.filter((p) => p.audience === "all" || p.audience === role), meet] : pins.filter((p) => p.audience === "all" || p.audience === role));
    return { civilian: path("civilian"), mafia: path("mafia") };
  }, [meet, pins]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const [civ, maf] = await Promise.all([
        order.civilian.length >= 2 ? walkThrough(order.civilian) : Promise.resolve(null),
        order.mafia.length >= 2 ? walkThrough(order.mafia) : Promise.resolve(null),
      ]);
      if (!live) return;
      const approximate = (order.civilian.length >= 2 && !civ) || (order.mafia.length >= 2 && !maf);
      setRoutes({
        civilian: civ?.path ?? (order.civilian.length >= 2 ? order.civilian : null),
        mafia: maf?.path ?? (order.mafia.length >= 2 ? order.mafia : null),
        minutes: { civilian: civ ? Math.round(civ.minutes) : null, mafia: maf ? Math.round(maf.minutes) : null },
        approximate,
      });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [order]);

  /** From the first change by hand, the route is the host's: a new walking time keeps it. */
  const byHand = () => {
    setSafe(false);
    setFinding((f) => (f === "finding" ? f : "manual"));
  };

  const onMapPress = (p: LatLng) => {
    void Haptics.selectionAsync();
    byHand();
    if (placing === "meet") {
      setMeet(p);
      setPlacing("all");
      return;
    }
    if (pins.length >= 8) {
      setError(ROOM_ERRORS.too_many_checkpoints);
      return;
    }
    setPins((list) => [...list, { ...p, label: `Checkpoint ${list.length + 1}`, audience: placing }]);
  };

  const problem = validateSetup(pins);
  const save = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await saveMafiaSetup(id, {
        meet_lat: meet?.latitude ?? null,
        meet_lng: meet?.longitude ?? null,
        checkpoints: pins.map((p, i) => ({ ...p, label: p.label.trim() || `Checkpoint ${i + 1}` })),
        civilian_objective: civObjective.trim(),
        mafia_objective: mafiaObjective.trim(),
        settings: { walkMinutes: walk, discussionSeconds: talk, votingSeconds: vote },
        confirmed_safe: safe,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  const longest = Math.max(routes.minutes.civilian ?? 0, routes.minutes.mafia ?? 0);
  const blocker = finding === "finding" ? "Finding corners near you" : !meet ? "Tap the map for the meeting point" : problem ? roomErrorText(problem) : !safe ? "Confirm the spots are safe" : null;

  return (
    <View style={styles.flex}>
      <View style={styles.mapWrap}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={saved?.meet_lat != null && saved?.meet_lng != null ? { latitude: saved.meet_lat, longitude: saved.meet_lng, ...ZOOM } : undefined}
          onPress={(e) => onMapPress(e.nativeEvent.coordinate)}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {routes.civilian ? <Polyline coordinates={routes.civilian} strokeColor={AUDIENCE_COLOR.civilian} strokeWidth={5} lineDashPattern={routes.approximate ? [2, 8] : undefined} /> : null}
          {routes.mafia ? <Polyline coordinates={routes.mafia} strokeColor={AUDIENCE_COLOR.mafia} strokeWidth={4} lineDashPattern={[8, 8]} /> : null}
          {meet ? (
            <Marker coordinate={meet} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.meetPin}>
                <View style={styles.meetDot} />
              </View>
            </Marker>
          ) : null}
          {pins.map((p, i) => (
            <Marker key={`${i}-${p.audience}-${p.latitude}`} coordinate={p} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.pin, { backgroundColor: AUDIENCE_COLOR[p.audience] }]}>
                <Text style={styles.pinText}>{i + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={[styles.round, { top: insets.top + space.sm, left: space.lg }]} onPress={() => router.back()}>
          <CaretLeftIcon size={20} color={text.primary} weight="bold" />
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Shuffle: draw another route"
          disabled={finding === "finding"}
          scaleTo={0.94}
          style={[styles.shuffle, { top: insets.top + space.sm }]}
          onPress={() => void suggest()}
        >
          {finding === "finding" ? <ActivityIndicator size="small" color={text.primary} /> : <ArrowsClockwiseIcon size={18} color={text.primary} weight="bold" />}
          <Text style={styles.shuffleText}>Shuffle</Text>
        </PressScale>

        {/* What a tap on the map adds. */}
        <View style={styles.placing}>
          {PLACE.map((p) => {
            const on = placing === p.key;
            return (
              <PressScale key={p.key} accessibilityRole="button" accessibilityLabel={`Tap the map to add: ${p.label}`} accessibilityState={{ selected: on }} scaleTo={0.95} style={[styles.placeChip, on && styles.placeChipOn]} onPress={() => setPlacing(p.key)}>
                {p.key === "meet" ? <View style={[styles.placeMeet, on && styles.placeMeetOn]} /> : <View style={[styles.placeDot, { backgroundColor: on ? "#FFFFFF" : p.color }]} />}
                <Text style={[styles.placeText, on && styles.placeTextOn]}>{p.label}</Text>
              </PressScale>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 130 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <Text style={styles.title}>Route</Text>
          {longest > 0 ? (
            <Animated.View key={longest} entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.duration(200).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] })} style={[styles.minutes, longest > walk && styles.minutesOver]}>
              <Text style={styles.minutesText}>{`${longest} min walk`}</Text>
            </Animated.View>
          ) : null}
        </View>
        {routes.approximate ? <Text style={styles.warn}>Dotted lines are straight, not paths. Check those yourself.</Text> : null}

        {/* The stops, in walking order. */}
        <View style={styles.stops}>
          {pins.map((p, i) => (
            <Animated.View
              key={`${i}-${p.audience}-${p.latitude}`}
              entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.delay(i * 40).duration(220).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
              exiting={FadeOut.duration(120)}
              layout={reduceMotion ? undefined : LinearTransition.duration(200).easing(motion.easing.out)}
              style={styles.stop}
            >
              <View style={[styles.stopNo, { backgroundColor: AUDIENCE_COLOR[p.audience] }]}>
                <Text style={styles.pinText}>{i + 1}</Text>
              </View>
              <View style={styles.flexOnly}>
                <Text style={styles.stopName} numberOfLines={1}>
                  {p.label}
                </Text>
                <Text style={[styles.stopTag, { color: AUDIENCE_COLOR[p.audience] }]}>{TAG[p.audience]}</Text>
              </View>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Remove stop ${i + 1}`}
                scaleTo={0.9}
                style={styles.remove}
                onPress={() => {
                  byHand();
                  setPins((list) => list.filter((_, k) => k !== i));
                }}
              >
                <XIcon size={14} color={text.secondary} weight="bold" />
              </PressScale>
            </Animated.View>
          ))}
          {finding === "finding" && !pins.length
            ? [0, 1, 2, 3].map((k) => <View key={k} style={styles.stopSkeleton} />)
            : null}
        </View>

        <Text style={styles.label}>Walk</Text>
        <Chips
          values={WALK}
          value={walk}
          onChange={(v) => {
            setWalk(v);
            // A route drawn for another walking time is redrawn; one placed by hand is kept.
            if (finding !== "manual") void suggest(v);
          }}
          format={(v) => `${v} min`}
        />

        <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: safe }} scaleTo={0.98} style={[styles.safety, safe && styles.safetyOn]} onPress={() => setSafe((v) => !v)}>
          <View style={[styles.box, safe && styles.boxOn]}>{safe ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}</View>
          <Text style={styles.safetyText}>Every stop is public and safe to reach on foot</Text>
        </PressScale>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressScale accessibilityRole="button" accessibilityState={{ expanded: more }} scaleTo={0.98} style={styles.moreRow} onPress={() => setMore((v) => !v)}>
          <Text style={styles.moreText}>Talk, vote and objectives</Text>
          <View style={more ? styles.caretUp : undefined}>
            <CaretDownIcon size={16} color={text.secondary} weight="bold" />
          </View>
        </PressScale>
        {more ? (
          <Animated.View entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.duration(220).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })} style={styles.moreBody}>
            <Text style={styles.label}>Talk</Text>
            <Chips values={TALK} value={talk} onChange={setTalk} format={(v) => `${v / 60} min`} />
            <Text style={styles.label}>Vote</Text>
            <Chips values={VOTE} value={vote} onChange={setVote} format={(v) => `${v} s`} />
            <Text style={styles.label}>Civilians</Text>
            <TextInput value={civObjective} onChangeText={(v) => { setCivObjective(v); setEdited((e) => ({ ...e, civ: true })); }} multiline maxLength={300} style={styles.objective} accessibilityLabel="Civilian objective" />
            <Text style={styles.label}>Mafia</Text>
            <TextInput value={mafiaObjective} onChangeText={(v) => { setMafiaObjective(v); setEdited((e) => ({ ...e, mafia: true })); }} multiline maxLength={300} style={styles.objective} accessibilityLabel="Mafia objective" />
            <Text style={styles.note}>You see both routes, but not who the Mafia is.</Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Save route" sub={blocker ?? undefined} disabled={Boolean(blocker)} busy={busy} onPress={() => void save()} />
      </View>
    </View>
  );
}

const Chips = ({ values, value, onChange, format }: { values: number[]; value: number; onChange: (v: number) => void; format: (v: number) => string }) => (
  <View style={styles.chips}>
    {values.map((v) => (
      <PressScale key={v} accessibilityRole="button" accessibilityState={{ selected: v === value }} scaleTo={0.96} style={[styles.chip, v === value && styles.chipOn]} onPress={() => onChange(v)}>
        <Text style={[styles.chipText, v === value && styles.chipTextOn]}>{format(v)}</Text>
      </PressScale>
    ))}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  mapWrap: { height: "52%", backgroundColor: bg.stage, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  round: { position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  shuffle: { position: "absolute", right: space.lg, height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: accent.deep },
  shuffleText: { fontSize: 15, fontWeight: "800", color: text.primary },
  placing: { position: "absolute", left: space.md, right: space.md, bottom: space.md, flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.94)" },
  placeChip: { flex: 1, height: 36, flexDirection: "row", gap: 6, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  placeChipOn: { backgroundColor: text.primary },
  placeDot: { width: 8, height: 8, borderRadius: 4 },
  placeMeet: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: text.primary },
  placeMeetOn: { borderColor: "#FFFFFF" },
  placeText: { fontSize: 12, fontWeight: "800", color: text.primary },
  placeTextOn: { color: "#FFFFFF" },
  meetPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: text.primary, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  meetDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
  pin: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pinText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.xl },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.7, color: text.primary },
  minutes: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  minutesOver: { backgroundColor: "#FBE6D9" },
  minutesText: { fontSize: 13, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  warn: { ...type.caption, color: "#9A5B12", marginTop: space.sm },
  stops: { gap: space.sm, marginTop: space.lg },
  stop: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: 18, backgroundColor: bg.subtle },
  stopNo: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stopName: { fontSize: 15, fontWeight: "800", letterSpacing: -0.1, color: text.primary },
  stopTag: { fontSize: 12, fontWeight: "800", marginTop: 1 },
  stopSkeleton: { height: 54, borderRadius: 18, backgroundColor: bg.subtle },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: bg.canvas },
  label: { fontSize: 13, fontWeight: "800", color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },
  chipOn: { backgroundColor: text.primary },
  chipText: { fontSize: 14, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  chipTextOn: { color: "#FFFFFF" },
  safety: { flexDirection: "row", gap: space.md, alignItems: "center", marginTop: space.xl, padding: space.lg, borderRadius: 18, backgroundColor: accent.soft },
  safetyOn: { backgroundColor: "#EAF3EC" },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: accent.deep, borderColor: accent.band },
  safetyText: { fontSize: 15, fontWeight: "700", color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.md },
  moreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, paddingVertical: space.md },
  moreText: { fontSize: 15, fontWeight: "800", color: text.secondary },
  caretUp: { transform: [{ rotate: "180deg" }] },
  moreBody: { paddingBottom: space.lg },
  objective: { minHeight: 72, padding: space.md, borderRadius: radius.input, backgroundColor: bg.subtle, ...type.supporting, color: text.primary, textAlignVertical: "top" },
  note: { ...type.caption, color: text.secondary, marginTop: space.md },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
