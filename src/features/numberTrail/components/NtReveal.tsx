import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowsClockwiseIcon, CaretLeftIcon, FlagIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CourseMap } from "@/features/numberTrail/components/CourseMap";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { Avatar, ConnectionPill } from "@/features/numberTrail/components/RacePieces";
import { LAYOUT_LABELS, LOBBY_BLOCKERS, SAFETY_LINE, numberErrorText } from "@/features/numberTrail/raceCopy";
import { lobbyView, revealView } from "@/features/numberTrail/raceView";
import { NT } from "@/features/numberTrail/theme";
import { setNumberReady, startNumberRace, type RaceState } from "@/services/numberRaceService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const LEVEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Numbers drawn on this phone already, so a reload or reconnect never replays the reveal. */
const revealed = new Set<string>();

/**
 * The number, revealed. Exactly what the server assigned: its digits drawn in walking order, the real course on the
 * map, its length and the start corner. Then the countdown, on the server's clock.
 */
export const NtReveal = ({ state, offsetMs, live, preparing, onRedraw, onChanged }: { state: RaceState; offsetMs: number; live: boolean; preparing: boolean; onRedraw: () => void; onChanged: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const v = revealView(state, offsetMs, now);
  const lobby = lobbyView(state);
  const course = state.course!;
  const number = state.match.number!;
  const key = `${state.match.id}:${number}`;
  const [first] = useState(() => !revealed.has(key));
  useEffect(() => {
    revealed.add(key);
    if (first) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [key, first]);

  const counting = state.match.status === "countdown";
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [counting]);
  const seconds = v.countdownMs == null ? null : Math.ceil(v.countdownMs / 1000);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (seconds == null || seconds === lastTick.current) return;
    lastTick.current = seconds;
    if (seconds > 0 && seconds <= 3) void Haptics.selectionAsync();
    if (seconds === 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [seconds]);

  const me = state.players.find((p) => p.userId === state.me.userId);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  const mapH = Math.round(height * 0.36);
  const ready = lobby.readyCount;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: 170 + insets.bottom }} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={[styles.map, { height: mapH + insets.top }]}>
          <CourseMap course={course} padding={{ top: insets.top + 64, right: 40, bottom: 40, left: 40 }} interactive={false} />
          <View style={[styles.mapTop, { top: insets.top + space.sm }]}>
            <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => router.replace(ROUTES.nearby as never)}>
              <CaretLeftIcon size={20} color={text.primary} weight="bold" />
            </PressScale>
            <ConnectionPill live={live} />
          </View>
        </View>

        <View style={styles.body}>
          <Animated.Text entering={first && !reduceMotion ? FadeIn.duration(motion.duration.enter) : undefined} style={styles.eyebrow}>
            YOUR NUMBER
          </Animated.Text>
          <Animated.View entering={first && !reduceMotion ? ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }] }) : undefined} style={styles.glyph}>
            <NumberGlyph value={number} height={132} draw={first} stroke={0.27} />
          </Animated.View>
          <Text style={styles.trace}>{(state.course?.digits.length ?? 2) > 1 ? "Trace both digits on your walk." : "Trace the digit on your walk."}</Text>

          <Animated.View entering={first && !reduceMotion ? FadeInDown.delay(900).duration(motion.duration.enter).easing(motion.easing.out) : undefined} style={styles.stats}>
            <Stat value={`${(course.raceM / 1000).toFixed(1)} km`} label="Course" />
            <Stat value={`${course.minutes} min`} label="Walking time" />
            <Stat value={LEVEL[course.difficulty] ?? "Any"} label="Difficulty" />
          </Animated.View>

          <View style={styles.startRow}>
            <View style={styles.flag}>
              <FlagIcon size={14} color={text.inverse} weight="fill" />
            </View>
            <View style={styles.flexOnly}>
              <Text style={styles.startTitle}>Start at the flag</Text>
              <Text style={styles.startLine}>{`Digit 1 begins ${course.approachM} m from it. ${LAYOUT_LABELS[course.layout]}.`}</Text>
            </View>
          </View>

          <View style={styles.legend}>
            <Legend color={NT.one} label={`Digit ${number[0]}`} />
            <Legend color={NT.link} label="Link" dashed />
            <Legend color={NT.two} label={`Digit ${number[1]}`} centre />
          </View>

          <View style={styles.players}>
            <View style={styles.avatars}>
              {state.players.filter((p) => p.inRoom).slice(0, 6).map((p, i) => (
                <View key={p.userId} style={[styles.avatarWrap, { marginLeft: i ? -10 : 0 }, !(p.ready || p.isHost) && styles.avatarWaiting]}>
                  <Avatar name={p.name} size={34} />
                </View>
              ))}
            </View>
            <Text style={styles.playersText}>{`${ready} of ${lobby.players.length} ready`}</Text>
          </View>
          <Text style={styles.safety}>{SAFETY_LINE}</Text>
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {counting ? (
          <Text style={styles.headTo}>Head to the flag. Your walk counts from there.</Text>
        ) : state.me.isHost ? (
          <View style={styles.hostRow}>
            <PressScale accessibilityRole="button" accessibilityLabel="Draw a new number" style={styles.redraw} disabled={preparing || busy} onPress={onRedraw}>
              <ArrowsClockwiseIcon size={20} color={text.primary} weight="bold" />
            </PressScale>
            <RaisedButton style={styles.flexOnly} label="Start race" sub={lobby.blocker ? LOBBY_BLOCKERS[lobby.blocker]?.host : undefined} disabled={!lobby.canStart || preparing} busy={busy} onPress={() => void act(() => startNumberRace(state.match.id).then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)))} />
          </View>
        ) : (
          <RaisedButton tone={me?.ready ? "white" : "yellow"} label={me?.ready ? "I'm not ready" : "I'm ready"} sub={me?.ready ? "Waiting for the host to start" : "Tap when you're at the meeting point"} busy={busy} onPress={() => void act(() => setNumberReady(state.room.id, !me?.ready))} />
        )}
      </View>

      {counting && seconds != null ? (
        <View style={styles.countdown} pointerEvents="none" accessibilityLiveRegion="assertive" accessibilityLabel={seconds > 0 ? `Starting in ${seconds}` : "Go"}>
          <Text style={styles.countLabel}>{seconds > 0 ? "STARTING IN" : ""}</Text>
          <Animated.Text key={seconds} entering={reduceMotion ? FadeIn.duration(120) : ZoomIn.duration(motion.duration.select).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.86 }] })} style={styles.countNum}>
            {seconds > 0 ? seconds : "Go"}
          </Animated.Text>
        </View>
      ) : null}
    </View>
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Legend = ({ color, label, dashed, centre }: { color: string; label: string; dashed?: boolean; centre?: boolean }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendLine, { backgroundColor: dashed ? "transparent" : color, borderColor: color }, dashed && styles.legendDashed]}>{centre ? <View style={styles.legendCentre} /> : null}</View>
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  map: { backgroundColor: bg.subtle, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, overflow: "hidden" },
  mapTop: { position: "absolute", left: layout.gutter, right: layout.gutter, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: layout.gutter, alignItems: "center" },
  eyebrow: { ...type.eyebrow, color: text.tertiary, marginTop: space.xxl, letterSpacing: 2 },
  glyph: { marginTop: space.md },
  trace: { fontSize: 17, lineHeight: 23, fontWeight: "600", color: text.secondary, marginTop: space.md, textAlign: "center" },
  stats: { flexDirection: "row", alignSelf: "stretch", marginTop: space.xl, borderRadius: radius.card, backgroundColor: bg.subtle },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.lg },
  statValue: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  startRow: { flexDirection: "row", alignItems: "center", gap: space.md, alignSelf: "stretch", marginTop: space.lg },
  flag: { width: 30, height: 30, borderRadius: 15, backgroundColor: text.primary, alignItems: "center", justifyContent: "center" },
  startTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  startLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  legend: { flexDirection: "row", gap: space.lg, alignSelf: "stretch", marginTop: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLine: { width: 22, height: 6, borderRadius: 3, borderWidth: 0, alignItems: "center", justifyContent: "center" },
  legendDashed: { height: 0, borderTopWidth: 2, borderStyle: "dashed" },
  legendCentre: { width: 14, height: 2, borderTopWidth: 2, borderColor: "#FFFFFF", borderStyle: "dotted" },
  legendText: { fontSize: 12, fontWeight: "700", color: text.secondary },
  players: { flexDirection: "row", alignItems: "center", gap: space.md, alignSelf: "stretch", marginTop: space.xl },
  avatars: { flexDirection: "row" },
  avatarWrap: { borderRadius: 19, borderWidth: 2, borderColor: bg.canvas },
  avatarWaiting: { opacity: 0.4 },
  playersText: { ...type.supporting, fontWeight: "700", color: text.primary },
  safety: { ...type.caption, color: text.secondary, marginTop: space.lg, alignSelf: "stretch" },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.md },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  hostRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  redraw: { width: 64, height: 64, borderRadius: 18, borderWidth: 1, borderColor: border.default, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  headTo: { ...type.body, fontWeight: "700", color: text.primary, textAlign: "center", paddingVertical: space.lg },
  countdown: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(253,250,236,0.94)" },
  countLabel: { ...type.eyebrow, color: text.secondary, letterSpacing: 2, minHeight: 16 },
  countNum: { fontSize: 128, lineHeight: 140, fontWeight: "900", color: text.primary, fontVariant: ["tabular-nums"], letterSpacing: -4 },
});
