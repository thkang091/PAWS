import { useState } from "react";
import { Share, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretRightIcon, ShareNetworkIcon, SwordIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { ModeIllustration } from "@/features/game/components/ModeIllustration";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ReplaySheet } from "@/features/game/arena/ReplaySheet";
import { GAMES, errorText, formatScore } from "@/features/game/arena/arenaCopy";
import { arenaKeys, useDuels } from "@/hooks/useArena";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { createDuel, joinDuel, type ArenaDuel, type ArenaGame } from "@/services/arenaService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type Panel = "none" | "new" | "join";

const statusOf = (d: ArenaDuel): { label: string; tone: "go" | "wait" | "win" | "quiet" } => {
  if (d.status === "expired") return { label: "Ended", tone: "quiet" };
  if (d.status === "done") return d.result === "won" ? { label: "You won", tone: "win" } : d.result === "lost" ? { label: "They won", tone: "quiet" } : { label: "Draw", tone: "quiet" };
  if (d.myTurnOpen) return { label: "Your turn", tone: "go" };
  if (!d.opponentName) return { label: "Waiting for a player", tone: "wait" };
  return { label: "Their turn", tone: "wait" };
};

const hoursLeft = (iso: string) => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 3_600_000));

/**
 * Duel: 1 on 1. Start one and send its code, or type a friend's code. Both dogs play the same game; the longer sit or
 * the faster combo wins. Each player gets three starts and the first clip that scores is their turn.
 */
export default function DuelScreen() {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const name = dog.data?.name ?? "your dog";
  const duels = useDuels(dogId);
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [made, setMade] = useState<ArenaDuel | null>(null);
  const [replay, setReplay] = useState<{ id: string; title: string } | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: arenaKeys.duels(dogId ?? "") });

  const open = (next: Panel) => {
    void Haptics.selectionAsync();
    setError(null);
    setMade(null);
    setPanel(panel === next ? "none" : next);
  };

  const make = async (game: ArenaGame) => {
    if (!dogId) return;
    setBusy(true);
    setError(null);
    try {
      setMade(await createDuel(dogId, game));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (e) {
      setError(errorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!dogId) return;
    setBusy(true);
    setError(null);
    try {
      const duel = await joinDuel(dogId, code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPanel("none");
      setCode("");
      refresh();
      router.push({ pathname: "/game/play", params: { game: duel.game, duelId: duel.id } });
    } catch (e) {
      setError(errorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  const share = (d: ArenaDuel) =>
    void Share.share({ message: `${name} challenges you to ${GAMES[d.game].title} on PAWS. Open Game, then Duel, and enter code ${d.code}.` });

  const setupError = duels.error as { code?: string } | null;

  return (
    <DetailShell title="Duel" glyph={<SwordIcon size={20} color={accent.band} weight="fill" />} back="/(tabs)/game">
      <View style={styles.intro}>
        <ModeIllustration mode="duel" width={180} />
        <Text style={styles.introText}>Two dogs, the same game. The best score wins.</Text>
      </View>
      <View style={styles.actions}>
        <RaisedButton label="New duel" onPress={() => open("new")} style={styles.flex} disabled={!dogId} />
        <RaisedButton tone="white" label="Join" onPress={() => open("join")} style={styles.flex} disabled={!dogId} />
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel="Weekly boards for Longest Sit and Trick Combo" style={styles.boards} onPress={() => router.push("/game/arena")}>
        <Text style={styles.boardsText}>Play solo on the weekly boards</Text>
        <CaretRightIcon size={16} color={text.primary} weight="bold" />
      </PressScale>

      {panel === "new" ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)} style={styles.panel}>
          {made ? (
            <>
              <Text style={styles.panelEyebrow}>SEND THIS CODE</Text>
              <Text style={styles.code} selectable>
                {made.code}
              </Text>
              <Text style={styles.panelNote}>{`${GAMES[made.game].title}. Open for 48 hours.`}</Text>
              <View style={styles.actions}>
                <RaisedButton tone="white" label="Share" icon={<ShareNetworkIcon size={18} color={text.primary} weight="bold" />} onPress={() => share(made)} style={styles.flex} />
                <RaisedButton label="Play now" onPress={() => router.push({ pathname: "/game/play", params: { game: made.game, duelId: made.id } })} style={styles.flex} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.panelEyebrow}>PICK A GAME</Text>
              {(Object.keys(GAMES) as ArenaGame[]).map((g) => (
                <PressScale key={g} accessibilityRole="button" accessibilityLabel={`${GAMES[g].title}. ${GAMES[g].direction}`} style={styles.option} disabled={busy} onPress={() => void make(g)}>
                  <View style={styles.flex}>
                    <Text style={styles.optionTitle}>{GAMES[g].title}</Text>
                    <Text style={styles.optionNote}>{GAMES[g].goal}</Text>
                  </View>
                  <Text style={styles.optionTag}>{GAMES[g].direction}</Text>
                </PressScale>
              ))}
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
      ) : null}

      {panel === "join" ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)} style={styles.panel}>
          <Text style={styles.panelEyebrow}>ENTER A FRIEND'S CODE</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={6}
            placeholder="ABC234"
            placeholderTextColor={text.disabled}
            style={styles.codeInput}
            accessibilityLabel="Duel code"
            returnKeyType="go"
            onSubmitEditing={() => code.length === 6 && void join()}
          />
          <RaisedButton label="Join duel" busy={busy} disabled={code.length !== 6} onPress={() => void join()} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
      ) : null}

      <Text style={styles.section}>Your duels</Text>
      {setupError ? (
        <Text style={styles.empty}>{errorText(setupError.code)}</Text>
      ) : duels.isLoading ? (
        <Text style={styles.empty}>Loading.</Text>
      ) : !duels.data?.length ? (
        <Text style={styles.empty}>No duels yet. Start one and send the code to a friend.</Text>
      ) : (
        <View style={styles.list}>
          {duels.data.map((d, i) => (
            <Animated.View key={d.id} entering={reduceMotion ? undefined : FadeIn.delay(i * motion.stagger).duration(motion.duration.enter)}>
              <DuelCard
                duel={d}
                name={name}
                onPlay={() => router.push({ pathname: "/game/play", params: { game: d.game, duelId: d.id } })}
                onShare={() => share(d)}
                onReplay={(id, who, ms) => setReplay({ id, title: `${who} · ${formatScore(d.game, ms)}` })}
              />
            </Animated.View>
          ))}
        </View>
      )}

      <ReplaySheet attemptId={replay?.id ?? null} title={replay?.title ?? ""} onClose={() => setReplay(null)} />
    </DetailShell>
  );
}

const DuelCard = ({
  duel,
  name,
  onPlay,
  onShare,
  onReplay,
}: {
  duel: ArenaDuel;
  name: string;
  onPlay: () => void;
  onShare: () => void;
  onReplay: (attemptId: string, who: string, ms: number) => void;
}) => {
  const status = statusOf(duel);
  const them = duel.opponentName ?? "Open seat";
  const live = duel.status === "open" || duel.status === "playing";
  return (
    <View style={[styles.card, status.tone === "go" && styles.cardGo]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardGame}>{GAMES[duel.game].title}</Text>
        <View style={[styles.pill, styles[`pill_${status.tone}`]]}>
          <Text style={styles.pillText}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.versus}>
        <Side who={name} ms={duel.myScoreMs} game={duel.game} lead={duel.result === "won"} onPress={duel.myAttemptId && duel.myScoreMs != null ? () => onReplay(duel.myAttemptId!, name, duel.myScoreMs!) : undefined} />
        <Text style={styles.vs}>vs</Text>
        <Side who={them} ms={duel.theirScoreMs} game={duel.game} lead={duel.result === "lost"} onPress={duel.theirAttemptId && duel.theirScoreMs != null ? () => onReplay(duel.theirAttemptId!, them, duel.theirScoreMs!) : undefined} />
      </View>
      {live ? <Text style={styles.cardNote}>{`${hoursLeft(duel.expiresAt)}h left${duel.myTurnOpen && duel.myStarts > 0 ? ` · start ${duel.myStarts + 1} of ${duel.startsAllowed}` : ""}`}</Text> : null}
      {live && (duel.myTurnOpen || !duel.opponentName) ? (
        <View style={styles.actions}>
          {!duel.opponentName ? <RaisedButton tone="white" height={48} label={`Share ${duel.code}`} onPress={onShare} style={styles.flex} /> : null}
          {duel.myTurnOpen ? <RaisedButton height={48} label="Play your turn" onPress={onPlay} style={styles.flex} /> : null}
        </View>
      ) : null}
    </View>
  );
};

const Side = ({ who, ms, game, lead, onPress }: { who: string; ms: number | null; game: ArenaGame; lead: boolean; onPress?: () => void }) => (
  <PressScale accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={`${who}. ${ms == null ? "No score yet" : formatScore(game, ms)}`} disabled={!onPress} style={styles.side} onPress={onPress}>
    <Text style={styles.sideName} numberOfLines={1}>
      {who}
    </Text>
    <Text style={[styles.sideScore, ms == null && styles.sideEmpty, lead && styles.sideLead]}>{ms == null ? "-" : formatScore(game, ms)}</Text>
  </PressScale>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: space.md },
  intro: { alignItems: "center", gap: space.md, marginTop: space.md, marginBottom: space.xl },
  introText: { ...type.supporting, color: text.secondary, textAlign: "center" },
  boards: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: space.md, paddingVertical: space.xs },
  boardsText: { ...type.supporting, fontWeight: "700", color: text.primary, textDecorationLine: "underline" },
  panel: { marginTop: space.lg, padding: space.lg, gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  panelEyebrow: { ...type.eyebrow, color: text.tertiary },
  panelNote: { ...type.supporting, color: text.secondary, textAlign: "center" },
  code: { fontSize: 44, lineHeight: 52, fontWeight: "800", letterSpacing: 8, textAlign: "center", color: text.primary, fontVariant: ["tabular-nums"] },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.input, backgroundColor: accent.soft },
  optionTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  optionNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  optionTag: { ...type.caption, fontWeight: "800", color: accent.band },
  codeInput: { height: 64, borderRadius: radius.input, backgroundColor: bg.subtle, textAlign: "center", fontSize: 30, fontWeight: "800", letterSpacing: 8, color: text.primary },
  error: { ...type.supporting, color: "#B4442C" },

  section: { ...type.sectionTitle, color: text.primary, marginTop: space.section, marginBottom: space.md },
  empty: { ...type.supporting, color: text.secondary },
  list: { gap: space.md, marginBottom: space.section },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  cardGo: { borderColor: accent.deep, backgroundColor: accent.soft },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardGame: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  pill: { height: 26, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: "center" },
  pill_go: { backgroundColor: accent.deep },
  pill_wait: { backgroundColor: bg.subtle },
  pill_win: { backgroundColor: "#FCD46F" },
  pill_quiet: { backgroundColor: bg.subtle },
  pillText: { fontSize: 12, fontWeight: "800", color: text.primary },
  versus: { flexDirection: "row", alignItems: "center", gap: space.md },
  vs: { ...type.caption, fontWeight: "800", color: text.tertiary },
  side: { flex: 1 },
  sideName: { ...type.caption, color: text.secondary },
  sideScore: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  sideEmpty: { color: text.disabled },
  sideLead: { color: accent.band },
  cardNote: { ...type.caption, color: text.secondary, fontVariant: ["tabular-nums"] },
});
