import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { GlobeHemisphereWestIcon, HashIcon, MapPinIcon, QrCodeIcon, ShieldCheckIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { GameRow, NearbyGames, gameStyles } from "@/features/rooms/components/NearbyGames";
import { Pager } from "@/features/rooms/components/Pager";
import { OnlineHub } from "@/features/rooms/components/OnlineHub";
import { roomFeedback } from "@/features/rooms/roomFeedback";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { TOURNAMENT_GAMES } from "@/features/tournament/catalog";
import { badgeFor } from "@/features/tournament/components/TournamentGameCard";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useTournamentOverview } from "@/hooks/useTournaments";
import { createRoom, setRoomGame, type PlayMode, type RoomGame } from "@/services/roomService";
import type { TournamentGame, TournamentSummary } from "@/services/tournamentService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const INK = text.primary;
const SUN = accent.deep;
/** The mode switch and everything tied to it move on one spring, so they stay together however fast you tap. */
const SPRING = { damping: 22, stiffness: 260, mass: 0.9 } as const;

/**
 * Tournament's first screen. Nearby: make a room or join one, swipe right for the games. Online: the three online
 * games, each with a friends button. One spring drives the switch.
 */
export const PlayStart = ({ mode, onMode, bottomInset }: { mode: PlayMode; onMode: (m: PlayMode) => void; bottomInset: number }) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(mode === "nearby" ? 1 : 0);
  const [making, setMaking] = useState<{ game: RoomGame | null } | null>(null);

  useEffect(() => {
    const to = mode === "nearby" ? 1 : 0;
    progress.value = reduceMotion ? withTiming(to, { duration: motion.duration.select }) : withSpring(to, SPRING);
  }, [mode, progress, reduceMotion]);

  const pick = (m: PlayMode) => {
    if (m === mode) return;
    void Haptics.selectionAsync();
    onMode(m);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.switchWrap}>
        <ModeSwitch progress={progress} mode={mode} onPick={pick} />
      </View>
      {mode === "online" ? (
        <Animated.View key="online" style={styles.flex} entering={FadeIn.duration(motion.duration.select)}>
          <OnlineHub bottomInset={bottomInset} />
        </Animated.View>
      ) : (
        <Animated.View key="nearby" style={styles.flex} entering={FadeIn.duration(motion.duration.select)}>
          <Pager
            labels={["Start", "Games"]}
            dotsBottom={bottomInset + space.md}
            pages={[
              <View key="start" style={[styles.page, { paddingBottom: bottomInset + 52 }]}>
                <Animated.View style={styles.makeWrap} entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}>
                  <MakeCard
                    progress={progress}
                    mode={mode}
                    onPress={() => {
                      roomFeedback.tap();
                      setMaking({ game: null });
                    }}
                  />
                </Animated.View>
                <Animated.View style={styles.joinWrap} entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.delay(50).duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}>
                  <JoinCard
                    progress={progress}
                    mode={mode}
                    onPress={() => {
                      roomFeedback.tap();
                      router.push({ pathname: "/game/room/join", params: { mode } });
                    }}
                  />
                </Animated.View>
              </View>,
              <NearbyGames key="games" heading="Games" topInset={space.lg} bottomInset={bottomInset + 64} onOpen={(g) => setMaking({ game: g })} />,
            ]}
          />
        </Animated.View>
      )}
      <MakeSheet visible={making != null} mode={mode} game={making?.game ?? null} onClose={() => setMaking(null)} />
    </View>
  );
};

// ---------- The switch ----------

/**
 * Two places, one ink thumb. The white labels live inside the thumb and slide against it, so a label is white exactly
 * where the thumb covers it (no colour fade, no flicker), however far the spring has got.
 */
const ModeSwitch = ({ progress, mode, onPick }: { progress: SharedValue<number>; mode: PlayMode; onPick: (m: PlayMode) => void }) => {
  const [width, setWidth] = useState(0);
  const half = Math.max(0, (width - 8) / 2);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * half }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * half }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const labels = (tone: "base" | "on") => (
    <>
      <View style={[styles.seg, { width: half }]}>
        <GlobeHemisphereWestIcon size={18} color={tone === "on" ? "#FFFFFF" : text.secondary} weight="bold" />
        <Text style={[styles.segText, tone === "on" && styles.segTextOn]}>Online</Text>
      </View>
      <View style={[styles.seg, { width: half }]}>
        <MapPinIcon size={18} color={tone === "on" ? "#FFFFFF" : text.secondary} weight="bold" />
        <Text style={[styles.segText, tone === "on" && styles.segTextOn]}>Nearby</Text>
      </View>
    </>
  );
  return (
    <View style={styles.track} onLayout={onLayout} accessibilityRole="tablist">
      {width > 0 ? (
        <>
          <View style={styles.segRow} pointerEvents="none">
            {labels("base")}
          </View>
          <Animated.View style={[styles.thumb, { width: half }, thumb]} pointerEvents="none">
            <Animated.View style={[styles.segRow, styles.segRowInner, inner]}>{labels("on")}</Animated.View>
          </Animated.View>
        </>
      ) : null}
      <View style={styles.hitRow}>
        {(["online", "nearby"] as const).map((m) => (
          <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} accessibilityLabel={m === "online" ? "Online. Friends anywhere" : "Nearby. Friends with you"} style={styles.hit} onPressIn={() => onPick(m)} />
        ))}
      </View>
    </View>
  );
};

// ---------- The two cards ----------

const MakeCard = ({ progress, mode, onPress }: { progress: SharedValue<number>; mode: PlayMode; onPress: () => void }) => {
  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [INK, SUN]),
    borderColor: interpolateColor(progress.value, [0, 1], ["#34322F", "#E1AE45"]),
  }));
  const title = useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], ["#FFFFFF", INK]) }));
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={mode === "online" ? "Make a room. Race friends anywhere" : "Make a room. Play with friends here"} scaleTo={0.97} style={styles.fill} onPress={onPress}>
      <Animated.View style={[styles.card, styles.make, card]}>
        <View style={styles.artCorner}>
          <GlobeArt progress={progress} active={mode === "online"} />
          <RadarArt progress={progress} active={mode === "nearby"} />
        </View>
        <Animated.Text style={[styles.cardTitle, title]}>Make a room</Animated.Text>
        <Swap progress={progress} a="Race friends anywhere" b="Play with friends here" colorA="rgba(255,255,255,0.68)" colorB="#6B5216" />
      </Animated.View>
    </PressScale>
  );
};

const JoinCard = ({ progress, mode, onPress }: { progress: SharedValue<number>; mode: PlayMode; onPress: () => void }) => {
  const hash = useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ scale: 0.9 + (1 - progress.value) * 0.1 }] }));
  const qr = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.9 + progress.value * 0.1 }] }));
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={mode === "online" ? "Join game. Enter a code" : "Join game. Scan or enter a code"} scaleTo={0.97} style={styles.fill} onPress={onPress}>
      <View style={[styles.card, styles.join]}>
        <View style={styles.joinWell}>
          <Animated.View style={[styles.abs, hash]}>
            <HashIcon size={28} color={INK} weight="bold" />
          </Animated.View>
          <Animated.View style={[styles.abs, qr]}>
            <QrCodeIcon size={28} color={INK} weight="bold" />
          </Animated.View>
        </View>
        <Text style={[styles.cardTitle, styles.joinTitle]}>Join game</Text>
        <Swap progress={progress} a="Enter a code" b="Scan or enter a code" colorA={text.secondary} colorB={text.secondary} />
      </View>
    </PressScale>
  );
};

/** Two lines in one place: the outgoing one lifts away as the incoming one settles, on the shared spring. */
const Swap = ({ progress, a, b, colorA, colorB }: { progress: SharedValue<number>; a: string; b: string; colorA: string; colorB: string }) => {
  const sa = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.5], [1, 0], "clamp"), transform: [{ translateY: -progress.value * 6 }] }));
  const sb = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], "clamp"), transform: [{ translateY: (1 - progress.value) * 6 }] }));
  return (
    <View style={styles.swap}>
      <Animated.Text style={[styles.cardLine, { color: colorA }, sa]} numberOfLines={1}>
        {a}
      </Animated.Text>
      <Animated.Text style={[styles.cardLine, styles.swapB, { color: colorB }, sb]} numberOfLines={1}>
        {b}
      </Animated.Text>
    </View>
  );
};

// ---------- Art: a slow orbit for online, a radar ping for nearby ----------

const GlobeArt = ({ progress, active }: { progress: SharedValue<number>; active: boolean }) => {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(spin);
      return;
    }
    spin.value = withRepeat(withTiming(spin.value + 1, { duration: 9000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [active, reduceMotion, spin]);
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ scale: 0.88 + (1 - progress.value) * 0.12 }] }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View style={[styles.art, wrap]} pointerEvents="none">
      <View style={styles.globe}>
        <View style={styles.meridian} />
        <View style={styles.equator} />
      </View>
      <Animated.View style={[styles.orbit, orbit]}>
        <View style={styles.satellite} />
      </Animated.View>
    </Animated.View>
  );
};

const RadarArt = ({ progress, active }: { progress: SharedValue<number>; active: boolean }) => {
  const reduceMotion = useReducedMotion();
  const ping = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(ping);
      ping.value = 0;
      return;
    }
    ping.value = 0;
    ping.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false);
    return () => cancelAnimation(ping);
  }, [active, reduceMotion, ping]);
  const wrap = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.88 + progress.value * 0.12 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - ping.value), transform: [{ scale: 0.45 + ping.value * 0.75 }] }));
  return (
    <Animated.View style={[styles.art, wrap]} pointerEvents="none">
      <Animated.View style={[styles.ping, ring]} />
      <View style={styles.ringOuter} />
      <View style={styles.ringInner} />
      <View style={styles.youDot} />
      <View style={[styles.friendDot, { top: 14, right: 16 }]} />
      <View style={[styles.friendDot, { bottom: 18, left: 12 }]} />
    </Animated.View>
  );
};

// ---------- Online games ----------

const PRIORITY = { active: 0, registration: 1, upcoming: 2, completed: 3, cancelled: 4 } as const;
const tournamentFor = (game: TournamentGame, list: readonly TournamentSummary[]) =>
  list.filter((t) => t.gameType === game).sort((a, b) => PRIORITY[a.phase] - PRIORITY[b.phase])[0] ?? null;

/**
 * Online: Number Trail with friends (a room), the weekly tournaments, and what's coming. Inside an online room
 * (`inRoom`), Number Trail is the room's game and shows as picked; the rest open as they do from Tournament.
 */
export const OnlineGames = ({ bottomInset, onRace, inRoom = false, topInset = space.lg, heading = "Games" }: { bottomInset: number; onRace?: () => void; inRoom?: boolean; topInset?: number; heading?: string | null }) => {
  const overview = useTournamentOverview();
  const now = overview.data ? Date.parse(overview.data.serverNow) : Date.now();
  const list = overview.data?.tournaments ?? [];
  const online = TOURNAMENT_GAMES.filter((g) => g.mode === "online");
  const tournaments = online.filter((g) => g.playable && g.key !== "number_trail");
  const soon = online.filter((g) => !g.playable);
  return (
    <ScrollView contentContainerStyle={[gameStyles.body, { paddingTop: topInset, paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
      {heading ? <Text style={gameStyles.heading}>{heading}</Text> : null}
      <View style={[gameStyles.list, !heading && gameStyles.listTop]}>
        <GameRow game="number_trail" title="Number Trail" line="Race friends on your own streets." meta="2 to 10" selected={inRoom} role={inRoom ? "radio" : undefined} onPress={inRoom ? () => undefined : onRace} />
        <GameRow game="number_trail" title="Number Trail solo" line="Find your numbers. Walk one." meta="Practice" metaKind="status" onPress={() => router.push("/game/number-trail/near")} />
        {tournaments.map((g) => {
          const badge = badgeFor(tournamentFor(g.key, list), now);
          return <GameRow key={g.key} game={g.key} title={g.title} line={g.line} meta={badge.label} metaKind="status" metaTone={badge.kind === "live" || badge.kind === "open" ? "live" : "plain"} onPress={() => g.route && router.push(g.route as never)} />;
        })}
        {soon.length ? <Text style={gameStyles.section}>Coming soon</Text> : null}
        {soon.map((g) => (
          <GameRow key={g.key} game={g.key} title={g.title} line={g.line} muted />
        ))}
      </View>
    </ScrollView>
  );
};

// ---------- Making the room ----------

/** The one promise the server asks for, then the room. A game tapped on the games page comes along. */
export const MakeSheet = ({ visible, mode, game, onClose }: { visible: boolean; mode: PlayMode; game: RoomGame | null; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const dog = useCurrentDog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);
  const make = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const name = dog.data?.name ?? "Player";
      const r = await createRoom({ game: null, mode, name: `${name}'s room`.slice(0, 40), maxPlayers: 10, teamMode: false, startDelayS: 10, safetyAck: true, dogId: dog.data?.id ?? null, displayName: name });
      if (mode === "nearby" && game) await setRoomGame(r.roomId, game).catch(() => undefined);
      roomFeedback.success();
      onClose();
      router.push({ pathname: "/game/room/[id]", params: { id: r.roomId } });
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <ShieldCheckIcon size={30} color="#2F7D6D" weight="fill" />
          <Text style={styles.sheetTitle}>Walk safely</Text>
          <Text style={styles.sheetLine}>{mode === "online" ? "Your own streets, your dog's pace, safe crossings." : "Dogs' pace, public paths, safe crossings, leads near roads."}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <RaisedButton label="I promise. Make the room" busy={busy} onPress={() => void make()} style={styles.cta} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  abs: { position: "absolute" },
  switchWrap: { paddingHorizontal: layout.gutter, marginTop: space.xl },
  track: { height: 56, borderRadius: radius.pill, backgroundColor: bg.subtle, padding: 4 },
  segRow: { position: "absolute", top: 4, left: 4, bottom: 4, flexDirection: "row" },
  segRowInner: { top: 0, left: 0, bottom: 0 },
  seg: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  segText: { fontSize: 16, fontWeight: "800", color: text.secondary, letterSpacing: -0.2 },
  segTextOn: { color: "#FFFFFF" },
  thumb: { position: "absolute", top: 4, left: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: INK, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  hitRow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  hit: { flex: 1 },
  page: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.md },
  makeWrap: { flex: 1.35, maxHeight: 300 },
  joinWrap: { flex: 1, maxHeight: 210 },
  card: { flex: 1, borderRadius: 30, padding: space.xl, justifyContent: "flex-end", borderWidth: 2, overflow: "hidden" },
  make: {},
  join: { backgroundColor: bg.surface, borderColor: border.soft },
  artCorner: { position: "absolute", top: space.lg, right: space.lg, width: 96, height: 96 },
  art: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  globe: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: SUN, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  meridian: { position: "absolute", width: 26, height: 64, borderRadius: 13, borderWidth: 3, borderColor: SUN },
  equator: { position: "absolute", width: 64, height: 3, backgroundColor: SUN },
  orbit: { position: "absolute", width: 92, height: 92, borderRadius: 46, borderWidth: 1.5, borderColor: "rgba(252,212,111,0.35)" },
  satellite: { position: "absolute", top: -6, left: 40, width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFFFFF" },
  ping: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(28,27,26,0.18)" },
  ringOuter: { position: "absolute", width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: "rgba(28,27,26,0.22)" },
  ringInner: { position: "absolute", width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "rgba(28,27,26,0.32)" },
  youDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: INK, borderWidth: 3, borderColor: "#FFF6DA" },
  friendDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#2F7D6D", borderWidth: 2, borderColor: "#FFF6DA" },
  cardTitle: { fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -1 },
  joinTitle: { color: INK },
  joinWell: { position: "absolute", top: space.xl, left: space.xl, width: 56, height: 56, borderRadius: 18, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  swap: { height: 22, marginTop: 4 },
  swapB: { position: "absolute", left: 0, top: 0 },
  cardLine: { ...type.supporting, fontWeight: "700" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.32)" },
  sheet: { paddingHorizontal: space.xxl, paddingTop: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface, gap: space.sm },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: border.default, marginBottom: space.md },
  sheetTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: text.primary, marginTop: space.sm },
  sheetLine: { ...type.body, color: text.secondary },
  error: { ...type.supporting, color: "#B4442C" },
  cta: { marginTop: space.lg },
});
