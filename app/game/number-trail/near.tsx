import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowClockwiseIcon, CaretLeftIcon, CheckIcon, CrosshairIcon, MapPinSimpleIcon, ShieldCheckIcon, StopIcon, WarningIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import { CourseMap, type CourseMapHandle } from "@/features/numberTrail/components/CourseMap";
import { MeetingPointPicker } from "@/features/numberTrail/components/MeetingPointPicker";
import { NtPracticeLive } from "@/features/numberTrail/components/NtPracticeLive";
import { NtPracticeResult } from "@/features/numberTrail/components/NtPracticeResult";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { NumberGrid } from "@/features/numberTrail/components/NumberGrid";
import { IndeterminateTrail } from "@/features/numberTrail/components/RacePieces";
import {
  DEFAULT_RADIUS,
  POOR_ACCURACY_M,
  RADII,
  WARNING_LABELS,
  kmText,
  placeLabel,
  radiusText,
  routeName,
  scanSummary,
  type NumberAvailability,
  type Radius,
  type SearchPlace,
} from "@/features/numberTrail/discoveryFlow";
import { directionsUrl, practiceStore, type SavedPractice } from "@/features/numberTrail/practiceFlow";
import { numberErrorText } from "@/features/numberTrail/raceCopy";
import { drawableCourse } from "@/features/numberTrail/raceView";
import { NT } from "@/features/numberTrail/theme";
import { useNumberDiscovery } from "@/features/numberTrail/useNumberDiscovery";
import { beginPractice, listNearbyRoutes, type PracticeResult, type RouteOption } from "@/services/numberRaceService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

type Step = "locate" | "numbers" | "routes" | "walk" | "result";

/**
 * Number Trail, location first: share where you are (or pick a spot, labelled as such), see which numbers from 0 to 99
 * the streets around you can really draw, pick one, see every distinct route for it, choose one, then walk it or race
 * on it. Every number, route and length shown here came from the server's check of real streets.
 */
export default function NumbersNearYou() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("locate");
  const [place, setPlace] = useState<SearchPlace | null>(null);
  const [radiusM, setRadius] = useState<Radius>(DEFAULT_RADIUS);
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const scan = useNumberDiscovery();
  const [number, setNumber] = useState<NumberAvailability | null>(null);
  const [practice, setPractice] = useState<SavedPractice | null>(null);
  const [result, setResult] = useState<{ result: PracticeResult; officialM: number } | null>(null);

  // A walk in progress survives leaving the screen or a restart.
  useEffect(() => {
    void practiceStore.load().then((p) => {
      if (!p) return;
      setPractice(p);
      setStep("walk");
    });
  }, []);

  const startScan = useCallback(
    (p: SearchPlace, r: Radius) => {
      setPlace(p);
      setRadius(r);
      setStep("numbers");
      void scan.scan(p, r);
    },
    [scan],
  );

  const useMyLocation = async () => {
    setLocateNote(null);
    setLocating(true);
    const access = await LocationTracking.requestAccess();
    if (access !== "granted") {
      setLocating(false);
      setLocateNote("Location is off for PAWS. Pick a spot on the map instead, or allow location in Settings.");
      return;
    }
    const fix = await LocationTracking.current();
    setLocating(false);
    if (!fix) return setLocateNote("Couldn't get a GPS fix. Step outside and try again, or pick a spot.");
    if ((fix.accuracyM ?? Infinity) > POOR_ACCURACY_M) return setLocateNote(`Your GPS is too vague right now (about ${Math.round(fix.accuracyM ?? 0)} m). Try again outside, or pick a spot.`);
    void Haptics.selectionAsync();
    startScan({ latitude: fix.latitude, longitude: fix.longitude, manual: false, accuracyM: fix.accuracyM }, radiusM);
  };

  const walk = async (route: RouteOption) => {
    const r = await beginPractice(route.id);
    const saved: SavedPractice = { practiceId: r.practiceId, sessionId: r.sessionId, startedAt: r.startedAt, number: r.number, officialM: r.officialM, course: r.course };
    await practiceStore.save(saved);
    setPractice(saved);
    setStep("walk");
  };

  if (step === "walk" && practice)
    return (
      <NtPracticeLive
        practice={practice}
        onFinished={(r) => {
          void practiceStore.clear();
          setResult(r);
          setStep("result");
        }}
        onQuit={() => {
          void practiceStore.clear();
          setPractice(null);
          setStep(place ? "routes" : "locate");
        }}
      />
    );

  if (step === "result" && result && practice)
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.xl }]}>
        <NtPracticeResult
          number={practice.number}
          result={result.result}
          officialM={result.officialM}
          insetBottom={insets.bottom}
          onAgain={() => {
            setResult(null);
            setPractice(null);
            setStep(place ? "routes" : "locate");
          }}
          onNew={() => {
            setResult(null);
            setPractice(null);
            setStep(place ? "numbers" : "locate");
          }}
        />
      </View>
    );

  const back = () => {
    if (step === "locate") return goBack("/game/tournament");
    if (step === "routes") return setStep("numbers");
    scan.stop();
    setStep("locate");
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={back}>
          <CaretLeftIcon size={22} color={text.primary} weight="bold" />
        </PressScale>
        {step === "numbers" && place ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Check again" style={styles.round} disabled={scan.running} onPress={() => startScan(place, radiusM)}>
            <ArrowClockwiseIcon size={20} color={scan.running ? text.disabled : text.primary} weight="bold" />
          </PressScale>
        ) : null}
      </View>

      {step === "locate" ? (
        <Animated.View key="locate" entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.duration(200).easing(motion.easing.out).withInitialValues({ transform: [{ translateY: 8 }] })} style={[styles.flex, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.locateTop}>
            <NumberGlyph value="23" height={96} stroke={0.3} />
            <Text style={styles.title}>Numbers Near You</Text>
            <Text style={styles.sub}>See what you can draw on nearby streets.</Text>
            <View style={styles.privacy}>
              <ShieldCheckIcon size={20} color={NT.two} weight="fill" />
              <Text style={styles.privacyText}>PAWS uses your location once to check the streets around you. Other players never see it.</Text>
            </View>
            {locateNote ? (
              <View style={styles.note} accessibilityLiveRegion="polite">
                <WarningIcon size={16} color="#B4442C" weight="fill" />
                <Text style={styles.noteText}>{locateNote}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            <RaisedButton label="Find numbers near me" busy={locating} onPress={() => void useMyLocation()} />
            <RaisedButton tone="white" label="Pick a spot on the map" onPress={() => setPicking(true)} />
          </View>
        </Animated.View>
      ) : null}

      {step === "numbers" && place ? (
        <NumberGrid
          numbers={onlyAvailable ? scan.numbers.filter((n) => n.status === "AVAILABLE") : scan.numbers}
          bottomInset={insets.bottom + space.xl}
          onPick={(n) => {
            setNumber(n);
            setStep("routes");
          }}
          header={
            <NumbersHeader
              place={place}
              radiusM={radiusM}
              scan={scan}
              onlyAvailable={onlyAvailable}
              onFilter={setOnlyAvailable}
              onRadius={(r) => startScan(place, r)}
              onPlace={() => setPicking(true)}
            />
          }
          footer={onlyAvailable && !scan.numbers.some((n) => n.status === "AVAILABLE") && !scan.running ? <Text style={styles.empty}>No numbers found here yet. Try a wider search.</Text> : undefined}
        />
      ) : null}

      {step === "routes" && place && number ? (
        <RouteGallery
          key={`${number.number}:${radiusM}`}
          place={place}
          radiusM={radiusM}
          number={number}
          insetBottom={insets.bottom}
          onWalk={walk}
          onWider={(r) => {
            startScan(place, r);
          }}
          onBack={() => setStep("numbers")}
        />
      ) : null}

      <MeetingPointPicker
        visible={picking}
        initial={place}
        title="Pick a spot"
        line="Put the pin where you'd like to walk. This is a picked spot, not your GPS."
        cta="Check streets here"
        onClose={() => setPicking(false)}
        onPick={(a) => {
          setPicking(false);
          startScan({ ...a, manual: true }, radiusM);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const NumbersHeader = ({
  place,
  radiusM,
  scan,
  onlyAvailable,
  onFilter,
  onRadius,
  onPlace,
}: {
  place: SearchPlace;
  radiusM: Radius;
  scan: ReturnType<typeof useNumberDiscovery>;
  onlyAvailable: boolean;
  onFilter: (v: boolean) => void;
  onRadius: (r: Radius) => void;
  onPlace: () => void;
}) => {
  const s = scanSummary(scan.numbers, scan.running, scan.checkedRadiusM, radiusM);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Numbers Near You</Text>
      <Text style={styles.sub}>See what you can draw on nearby streets.</Text>

      <PressScale accessibilityRole="button" accessibilityLabel={`${placeLabel(place)}. Change the spot`} scaleTo={0.98} style={styles.placeRow} onPress={onPlace}>
        {place.manual ? <MapPinSimpleIcon size={16} color={text.primary} weight="fill" /> : <CrosshairIcon size={16} color={text.primary} weight="bold" />}
        <Text style={styles.placeText} numberOfLines={1}>
          {placeLabel(place)}
        </Text>
        <Text style={styles.placeChange}>Change</Text>
      </PressScale>

      <View style={styles.chips} accessibilityRole="radiogroup">
        {RADII.map((r) => (
          <PressScale key={r} accessibilityRole="radio" accessibilityState={{ selected: r === radiusM }} accessibilityLabel={`Within ${radiusText(r)}`} style={[styles.chip, r === radiusM && styles.chipOn]} disabled={scan.running} onPress={() => onRadius(r)}>
            <Text style={styles.chipText}>{radiusText(r)}</Text>
          </PressScale>
        ))}
      </View>

      <View style={styles.progress} accessibilityLiveRegion="polite">
        <View style={styles.progressTop}>
          <Text style={styles.count}>
            <Text style={styles.countBig}>{s.available}</Text>
            {s.available === 1 ? " number available" : " numbers available"}
          </Text>
          {scan.running ? (
            <PressScale accessibilityRole="button" accessibilityLabel="Stop checking" style={styles.stop} onPress={scan.stop}>
              <StopIcon size={12} color={text.primary} weight="fill" />
              <Text style={styles.stopText}>Stop</Text>
            </PressScale>
          ) : null}
        </View>
        {scan.running ? <IndeterminateTrail width={120} /> : null}
        <Text style={styles.progressLine}>{scan.error ? numberErrorText(scan.error) : s.line}</Text>
      </View>

      <View style={styles.filter} accessibilityRole="radiogroup">
        {[false, true].map((v) => (
          <PressScale key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: onlyAvailable === v }} style={[styles.filterChip, onlyAvailable === v && styles.filterOn]} onPress={() => onFilter(v)}>
            <Text style={[styles.filterText, onlyAvailable === v && styles.filterTextOn]}>{v ? "Available" : "All 100"}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------------------------------------------

/** Every distinct verified route for one number: the chosen one on the map, the others as lettered starts. */
const RouteGallery = ({
  place,
  radiusM,
  number,
  insetBottom,
  onWalk,
  onWider,
  onBack,
}: {
  place: SearchPlace;
  radiusM: Radius;
  number: NumberAvailability;
  insetBottom: number;
  onWalk: (r: RouteOption) => Promise<void>;
  onWider: (r: Radius) => void;
  onBack: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const map = useRef<CourseMapHandle | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [complete, setComplete] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (after: number) => {
      setLoading(true);
      setError(null);
      try {
        const r = await listNearbyRoutes({ latitude: place.latitude, longitude: place.longitude, radiusM, number: number.number, after });
        setRoutes((list) => {
          const seen = new Set(list.map((x) => x.routeKey));
          return [...list, ...r.routes.filter((x) => !seen.has(x.routeKey))];
        });
        setComplete(r.complete);
      } catch (e) {
        setError(numberErrorText((e as { code?: string }).code));
      } finally {
        setLoading(false);
      }
    },
    [place, radiusM, number.number],
  );
  useEffect(() => {
    void load(0);
  }, [load]);

  const wider = RADII.find((r) => r > radiusM);
  const chosen = routes[selected] ?? null;
  const course = useMemo(() => (chosen ? drawableCourse(chosen.course) : null), [chosen]);
  const others = routes.map((r, i) => ({ key: r.routeKey, label: routeName(i), start: r.course.start, onPress: () => setSelected(i) })).filter((_, i) => i !== selected);

  // No route here: say so, offer a wider search, never a start button.
  if (!loading && !routes.length) {
    return (
      <View style={[styles.flex, styles.galleryEmpty, { paddingBottom: insetBottom + space.md }]}>
        <View style={styles.emptyTop}>
          <NumberGlyph value={number.number} height={96} stroke={0.3} dim />
          <Text style={styles.title}>{error ? "Couldn't load routes" : `No ${number.number} within ${radiusText(radiusM)}`}</Text>
          <Text style={styles.sub}>{error ?? "These streets can't draw it in the area checked. PAWS never swaps in another number."}</Text>
        </View>
        <View style={styles.actions}>
          {error ? <RaisedButton label="Try again" onPress={() => void load(0)} /> : wider ? <RaisedButton label={`Search within ${radiusText(wider)}`} onPress={() => onWider(wider)} /> : null}
          <RaisedButton tone="white" label="Back to numbers" onPress={onBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: insetBottom + 190 }} showsVerticalScrollIndicator={false}>
        <View style={styles.galleryHead}>
          <NumberGlyph value={number.number} height={52} stroke={0.3} />
          <View style={styles.flexOnly}>
            <Text style={styles.galleryTitle}>{routes.length === 1 ? "1 route" : `${routes.length}${complete ? "" : "+"} routes`}</Text>
            <Text style={styles.gallerySub}>{complete ? "Every route found nearby. Nearest first." : "Nearest first. More may exist."}</Text>
          </View>
        </View>
        <View style={styles.mapCard}>
          {course ? <CourseMap ref={map} key={chosen!.routeKey} course={course} interactive padding={{ top: 32, right: 32, bottom: 32, left: 32 }} position={place.manual ? null : place} others={others} /> : <View style={styles.mapLoading}>{loading ? <ActivityIndicator color={text.primary} /> : null}</View>}
        </View>
        <View style={styles.list}>
          {routes.map((r, i) => {
            const on = i === selected;
            return (
              <Animated.View key={r.routeKey} entering={firstLoad.current && !reduceMotion ? FadeInDown.delay(i * 40).duration(200).easing(motion.easing.out).withInitialValues({ transform: [{ translateY: 8 }] }) : undefined}>
                <PressScale
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Route ${routeName(i)}. ${kmText(r.approachM)} walk to the start. ${kmText(r.officialM)} course, about ${r.minutes} minutes. Readability ${Math.min(...r.readability)} of 100.`}
                  scaleTo={0.98}
                  style={[styles.route, on && styles.routeOn]}
                  onPress={() => setSelected(i)}
                >
                  <View style={[styles.routeBadge, on && styles.routeBadgeOn]}>
                    <Text style={styles.routeBadgeText}>{routeName(i)}</Text>
                  </View>
                  <View style={styles.flexOnly}>
                    <Text style={styles.routeLen}>{`${kmText(r.officialM)} course`}</Text>
                    <Text style={styles.routeNote}>{`${kmText(r.approachM)} walk to start · about ${r.minutes} min`}</Text>
                    {on ? (
                      <View style={styles.details}>
                        <Text style={styles.detail}>{`Readability ${Math.min(...r.readability)} of 100${r.course.finish?.length ? " · finish stretch" : ""}`}</Text>
                        <Text style={styles.detail}>{r.digitM.length > 1 ? `Digits ${r.digitM.map(kmText).join(" and ")}, link ${kmText(r.connectorM)}` : `One digit, ${kmText(r.digitM[0])}`}</Text>
                        {r.warnings.map((w) => (
                          <View key={w} style={styles.warning}>
                            <WarningIcon size={12} color="#8A5A00" weight="fill" />
                            <Text style={styles.warningText}>{WARNING_LABELS[w as keyof typeof WARNING_LABELS] ?? w}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {on ? <CheckIcon size={18} color={text.primary} weight="bold" /> : null}
                </PressScale>
              </Animated.View>
            );
          })}
          {!complete ? (
            <PressScale accessibilityRole="button" style={styles.more} disabled={loading} onPress={() => void load(routes.length)}>
              {loading ? <ActivityIndicator color={text.primary} /> : <Text style={styles.moreText}>Find more routes</Text>}
            </PressScale>
          ) : null}
          {error && routes.length ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <Text style={styles.fine}>Lengths are measured by PAWS on the real streets. The walk to the start isn't part of the course.</Text>
      </ScrollView>

      {chosen ? (
        <View style={[styles.bar, { paddingBottom: insetBottom + space.md }]}>
          {startError ? <Text style={styles.error}>{startError}</Text> : null}
          <RaisedButton
            label={`Walk route ${routeName(selected)}`}
            sub="Go to the flag first"
            busy={starting}
            onPress={() => {
              firstLoad.current = false;
              setStarting(true);
              setStartError(null);
              onWalk(chosen)
                .catch((e) => setStartError(numberErrorText((e as { code?: string }).code)))
                .finally(() => setStarting(false));
            }}
          />
          <View style={styles.row}>
            <RaisedButton style={styles.flexOnly} tone="white" label="Directions" onPress={() => void Linking.openURL(directionsUrl(chosen.course.start)).catch(() => undefined)} />
            <RaisedButton
              style={styles.flexOnly}
              tone="white"
              label="Race it"
              onPress={() => router.push({ pathname: "/game/number-trail/online", params: { number: number.number, routeId: chosen.id } })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  flex: { flex: 1 },
  flexOnly: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  round: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.8, color: text.primary },
  sub: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: text.secondary },
  locateTop: { flex: 1, justifyContent: "center", paddingHorizontal: layout.gutter, gap: space.md },
  privacy: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: "#EAF3F0" },
  privacyText: { ...type.supporting, color: text.primary, flex: 1 },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.card, backgroundColor: "#FBF0EC" },
  noteText: { ...type.supporting, color: text.primary, flex: 1 },
  actions: { paddingHorizontal: layout.gutter, gap: space.sm },
  header: { paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm },
  placeRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm, paddingHorizontal: space.md, minHeight: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignSelf: "flex-start" },
  placeText: { ...type.supporting, fontWeight: "700", color: text.primary, flexShrink: 1 },
  placeChange: { ...type.supporting, fontWeight: "800", color: text.secondary },
  chips: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  chip: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipText: { fontSize: 14, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  progress: { marginTop: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: NT.board, borderWidth: 1, borderColor: border.soft, gap: space.sm },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { ...type.supporting, fontWeight: "700", color: text.secondary },
  countBig: { fontSize: 26, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  stop: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.default },
  stopText: { fontSize: 13, fontWeight: "800", color: text.primary },
  progressLine: { ...type.caption, color: text.secondary },
  filter: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  filterChip: { height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  filterOn: { backgroundColor: text.primary },
  filterText: { fontSize: 13, fontWeight: "800", color: text.secondary },
  filterTextOn: { color: text.inverse },
  empty: { ...type.body, color: text.secondary, textAlign: "center", marginTop: space.xl },
  galleryEmpty: { justifyContent: "space-between" },
  emptyTop: { flex: 1, justifyContent: "center", paddingHorizontal: layout.gutter, gap: space.md },
  galleryHead: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: layout.gutter, marginTop: space.sm },
  galleryTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: text.primary },
  gallerySub: { ...type.supporting, color: text.secondary, marginTop: 2 },
  mapCard: { height: 320, marginHorizontal: layout.gutter, marginTop: space.lg, borderRadius: 24, overflow: "hidden", backgroundColor: bg.subtle },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: layout.gutter, marginTop: space.lg, gap: space.sm },
  route: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.surface, borderWidth: 2, borderColor: border.soft },
  routeOn: { borderColor: accent.band, backgroundColor: accent.soft },
  routeBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },
  routeBadgeOn: { backgroundColor: accent.deep },
  routeBadgeText: { fontSize: 15, fontWeight: "900", color: text.primary },
  routeLen: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  routeNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  details: { marginTop: space.sm, gap: 4 },
  detail: { ...type.caption, color: text.primary },
  warning: { flexDirection: "row", alignItems: "center", gap: 6 },
  warningText: { ...type.caption, fontWeight: "700", color: "#8A5A00" },
  more: { height: 48, borderRadius: radius.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: border.default, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 15, fontWeight: "800", color: text.primary },
  error: { ...type.supporting, color: "#B4442C", marginBottom: space.sm },
  fine: { ...type.caption, color: text.secondary, paddingHorizontal: layout.gutter, marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, gap: space.sm, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  row: { flexDirection: "row", gap: space.sm },
});
