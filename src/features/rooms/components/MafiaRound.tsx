import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { CellSignalLowIcon, CheckIcon, DetectiveIcon, FlagIcon, MaskHappyIcon, ScrollIcon, WarningIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { TerritoryMap } from "@/features/tournament/components/TerritoryMap";
import { formatDistance } from "@/features/tournament/format";
import { useLocalTrack } from "@/features/tournament/gps/useLocalTrack";
import { CHECKPOINT_RADIUS_M } from "../../../../supabase/functions/rooms/logic";
import { metersBetween } from "../../../../supabase/functions/tournament/geo";
import { advanceRound, castVote, reopenRoom, submitMafiaWalk, type MafiaRoundView, type RoomState } from "@/services/roomService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Server time, ticking, so every phone counts down to the same moment. */
const useServerNow = (offsetMs: number) => {
  const [now, setNow] = useState(Date.now() + offsetMs);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetMs), 500);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
};

const deadlineOf = (r: MafiaRoundView) =>
  r.status === "walking" ? r.walkingEndsAt : r.status === "discussion" ? r.discussionEndsAt : r.status === "voting" ? r.votingEndsAt : null;

/**
 * One round of Find the Mafia, driven entirely by the server's state: reveal your role, walk, discuss, vote, see the
 * outcome. When a phase's time is up, any phone asks the server to move on; the server checks its own clock, so a
 * phone with the wrong time cannot skip ahead.
 */
export const MafiaRound = ({ state, offsetMs, onChanged, onLeave }: { state: RoomState; offsetMs: number; onChanged: () => void; onLeave: () => void }) => {
  useKeepAwake();
  const round = state.round!;
  const now = useServerNow(offsetMs);
  const [revealed, setRevealed] = useState(false);
  const asked = useRef<string | null>(null);

  // A phase whose time is up gets one nudge per phone; the server decides.
  const deadline = deadlineOf(round);
  useEffect(() => {
    if (!deadline || now < Date.parse(deadline)) return;
    const key = `${round.id}:${round.status}`;
    if (asked.current === key) return;
    asked.current = key;
    void advanceRound(round.id).catch(() => undefined).finally(onChanged);
  }, [now, deadline, round.id, round.status, onChanged]);

  const name = (id: string | null | undefined) => (id ? state.everyone[id] ?? "A player" : "Nobody");
  const remaining = deadline ? Date.parse(deadline) - now : 0;

  if (round.status === "cancelled") {
    return (
      <Centered title="The round was cancelled" line="The host ended the game.">
        <RaisedButton tone="white" label="Leave room" onPress={onLeave} />
      </Centered>
    );
  }
  if (round.status === "walking" && !revealed && round.myRole) {
    return <Reveal round={round} onDone={() => setRevealed(true)} />;
  }
  if (round.status === "walking") return <WalkPhase round={round} remaining={remaining} onChanged={onChanged} />;
  if (round.status === "discussion") return <Discussion round={round} remaining={remaining} name={name} />;
  if (round.status === "voting") return <Voting round={round} remaining={remaining} name={name} me={state.me.userId} onChanged={onChanged} />;
  return <Results state={state} round={round} name={name} onChanged={onChanged} onLeave={onLeave} />;
};

// ---------- Reveal ----------

const Reveal = ({ round, onDone }: { round: MafiaRoundView; onDone: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Until it is opened the screen looks the same for every role, so a glance gives nothing away.
  const mafia = open && round.myRole === "mafia";
  return (
    <View style={[styles.reveal, mafia && styles.revealMafia, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
      <Text style={[styles.revealEyebrow, mafia && styles.onDark]}>YOUR ROLE</Text>
      {!open ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Reveal your role. Keep your screen hidden from others." scaleTo={0.97} style={styles.cardBack} onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setOpen(true);
        }}>
          <ScrollIcon size={44} color={text.primary} weight="duotone" />
          <Text style={styles.cardBackTitle}>Tap to reveal</Text>
          <Text style={styles.cardBackLine}>Keep your screen to yourself.</Text>
        </PressScale>
      ) : (
        <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.9 }], opacity: 0 })} style={[styles.card, mafia && styles.cardMafia]}>
          {mafia ? <MaskHappyIcon size={48} color={accent.deep} weight="fill" /> : <DetectiveIcon size={48} color={text.primary} weight="fill" />}
          <Text style={[styles.cardTitle, mafia && styles.onDark]}>{mafia ? "You are the Mafia." : "You are a Civilian."}</Text>
          <Text style={[styles.cardLine, mafia && styles.onDarkSoft]}>
            {mafia ? "Take your secret route without being noticed. If the others don't vote you out, you win." : "Walk your route, then work out who took a different path. Vote them out to win."}
          </Text>
          {round.myObjective ? (
            <View style={[styles.objective, mafia && styles.objectiveMafia]}>
              <Text style={[styles.objectiveLabel, mafia && styles.onDarkSoft]}>YOUR OBJECTIVE</Text>
              <Text style={[styles.objectiveText, mafia && styles.onDark]}>{round.myObjective}</Text>
            </View>
          ) : null}
        </Animated.View>
      )}
      {open ? <RaisedButton label="Start walking" onPress={onDone} style={styles.revealButton} /> : null}
    </View>
  );
};

// ---------- Walking ----------

const WalkPhase = ({ round, remaining, onChanged }: { round: MafiaRoundView; remaining: number; onChanged: () => void }) => {
  const insets = useSafeAreaInsets();
  const handedIn = Boolean(round.myReport);
  const track = useLocalTrack(!handedIn);
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showObjective, setShowObjective] = useState(false);
  const sentRef = useRef(false);

  const reached = useMemo(() => {
    if (round.myReport) return new Set(round.myReport.reached);
    return new Set(round.myCheckpoints.filter((c) => track.points.some((p) => metersBetween(p, c) <= CHECKPOINT_RADIUS_M)).map((c) => c.number));
  }, [round.myReport, round.myCheckpoints, track.points]);

  const handIn = async () => {
    if (busy || handedIn) return;
    setBusy(true);
    setError(null);
    try {
      await submitMafiaWalk(round.id, track.points, shared);
      sentRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  // When the walking time runs out, the walk so far is handed in automatically.
  useEffect(() => {
    if (remaining <= 0 && !handedIn && !sentRef.current && track.points.length > 0) {
      sentRef.current = true;
      void handIn();
    }
  }, [remaining, handedIn, track.points.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportUnsafe = () =>
    Alert.alert("Unsafe checkpoint?", "Skip it and tell the group when you meet. Never take a risk to reach a checkpoint; a skipped one only counts as not reached.", [{ text: "OK" }]);

  return (
    <View style={styles.flex}>
      <TerritoryMap
        segments={[track.points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))]}
        start={round.meet}
        position={track.position}
        follow={!handedIn}
        pins={round.myCheckpoints.map((c) => ({ id: c.id, number: c.number, latitude: c.latitude, longitude: c.longitude, done: reached.has(c.number) }))}
        topInset={insets.top + 120}
        bottomInset={300}
      />
      <View style={[styles.walkTop, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.timer}>
          <Text style={styles.timerValue}>{clock(remaining)}</Text>
          <Text style={styles.timerLabel}>left to walk</Text>
        </View>
        {track.weak || track.lost ? (
          <View style={styles.warn}>
            <CellSignalLowIcon size={16} color={text.primary} weight="bold" />
            <Text style={styles.warnText}>{track.lost ? "Looking for GPS" : "Weak GPS"}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.walkCard, { paddingBottom: insets.bottom + space.lg }]}>
        {handedIn ? (
          <>
            <Text style={styles.walkTitle}>Walk handed in</Text>
            <Text style={styles.walkLine}>{`Reached ${round.myReport!.reached.length ? round.myReport!.reached.join(", ") : "no checkpoints"}. Head back to the meeting point; discussion starts in ${clock(remaining)}.`}</Text>
          </>
        ) : (
          <>
            <View style={styles.walkHead}>
              <View style={styles.flex}>
                <Text style={styles.walkTitle}>{`${reached.size} of ${round.myCheckpoints.length} checkpoints`}</Text>
                <Text style={styles.walkLine}>{`${formatDistance(track.distanceM)} walked. Only you can see your route.`}</Text>
              </View>
              <PressScale accessibilityRole="button" accessibilityLabel="View objective" style={styles.objectiveButton} onPress={() => setShowObjective(true)}>
                <ScrollIcon size={20} color={text.primary} weight="fill" />
              </PressScale>
            </View>
            <View style={styles.shareRow}>
              <Text style={styles.shareText}>Share which checkpoints I reached</Text>
              <Switch value={shared} onValueChange={setShared} trackColor={{ true: accent.band, false: border.default }} />
            </View>
            {track.access === "denied" || track.access === "blocked" ? <Text style={styles.error}>Location is off, so checkpoints can't be checked.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <RaisedButton label="End walk" icon={<FlagIcon size={18} color={text.primary} weight="fill" />} busy={busy} disabled={!track.points.length} onPress={() => void handIn()} />
            <PressScale accessibilityRole="button" accessibilityLabel="Report an unsafe checkpoint" style={styles.unsafe} onPress={reportUnsafe}>
              <WarningIcon size={14} color={text.secondary} weight="bold" />
              <Text style={styles.unsafeText}>Report unsafe checkpoint</Text>
            </PressScale>
          </>
        )}
      </View>
      <Modal visible={showObjective} transparent animationType="fade" onRequestClose={() => setShowObjective(false)}>
        <Pressable style={styles.modalScrim} accessibilityLabel="Close" onPress={() => setShowObjective(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.objectiveLabel}>{round.myRole === "mafia" ? "YOUR SECRET OBJECTIVE" : "YOUR OBJECTIVE"}</Text>
            <Text style={styles.modalText}>{round.myObjective}</Text>
            {round.myCheckpoints.map((c) => (
              <View key={c.id} style={styles.cpRow}>
                <View style={[styles.cpNo, reached.has(c.number) && styles.cpNoDone]}>
                  <Text style={styles.cpNoText}>{c.number}</Text>
                </View>
                <Text style={styles.cpLabel}>{c.label}</Text>
                {reached.has(c.number) ? <CheckIcon size={16} color={text.primary} weight="bold" /> : null}
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// ---------- Discussion and voting ----------

const ClueList = ({ round, name }: { round: MafiaRoundView; name: (id: string) => string }) => (
  <View style={styles.list}>
    {round.players.map((id) => {
      const clue = round.clues.find((c) => c.userId === id);
      return (
        <View key={id} style={styles.clue}>
          <Text style={styles.clueName}>{name(id)}</Text>
          {clue ? (
            <View style={styles.chips}>
              {clue.reached.length ? clue.reached.map((n) => (
                <View key={n} style={styles.clueChip}>
                  <Text style={styles.clueChipText}>{n}</Text>
                </View>
              )) : <Text style={styles.clueQuiet}>No checkpoints</Text>}
            </View>
          ) : (
            <Text style={styles.clueQuiet}>Kept private</Text>
          )}
        </View>
      );
    })}
  </View>
);

const Discussion = ({ round, remaining, name }: { round: MafiaRoundView; remaining: number; name: (id: string) => string }) => {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <Text style={styles.phaseEyebrow}>DISCUSS</Text>
      <Text style={styles.phaseClock}>{clock(remaining)}</Text>
      <Text style={styles.phaseLine}>Who took a different path? These are the checkpoints each player reached. Talk it over before voting opens.</Text>
      <ClueList round={round} name={name} />
    </ScrollView>
  );
};

const Voting = ({ round, remaining, name, me, onChanged }: { round: MafiaRoundView; remaining: number; name: (id: string) => string; me: string; onChanged: () => void }) => {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowSelf = round.settings?.allowSelfVote === true;
  const choices = round.players.filter((id) => allowSelf || id !== me);

  const vote = async () => {
    if (!pick) return;
    setBusy(true);
    setError(null);
    try {
      await castVote(round.id, pick);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: 140 + insets.bottom }]}>
        <Text style={styles.phaseEyebrow}>SECRET VOTE</Text>
        <Text style={styles.phaseClock}>{clock(remaining)}</Text>
        <Text style={styles.phaseLine}>{round.myVote ? `You voted for ${name(round.myVote)}. ${round.votesCast} of ${round.eligibleVoters} have voted.` : "Who is the Mafia? Nobody sees your vote until the end."}</Text>
        {!round.myVote ? (
          <View style={styles.list}>
            {choices.map((id, i) => (
              <Animated.View key={id} entering={FadeInDown.delay(i * motion.stagger).duration(motion.duration.enter)}>
                <PressScale accessibilityRole="radio" accessibilityState={{ selected: pick === id }} accessibilityLabel={name(id)} style={[styles.voteRow, pick === id && styles.voteRowOn]} onPress={() => setPick(id)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name(id).slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.voteName}>{name(id)}</Text>
                  <View style={[styles.radio, pick === id && styles.radioOn]} />
                </PressScale>
              </Animated.View>
            ))}
          </View>
        ) : (
          <ClueList round={round} name={name} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      {!round.myVote ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          <RaisedButton label={pick ? `Vote for ${name(pick)}` : "Choose a player"} disabled={!pick} busy={busy} onPress={() => void vote()} />
        </View>
      ) : null}
    </View>
  );
};

// ---------- Results ----------

const Results = ({ state, round, name, onChanged, onLeave }: { state: RoomState; round: MafiaRoundView; name: (id: string | null) => string; onChanged: () => void; onLeave: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const r = round.result;
  const [busy, setBusy] = useState(false);
  if (!r) return <Centered title="Counting the votes" line="One moment." />;
  const civiliansWon = r.winner === "civilians";
  const totals = Object.entries(r.totals).sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...totals.map(([, n]) => n));
  const headline = r.reason === "mafia_left" ? "The Mafia left the game." : r.reason === "tie" ? "The vote was tied, so nobody was accused." : `${name(r.accusedId)} was accused.`;

  const again = async () => {
    setBusy(true);
    await reopenRoom(state.room.id).catch(() => undefined);
    setBusy(false);
    onChanged();
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.94 }], opacity: 0 })} style={[styles.banner, !civiliansWon && styles.bannerMafia]}>
        <Text style={[styles.bannerEyebrow, !civiliansWon && styles.onDarkSoft]}>{civiliansWon ? "CIVILIANS WIN" : "THE MAFIA WINS"}</Text>
        <Text style={[styles.bannerTitle, !civiliansWon && styles.onDark]}>{`${name(r.mafiaId)} was the Mafia.`}</Text>
        <Text style={[styles.bannerLine, !civiliansWon && styles.onDarkSoft]}>{headline}</Text>
      </Animated.View>

      <Text style={styles.section}>Votes</Text>
      <View style={styles.list}>
        {totals.length ? totals.map(([id, n]) => (
          <View key={id} style={styles.bar2}>
            <Text style={styles.barName}>{name(id)}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(n / top) * 100}%` }, id === r.mafiaId && styles.barFillMafia]} />
            </View>
            <Text style={styles.barCount}>{n}</Text>
          </View>
        )) : <Text style={styles.clueQuiet}>No votes were cast.</Text>}
      </View>

      <Text style={styles.section}>Roles</Text>
      <View style={styles.list}>
        {round.players.map((id) => (
          <View key={id} style={styles.roleRow}>
            <Text style={styles.roleName}>{name(id)}</Text>
            <View style={[styles.rolePill, round.roles?.[id] === "mafia" && styles.rolePillMafia]}>
              <Text style={[styles.rolePillText, round.roles?.[id] === "mafia" && styles.onDark]}>{round.roles?.[id] === "mafia" ? "Mafia" : "Civilian"}</Text>
            </View>
          </View>
        ))}
      </View>

      {round.objectives?.mafia ? (
        <View style={styles.secret}>
          <Text style={styles.objectiveLabel}>THE MAFIA'S SECRET OBJECTIVE</Text>
          <Text style={styles.objectiveText}>{round.objectives.mafia}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Shared routes</Text>
      <ClueList round={round} name={(id) => name(id)} />

      <View style={styles.resultActions}>
        {state.me.isHost && state.room.status === "finished" ? <RaisedButton label="Play again" busy={busy} onPress={() => void again()} /> : null}
        {!state.me.isHost && state.room.status === "finished" ? <Text style={styles.phaseLine}>Waiting for the host to start another round.</Text> : null}
        <RaisedButton tone="white" label="Leave room" onPress={onLeave} />
      </View>
    </ScrollView>
  );
};

const Centered = ({ title, line, children }: { title: string; line: string; children?: React.ReactNode }) => (
  <View style={styles.centered}>
    <Text style={styles.walkTitle}>{title}</Text>
    <Text style={styles.walkLine}>{line}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  onDark: { color: "#FFFFFF" },
  onDarkSoft: { color: "rgba(255,255,255,0.72)" },
  reveal: { flex: 1, backgroundColor: accent.soft, paddingHorizontal: layout.gutter, alignItems: "stretch", justifyContent: "center", gap: space.xl },
  revealMafia: { backgroundColor: "#2A2926" },
  revealEyebrow: { ...type.eyebrow, color: text.tertiary, textAlign: "center" },
  cardBack: { alignItems: "center", gap: space.md, paddingVertical: space.block, borderRadius: 32, backgroundColor: accent.deep },
  cardBackTitle: { fontSize: 24, fontWeight: "800", color: text.primary },
  cardBackLine: { ...type.supporting, color: text.secondary },
  card: { alignItems: "center", gap: space.md, padding: space.xxl, borderRadius: 32, backgroundColor: bg.surface },
  cardMafia: { backgroundColor: "#3A3833" },
  cardTitle: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6, color: text.primary, textAlign: "center" },
  cardLine: { ...type.body, color: text.secondary, textAlign: "center" },
  objective: { alignSelf: "stretch", padding: space.lg, borderRadius: 20, backgroundColor: accent.soft, gap: 4 },
  objectiveMafia: { backgroundColor: "rgba(255,255,255,0.08)" },
  objectiveLabel: { ...type.eyebrow, color: text.tertiary },
  objectiveText: { ...type.body, fontWeight: "600", color: text.primary },
  revealButton: { marginTop: space.md },

  walkTop: { position: "absolute", left: space.lg, right: space.lg, top: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  timer: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 20, backgroundColor: bg.surface },
  timerValue: { fontSize: 26, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  timerLabel: { ...type.caption, color: text.secondary },
  warn: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  warnText: { fontSize: 13, fontWeight: "700", color: text.primary },
  walkCard: { position: "absolute", left: 0, right: 0, bottom: 0, gap: space.md, paddingHorizontal: space.xxl, paddingTop: space.xl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  walkHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  walkTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  walkLine: { ...type.supporting, color: text.secondary, marginTop: 2 },
  objectiveButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  shareRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  shareText: { ...type.supporting, color: text.primary, flex: 1 },
  unsafe: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: space.xs },
  unsafeText: { ...type.caption, fontWeight: "700", color: text.secondary },
  error: { ...type.supporting, color: "#B4442C" },
  modalScrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.45)", justifyContent: "center", padding: space.xxl },
  modalCard: { padding: space.xl, borderRadius: 28, backgroundColor: bg.surface, gap: space.md },
  modalText: { ...type.body, color: text.primary },
  cpRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  cpNo: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  cpNoDone: { backgroundColor: accent.deep, borderColor: accent.band },
  cpNoText: { fontSize: 12, fontWeight: "800", color: text.primary },
  cpLabel: { ...type.supporting, color: text.primary, flex: 1 },

  page: { paddingHorizontal: layout.gutter, gap: space.md },
  phaseEyebrow: { ...type.eyebrow, color: text.tertiary },
  phaseClock: { fontSize: 56, lineHeight: 62, fontWeight: "800", letterSpacing: -1.5, color: text.primary, fontVariant: ["tabular-nums"] },
  phaseLine: { ...type.body, color: text.secondary },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  clue: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border.default },
  clueName: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  chips: { flexDirection: "row", gap: 6 },
  clueChip: { width: 26, height: 26, borderRadius: 13, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  clueChipText: { fontSize: 12, fontWeight: "800", color: text.primary },
  clueQuiet: { ...type.caption, color: text.tertiary, padding: space.xs },
  voteRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border.default },
  voteRowOn: { backgroundColor: accent.soft },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "800", color: text.primary },
  voteName: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: border.default },
  radioOn: { borderWidth: 7, borderColor: accent.band },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },

  banner: { padding: space.xl, borderRadius: 28, backgroundColor: accent.deep, gap: 4 },
  bannerMafia: { backgroundColor: "#2A2926" },
  bannerEyebrow: { ...type.eyebrow, color: text.secondary },
  bannerTitle: { fontSize: 24, lineHeight: 29, fontWeight: "800", color: text.primary },
  bannerLine: { ...type.body, color: text.primary },
  section: { ...type.sectionTitle, color: text.primary, marginTop: space.lg },
  bar2: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 48 },
  barName: { ...type.supporting, fontWeight: "700", color: text.primary, width: 96 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: bg.subtle, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5, backgroundColor: border.default },
  barFillMafia: { backgroundColor: accent.band },
  barCount: { fontSize: 15, fontWeight: "800", color: text.primary, width: 20, textAlign: "right", fontVariant: ["tabular-nums"] },
  roleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, height: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border.default },
  roleName: { ...type.cardTitle, color: text.primary, flex: 1 },
  rolePill: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  rolePillMafia: { backgroundColor: "#2A2926" },
  rolePillText: { fontSize: 12, fontWeight: "800", color: text.primary },
  secret: { padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft, gap: 4, marginTop: space.md },
  resultActions: { gap: space.md, marginTop: space.xl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xxl, backgroundColor: bg.canvas },
});
