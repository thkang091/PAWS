import { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ShareNetworkIcon, UsersThreeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { usePoseChallenges, useReelChallenges } from "@/hooks/usePhotoPose";
import { useTournamentOverview } from "@/hooks/useTournaments";
import { createFriendBattle, joinFriendBattle, type FriendBattle, type FriendGame, type MediaChallenge } from "@/services/mediaService";
import type { TournamentSummary } from "@/services/tournamentService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

type Game = { key: FriendGame; title: string; route: string; color: string; ink: string; soft: string; badgeInk: string };

const GAMES: readonly Game[] = [
  { key: "largest_country", title: "Largest Country", route: "/game/tournament/largest-country", color: "#3F7A5C", ink: "#FFFFFF", soft: "#D6EBDD", badgeInk: "#3F7A5C" },
  { key: "photo_pose", title: "Photo Pose", route: "/game/tournament/photo-pose", color: "#FCD46F", ink: text.primary, soft: "#6B5216", badgeInk: "#8A5A00" },
  { key: "dog_reels", title: "Dog Reels", route: "/game/tournament/reels", color: "#1C1B1A", ink: "#FFFFFF", soft: "#C9C5BC", badgeInk: text.primary },
];

const DAY = 86_400_000;
const left = (iso: string, now: number) => {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / DAY);
  if (d >= 1) return `${d} ${d === 1 ? "day" : "days"} left`;
  const h = Math.max(1, Math.round(ms / 3_600_000));
  return `${h}h left`;
};

/** This week's public media challenge (not a friend battle). */
const weekOf = (list: readonly MediaChallenge[] | undefined) => (list ?? []).filter((c) => !c.private && c.phase !== "completed" && c.phase !== "cancelled").sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;
const weekLc = (list: readonly TournamentSummary[] | undefined) => (list ?? []).filter((t) => t.gameType === "largest_country" && !t.private && (t.phase === "active" || t.phase === "registration")).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;

/**
 * Online: the three games played on your own streets and photos, one big card each. Tap to play this week's game; the
 * small friends button starts or joins a private battle of the same game.
 */
export const OnlineHub = ({ bottomInset }: { bottomInset: number }) => {
  const reduceMotion = useReducedMotion();
  const overview = useTournamentOverview();
  const poses = usePoseChallenges();
  const reels = useReelChallenges();
  const [friends, setFriends] = useState<Game | null>(null);
  const now = overview.data ? Date.parse(overview.data.serverNow) : Date.now();

  const lc = weekLc(overview.data?.tournaments);
  const pose = weekOf(poses.data);
  const reel = weekOf(reels.data);
  const media = (c: MediaChallenge | null) =>
    c
      ? { badge: c.phase === "voting" ? "Voting now" : c.phase === "entries" ? "This week" : "Soon", headline: c.title, meta: left(c.phase === "entries" ? c.entriesCloseAt : c.endsAt, now), count: c.entries }
      : null;
  const facts: Record<FriendGame, { badge: string; headline: string; meta: string | null; count?: number } | null> = {
    largest_country: lc ? { badge: lc.phase === "active" ? "Live" : "This week", headline: lc.participants > 0 ? `${lc.participants} walking this week` : "Walk one loop this week", meta: left(lc.endsAt, now) } : null,
    photo_pose: media(pose),
    dog_reels: media(reel),
  };

  return (
    <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottomInset + space.section }]} showsVerticalScrollIndicator={false}>
      {GAMES.map((g, i) => {
        const f = facts[g.key];
        return (
          <Animated.View key={g.key} entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.delay(i * 50).duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}>
            <PressScale accessibilityRole="button" accessibilityLabel={`${g.title}. ${f?.headline ?? ""}`} scaleTo={0.98} style={[styles.card, { backgroundColor: g.color }]} onPress={() => router.push(g.route as never)}>
              <View style={styles.glow} />
              <View style={styles.cardTop}>
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, { color: g.badgeInk }]}>{f?.badge ?? "This week"}</Text>
                </View>
                <PressScale accessibilityRole="button" accessibilityLabel={`Play ${g.title} with friends`} hitSlop={8} scaleTo={0.9} style={[styles.friends, g.color === "#FCD46F" && styles.friendsInk]} onPress={() => setFriends(g)}>
                  <UsersThreeIcon size={20} color={g.color === "#FCD46F" ? "#FFFFFF" : text.primary} weight="bold" />
                </PressScale>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: g.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {g.title}
                  </Text>
                  <Text style={[styles.headline, { color: g.soft }]} numberOfLines={2}>
                    {f?.headline ?? "Opening this week"}
                  </Text>
                  {f?.meta ? <Text style={[styles.meta, { color: g.soft }]}>{f.meta}</Text> : null}
                </View>
                <View style={styles.art}>
                  <TournamentArt game={g.key} width={104} height={104} />
                </View>
              </View>
            </PressScale>
          </Animated.View>
        );
      })}
      <FriendSheet game={friends} onClose={() => setFriends(null)} />
    </ScrollView>
  );
};

// ---------- Friends ----------

const CODE = 6;

const goTo = (b: FriendBattle) => {
  if (b.gameType === "largest_country") router.push({ pathname: "/game/tournament/largest-country", params: { id: b.tournamentId } });
  else if (b.gameType === "photo_pose" && b.challengeId) router.push({ pathname: "/game/tournament/pose", params: { challengeId: b.challengeId } });
  else if (b.challengeId) router.push({ pathname: "/game/tournament/reels", params: { challengeId: b.challengeId } });
};

const ERRORS: Record<string, string> = {
  code_not_found: "No battle with that code.",
  battle_over: "That battle has ended.",
  battle_full: "That battle is full.",
  too_many_battles: "You have 5 battles running. Finish one first.",
  challenge_not_found: "This week's game isn't open yet. Try again soon.",
  not_deployed: "Friend battles aren't switched on yet.",
};

/** Start a private battle of this game (and share its code), or join a friend's with theirs. */
const FriendSheet = ({ game, onClose }: { game: Game | null; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const [made, setMade] = useState<FriendBattle | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"make" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (game) {
      setMade(null);
      setCode("");
      setError(null);
    }
  }, [game]);

  const fail = (e: unknown) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(ERRORS[(e as { code?: string }).code ?? ""] ?? "Something went wrong. Try again.");
    if (!reduceMotion) shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 70 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 60 }));
  };
  const make = async () => {
    if (!game || busy) return;
    setBusy("make");
    setError(null);
    try {
      const b = await createFriendBattle(game.key, dog.data?.id ?? null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMade(b);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const join = async (value: string) => {
    if (busy) return;
    setBusy("join");
    setError(null);
    try {
      const b = await joinFriendBattle(value, dog.data?.id ?? null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      goTo(b);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const typed = (v: string) => {
    const next = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE);
    setCode(next);
    setError(null);
    if (next.length === CODE) {
      Keyboard.dismiss();
      void join(next);
    }
  };

  return (
    <Modal visible={game != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{game ? `${game.title} with friends` : ""}</Text>
          {made ? (
            <Animated.View entering={FadeIn.duration(motion.duration.enter)}>
              <Text style={styles.sheetLine}>Send this code. The battle runs for 3 days.</Text>
              <Text style={styles.bigCode} accessibilityLabel={`Code ${made.code.split("").join(" ")}`}>
                {made.code}
              </Text>
              <View style={styles.row}>
                <PressScale accessibilityRole="button" accessibilityLabel="Share the code" scaleTo={0.96} style={styles.shareBtn} onPress={() => void Share.share({ message: `Join my ${game?.title} battle on PAWS with code ${made.code}` })}>
                  <ShareNetworkIcon size={18} color={text.primary} weight="bold" />
                  <Text style={styles.shareText}>Share</Text>
                </PressScale>
                <View style={styles.flex}>
                  <RaisedButton
                    label="Play"
                    onPress={() => {
                      onClose();
                      goTo(made);
                    }}
                  />
                </View>
              </View>
            </Animated.View>
          ) : (
            <>
              <RaisedButton label="Start a battle" sub="Three days, just your friends" busy={busy === "make"} onPress={() => void make()} style={styles.make} />
              <Text style={styles.or}>or join with a code</Text>
              <Pressable accessibilityRole="none" onPress={() => input.current?.focus()}>
                <Animated.View style={[styles.slots, shakeStyle]}>
                  {Array.from({ length: CODE }, (_, i) => (
                    <View key={i} style={[styles.slot, code[i] ? styles.slotFilled : null, i === code.length && busy !== "join" && styles.slotCurrent, error ? styles.slotError : null]}>
                      <Text style={styles.slotText}>{code[i] ?? ""}</Text>
                    </View>
                  ))}
                </Animated.View>
              </Pressable>
              <TextInput ref={input} value={code} onChangeText={typed} autoCapitalize="characters" autoCorrect={false} autoComplete="off" maxLength={CODE} style={styles.hidden} accessibilityLabel="Battle code, six letters and numbers" caretHidden />
            </>
          )}
          <View style={styles.status}>{busy === "join" ? <Text style={styles.statusText}>Joining</Text> : error ? <Text style={[styles.statusText, styles.errorText]} accessibilityLiveRegion="polite">{error}</Text> : null}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.md },
  card: { borderRadius: 28, padding: space.xl, overflow: "hidden", minHeight: 196 },
  glow: { position: "absolute", width: 260, height: 260, borderRadius: 130, right: -90, bottom: -120, backgroundColor: "rgba(255,255,255,0.12)" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: "#FFFFFF", justifyContent: "center" },
  badgeText: { fontSize: 13, fontWeight: "800" },
  friends: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  friendsInk: { backgroundColor: text.primary },
  cardBody: { flexDirection: "row", alignItems: "flex-end", gap: space.md, marginTop: space.lg },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -1 },
  headline: { fontSize: 15, lineHeight: 20, fontWeight: "700", marginTop: 4 },
  meta: { fontSize: 13, fontWeight: "700", marginTop: 6, opacity: 0.9 },
  art: { width: 104, height: 104, borderRadius: 24, overflow: "hidden" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.32)" },
  sheet: { paddingHorizontal: space.xxl, paddingTop: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: border.default, marginBottom: space.lg },
  sheetTitle: { fontSize: 26, lineHeight: 30, fontWeight: "800", letterSpacing: -0.6, color: text.primary },
  sheetLine: { ...type.body, color: text.secondary, marginTop: space.sm },
  make: { marginTop: space.xl },
  or: { ...type.supporting, fontWeight: "700", color: text.tertiary, textAlign: "center", marginTop: space.xl, marginBottom: space.md },
  bigCode: { fontSize: 44, lineHeight: 52, fontWeight: "800", letterSpacing: 6, color: text.primary, textAlign: "center", marginTop: space.xl, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 56, paddingHorizontal: space.lg, borderRadius: 18, backgroundColor: accent.deep },
  shareText: { fontSize: 15, fontWeight: "800", color: text.primary },
  slots: { flexDirection: "row", gap: 8 },
  slot: { flex: 1, aspectRatio: 0.8, borderRadius: 14, backgroundColor: bg.subtle, borderWidth: 2, borderColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  slotFilled: { backgroundColor: bg.surface, borderColor: border.default },
  slotCurrent: { borderColor: text.primary, backgroundColor: bg.surface },
  slotError: { borderColor: "#D9826B" },
  slotText: { fontSize: 24, fontWeight: "800", color: text.primary },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
  status: { minHeight: 36, justifyContent: "center", marginTop: space.md },
  statusText: { ...type.supporting, fontWeight: "700", color: text.secondary, textAlign: "center" },
  errorText: { color: "#B4442C" },
});

/** On a friend battle's screen: its code, tap to share it. */
export const FriendCode = ({ code, game }: { code: string; game: string }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={`Friend battle, code ${code.split("").join(" ")}. Share it`} scaleTo={0.96} style={pill.wrap} onPress={() => void Share.share({ message: `Join my ${game} battle on PAWS with code ${code}` })}>
    <UsersThreeIcon size={16} color={text.primary} weight="bold" />
    <Text style={pill.label}>Friends</Text>
    <Text style={pill.code}>{code}</Text>
    <ShareNetworkIcon size={16} color={text.secondary} weight="bold" />
  </PressScale>
);

const pill = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: accent.soft, borderWidth: 1, borderColor: accent.primary, marginBottom: space.lg },
  label: { fontSize: 14, fontWeight: "800", color: text.primary },
  code: { fontSize: 15, fontWeight: "800", letterSpacing: 2, color: text.primary, fontVariant: ["tabular-nums"] },
});
