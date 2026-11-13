import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { BookOpenIcon, CellSignalLowIcon, ChartBarIcon, CircleIcon, FlagIcon, PauseIcon, PlayIcon, SignOutIcon, SquareIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { BattleMap, TEAM_COLOR, TEAM_NAME } from "@/features/rooms/components/BattleMap";
import { START, isNewer, opponentCaptures, takeFresh, type EventCursor } from "@/features/rooms/battleEvents";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { ISSUE_TEXT, formatArea, formatDistance } from "@/features/tournament/format";
import { useLocalTrack } from "@/features/tournament/gps/useLocalTrack";
import { GPS_RULES, evaluateTerritory, type TerritoryIssue } from "../../../../supabase/functions/tournament/geo";
import { ROAD_RULES, matchRoads, showPoints, type RoadEdge } from "../../../../supabase/functions/rooms/battle";
import { advanceBattle, getBattleState, regionRoads, reopenRoom, submitRoad, submitTerritory, type BattleState, type RegionRoad, type RoomState, type Team } from "@/services/roomService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const key = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const other = (t: Team): Team => (t === "blue" ? "orange" : "blue");
const TeamMark = ({ team, size = 12 }: { team: Team; size?: number }) =>
  team === "blue" ? <CircleIcon size={size} color={TEAM_COLOR.blue} weight="fill" /> : <SquareIcon size={size} color={TEAM_COLOR.orange} weight="fill" />;

type Toast = { id: string; text: string; tone: "good" | "bad" | "plain" };

/**
 * A team battle in progress, then its result. The server is the only judge: a capture is shown as yours only once
 * the server has committed it, scores and ownership always come from the server's state, and the match moves from
 * countdown to active to finished by the server's clock.
 */
export const BattleScreen = ({ room, matchId, roomVersion, live, onLeave, onChanged }: { room: RoomState; matchId: string; roomVersion: number; live: boolean; onLeave: () => void; onChanged: () => void }) => {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // battle_state is the canonical record; a slow reply that lands after a newer one is ignored.
  const battle = useQuery({
    queryKey: ["battle", matchId],
    queryFn: () => getBattleState(matchId),
    refetchInterval: 6_000,
    staleTime: 0,
    structuralSharing: (old: unknown, next: unknown) => (isNewer(old as BattleState | undefined, next as BattleState) ? (next as BattleState) : (old as BattleState)),
  });
  const state = battle.data;
  const regionId = state?.match.regionId ?? null;
  const roadsQuery = useQuery({ queryKey: ["regionRoads", regionId], queryFn: () => regionRoads(regionId ?? ""), enabled: Boolean(regionId), staleTime: Infinity });
  const roads = useMemo(() => roadsQuery.data ?? [], [roadsQuery.data]);

  // Every broadcast bumps the room version; reload the battle when it moves.
  useEffect(() => {
    void battle.refetch();
  }, [roomVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const offset = state ? Date.parse(state.serverNow) - (battle.dataUpdatedAt || Date.now()) : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const serverNow = now + offset;

  const status = state?.match.status;
  const active = status === "active" && serverNow < Date.parse(state?.match.endsAt ?? "");
  const [paused, setPaused] = useState(false);
  const track = useLocalTrack(Boolean(active), paused);

  // The server moves the match on; each phone nudges it once when a boundary passes.
  const nudged = useRef<string | null>(null);
  useEffect(() => {
    if (!state) return;
    const boundary = status === "countdown" ? state.match.startsAt : status === "active" || status === "finalizing" ? state.match.endsAt : null;
    if (!boundary || serverNow < Date.parse(boundary)) return;
    const k = `${status}:${boundary}`;
    if (nudged.current === k) return;
    nudged.current = k;
    void advanceBattle(matchId).catch(() => undefined).finally(() => {
      void battle.refetch();
      onChanged();
    });
  }, [serverNow, status, state, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Feedback ----------
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState<{ polygon?: { latitude: number; longitude: number }[]; edgeId?: string } | null>(null);
  const toast = useCallback((t: string, tone: Toast["tone"] = "plain") => {
    const id = key();
    setToasts((list) => [...list.slice(-2), { id, text: t, tone }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3_200);
  }, []);
  const flashFor = useCallback((f: typeof flash) => {
    setFlash(f);
    setTimeout(() => setFlash(null), 1_600);
  }, []);

  // Opponent captures arrive as events; each is shown once, in order, however the reloads arrive.
  const cursor = useRef<EventCursor>(START);
  useEffect(() => {
    if (!state) return;
    const { fresh, cursor: next } = takeFresh(cursor.current, state.events, state.match.seq);
    cursor.current = next;
    for (const e of opponentCaptures(fresh, state.myTeam)) {
      if (e.kind === "territory") toast(`${TEAM_NAME[e.team!]} captured ${formatArea(Number(e.payload.capturedM2))}`, "bad");
      else toast(`${TEAM_NAME[e.team!]} took ${roads.find((r) => r.id === e.payload.edgeId)?.name ?? "a road"}`, "bad");
    }
  }, [state, roads, toast]);

  // ---------- Steal Your Territory: the current loop ----------
  const [loopStart, setLoopStart] = useState(0);
  const loopPoints = useMemo(() => track.points.slice(loopStart), [track.points, loopStart]);
  const loopKey = Math.floor(loopPoints.length / 3);
  const loop = useMemo(() => evaluateTerritory(loopPoints, GPS_RULES, { checkCrossing: false }), [loopKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const loopReady = loop.distanceM >= GPS_RULES.minDistanceM && loop.closureM <= GPS_RULES.closureM;
  const claimKey = useRef<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    claimKey.current = claimKey.current ?? key();
    try {
      const reply = await submitTerritory(matchId, loopPoints, claimKey.current);
      if (reply.status === "claimed") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(reply.gainedM2 > 1 ? `Territory claimed! +${formatArea(reply.gainedM2)}` : "Already yours. No new ground in that loop.", "good");
        if (reply.capturedM2 > 1) toast(`Taken from ${TEAM_NAME[other(state?.myTeam ?? "blue")]}: ${formatArea(reply.capturedM2)}`, "good");
        flashFor({ polygon: loop.ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) });
        setLoopStart(track.points.length);
        claimKey.current = null;
        void battle.refetch();
      } else {
        toast(ISSUE_TEXT[reply.issues[0] as TerritoryIssue] ?? "That loop can't be claimed.", "plain");
        claimKey.current = null;
      }
    } catch (e) {
      // A network failure keeps the same request key, so retrying can never claim twice.
      const code = (e as { code?: string }).code;
      if (code !== "network" && code !== "timeout") claimKey.current = null;
      toast(roomErrorText(code), "bad");
    } finally {
      setClaiming(false);
    }
  };

  // ---------- Steal Your Road: coverage and captures ----------
  const edges: RoadEdge[] = useMemo(() => roads.filter((r) => r.status === "verified").map((r) => ({ id: r.id, startNodeId: r.startNodeId, endNodeId: r.endNodeId, coords: r.coords, lengthM: r.lengthM, name: r.name })), [roads]);
  const coverKey = Math.floor(track.points.length / 4);
  const coverage = useMemo(() => (state?.match.gameType === "steal_road" && edges.length ? matchRoads(track.points, edges) : new Map()), [coverKey, edges, state?.match.gameType]); // eslint-disable-line react-hooks/exhaustive-deps
  const owner = useMemo(() => new Map((state?.roads ?? []).map((r) => [r.edgeId, r])), [state?.roads]);
  const tried = useRef(new Map<string, { at: number; key: string }>());
  const progress = useMemo(() => {
    if (!state?.myTeam) return null;
    const open = [...coverage.values()].filter((c) => c.share > 0.05 && owner.get(c.edgeId)?.team !== state.myTeam).sort((a, b) => b.share - a.share);
    return open[0] ?? null;
  }, [coverage, owner, state?.myTeam]);

  useEffect(() => {
    if (!active || !state?.myTeam || state.match.gameType !== "steal_road") return;
    for (const c of coverage.values()) {
      if (c.share < ROAD_RULES.captureShare) continue;
      const held = owner.get(c.edgeId);
      if (held?.team === state.myTeam) continue;
      const last = tried.current.get(c.edgeId);
      if (last && Date.now() - last.at < 20_000) continue;
      const k = last?.key ?? key();
      tried.current.set(c.edgeId, { at: Date.now(), key: k });
      void submitRoad(matchId, c.edgeId, track.points, k)
        .then((r) => {
          if (r.status === "accepted") {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast(`Road captured! +${showPoints(r.points ?? 0)} points`, "good");
            flashFor({ edgeId: c.edgeId });
            tried.current.delete(c.edgeId);
            void battle.refetch();
          } else if (r.reason === "cooldown") {
            toast(`${c.name ?? "That road"} was just taken. Try again in a moment.`, "plain");
            tried.current.set(c.edgeId, { at: Date.now() + 100_000, key: key() });
          } else {
            tried.current.set(c.edgeId, { at: Date.now(), key: key() });
          }
        })
        .catch((e) => {
          const code = (e as { code?: string }).code;
          // Keep the key on a network failure so the retry is the same attempt.
          if (code !== "network" && code !== "timeout") tried.current.set(c.edgeId, { at: Date.now(), key: key() });
        });
    }
  }, [coverage]); // eslint-disable-line react-hooks/exhaustive-deps

  const [rules, setRules] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);

  if (!state) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{battle.error ? roomErrorText((battle.error as { code?: string }).code) : "Joining the battle"}</Text>
        {battle.error ? <RaisedButton tone="white" label="Leave" onPress={onLeave} /> : null}
      </View>
    );
  }

  const territoryGame = state.match.gameType === "steal_territory";
  const unit = territoryGame ? "m2" : "points";
  const showScore = (team: Team) => (territoryGame ? formatArea(state.teams[team]?.score ?? 0) : `${showPoints(state.teams[team]?.score ?? 0)} pts`);

  if (state.match.status === "completed" || state.match.status === "cancelled") {
    return <BattleResultView state={state} room={room} roads={roads} unit={unit} onLeave={onLeave} onChanged={onChanged} />;
  }

  const countdown = state.match.status === "countdown" || serverNow < Date.parse(state.match.startsAt);
  const remaining = Date.parse(state.match.endsAt) - serverNow;
  const myTeam = state.myTeam;
  const pathSegments = track.points.slice(territoryGame ? loopStart : 0).map((p) => ({ latitude: p.latitude, longitude: p.longitude }));

  return (
    <View style={styles.flex}>
      <BattleMap state={state} roads={roads} path={pathSegments} start={territoryGame && loopPoints[0] ? loopPoints[0] : null} position={track.position} flash={flash} follow={Boolean(active) && !paused} />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.board} accessible accessibilityLabel={`Blue ${showScore("blue")}, Orange ${showScore("orange")}, ${clock(remaining)} left`}>
          <ScoreSide team="blue" value={showScore("blue")} mine={myTeam === "blue"} />
          <View style={styles.timer}>
            <Text style={styles.timerValue}>{countdown ? "--:--" : clock(remaining)}</Text>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, live && styles.liveDotOn]} />
              <Text style={styles.timerLabel}>{live ? "Live" : "Reconnecting"}</Text>
            </View>
          </View>
          <ScoreSide team="orange" value={showScore("orange")} mine={myTeam === "orange"} />
        </View>
        <View style={styles.objective}>
          {myTeam ? <TeamMark team={myTeam} /> : null}
          <Text style={styles.objectiveText} numberOfLines={2}>
            {territoryGame ? "Close a loop to claim the ground inside it." : "Walk along a road to capture it."}
          </Text>
          <Text style={styles.count}>{`${state.members.length} players`}</Text>
        </View>
        {paused && active ? (
          <Animated.View entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={[styles.warn, styles.paused]}>
            <PauseIcon size={16} color={text.primary} weight="fill" />
            <Text style={styles.warnText}>Paused. Steps won't count until you resume.</Text>
          </Animated.View>
        ) : track.weak || track.lost ? (
          <Animated.View entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.warn}>
            <CellSignalLowIcon size={16} color={text.primary} weight="bold" />
            <Text style={styles.warnText}>{track.lost ? "Looking for GPS" : "Weak GPS. Those steps won't count."}</Text>
          </Animated.View>
        ) : null}
        <View style={styles.toasts} pointerEvents="none">
          {toasts.map((t) => (
            <Animated.View key={t.id} entering={reduceMotion ? FadeIn : FadeInUp.duration(motion.duration.enter)} exiting={FadeOut.duration(motion.duration.exit)} style={[styles.toast, t.tone === "good" && styles.toastGood, t.tone === "bad" && styles.toastBad]}>
              <Text style={[styles.toastText, t.tone === "bad" && styles.toastTextBad]}>{t.text}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {countdown ? (
        <View style={styles.countdown} pointerEvents="none">
          <Text style={styles.countdownLabel}>GET READY</Text>
          <Animated.Text key={Math.ceil((Date.parse(state.match.startsAt) - serverNow) / 1000)} entering={reduceMotion ? FadeIn : ZoomIn.duration(220).withInitialValues({ transform: [{ scale: 1.25 }], opacity: 0 })} style={styles.countdownValue}>
            {Math.ceil((Date.parse(state.match.startsAt) - serverNow) / 1000) > 0 ? Math.ceil((Date.parse(state.match.startsAt) - serverNow) / 1000) : "Go"}
          </Animated.Text>
          {myTeam ? <Text style={styles.countdownLabel}>{`You're on ${TEAM_NAME[myTeam]}`}</Text> : null}
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
        {!countdown && territoryGame ? (
          <View style={[styles.progress, loopReady && styles.progressReady]}>
            <FlagIcon size={18} color={text.primary} weight="fill" />
            <Text style={styles.progressText}>
              {loopReady ? "Back at the start. Claim it." : loop.distanceM < GPS_RULES.minDistanceM ? `Loop: ${formatDistance(loop.distanceM)} of ${GPS_RULES.minDistanceM} m` : `Start is ${Math.round(loop.closureM)} m away`}
            </Text>
            {loopReady ? <RaisedButton height={44} label="Claim" busy={claiming} onPress={() => void claim()} /> : null}
          </View>
        ) : null}
        {!countdown && !territoryGame && progress ? (
          <View style={styles.progress}>
            <Text style={styles.progressText}>{`${progress.name ?? "Road"}: ${Math.round(progress.share * 100)}% covered`}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.min(100, (progress.share / ROAD_RULES.captureShare) * 100)}%` }]} />
            </View>
          </View>
        ) : null}
        <View style={styles.controls}>
          <Control icon={paused ? <PlayIcon size={20} color={text.primary} weight="fill" /> : <PauseIcon size={20} color={text.primary} weight="fill" />} label={paused ? "Resume" : "Pause"} onPress={() => setPaused((p) => !p)} disabled={!active} />
          <Control icon={<BookOpenIcon size={20} color={text.primary} weight="fill" />} label="Rules" onPress={() => setRules(true)} />
          <Control icon={<ChartBarIcon size={20} color={text.primary} weight="fill" />} label="Teams" onPress={() => setTeamsOpen(true)} />
          <Control icon={<SignOutIcon size={20} color={text.primary} weight="bold" />} label="Leave" onPress={onLeave} />
        </View>
      </View>

      <Sheet visible={rules} title="How it works" onClose={() => setRules(false)}>
        {territoryGame ? (
          <>
            <Rule text={`Walk a loop of at least ${GPS_RULES.minDistanceM} m and come back within ${GPS_RULES.closureM} m of where it started.`} />
            <Rule text="The ground inside becomes your team's. If it covers the other team's ground, that part becomes yours." />
            <Rule text="Your own ground is never counted twice. The larger total area at the end wins." />
            <Rule text="The latest claim the server accepts owns any overlap. Speed never scores." />
          </>
        ) : (
          <>
            <Rule text="Walk along a road to cover it. At 70% covered, it's captured for your team." />
            <Rule text="1 point per 10 m of road held, plus 20% of your largest connected network's points once it has 3 roads." />
            <Rule text="A road just captured can't be taken back for 2 minutes." />
          </>
        )}
        <Rule text="Stay on public paths, cross only at crossings, keep your dog on a lead near roads. Never trespass or run for points." />
      </Sheet>

      <Sheet visible={teamsOpen} title="Team progress" onClose={() => setTeamsOpen(false)}>
        {(["blue", "orange"] as Team[]).map((t) => (
          <View key={t} style={styles.teamBlock}>
            <View style={styles.teamHead}>
              <TeamMark team={t} size={14} />
              <Text style={styles.teamName}>{TEAM_NAME[t]}</Text>
              <Text style={styles.teamScore}>{territoryGame ? formatArea(state.teams[t]?.score ?? 0) : `${showPoints(state.teams[t]?.score ?? 0)} pts`}</Text>
            </View>
            {!territoryGame && state.teams[t]?.detail ? (
              <Text style={styles.teamDetail}>{`${formatDistance(state.teams[t].detail.lengthM ?? 0)} of road${(state.teams[t].detail.bonus ?? 0) > 0 ? `, network bonus +${showPoints(state.teams[t].detail.bonus ?? 0)}` : ""}`}</Text>
            ) : null}
            <Text style={styles.teamDetail}>{state.members.filter((m) => m.team === t).map((m) => m.name).join(", ")}</Text>
          </View>
        ))}
      </Sheet>
    </View>
  );
};

const ScoreSide = ({ team, value, mine }: { team: Team; value: string; mine: boolean }) => (
  <View style={[styles.side, team === "orange" && styles.sideRight]}>
    <View style={styles.sideHead}>
      <TeamMark team={team} />
      <Text style={[styles.sideName, { color: TEAM_COLOR[team] }]}>{`${TEAM_NAME[team].toUpperCase()}${mine ? " (YOU)" : ""}`}</Text>
    </View>
    <Animated.Text key={value} entering={FadeIn.duration(motion.duration.select)} style={styles.sideScore} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Animated.Text>
  </View>
);

const Control = ({ icon, label, onPress, disabled }: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} style={[styles.control, disabled && styles.controlOff]} onPress={onPress}>
    {icon}
    <Text style={styles.controlText}>{label}</Text>
  </PressScale>
);

const Rule = ({ text: line }: { text: string }) => (
  <View style={styles.rule}>
    <View style={styles.bullet} />
    <Text style={styles.ruleText}>{line}</Text>
  </View>
);

const Sheet = ({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.flex2} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
          <RaisedButton tone="white" label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const BattleResultView = ({ state, room, roads, unit, onLeave, onChanged }: { state: BattleState; room: RoomState; roads: RegionRoad[]; unit: "m2" | "points"; onLeave: () => void; onChanged: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const r = state.match.result;
  const [busy, setBusy] = useState(false);
  const fmt = (v: number) => (unit === "m2" ? formatArea(v) : `${showPoints(v)} pts`);
  const cancelled = state.match.status === "cancelled";
  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.result, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }], opacity: 0 })} style={[styles.banner, r && r.winner !== "tie" && { backgroundColor: TEAM_COLOR[r.winner] }]}>
        <Text style={[styles.bannerTitle, r && r.winner !== "tie" && styles.onColor]}>
          {cancelled ? "Match cancelled" : !r ? "Counting up" : r.winner === "tie" ? "It's a tie." : `${TEAM_NAME[r.winner]} wins!`}
        </Text>
        {cancelled ? <Text style={styles.bannerLine}>The host ended it early. No team wins.</Text> : null}
        {state.myTeam && r && r.winner !== "tie" ? <Text style={[styles.bannerLine, styles.onColor]}>{r.winner === state.myTeam ? "Your team took it." : "Next time."}</Text> : null}
      </Animated.View>
      {r ? (
        <>
          <View style={styles.finalScores}>
            {(["blue", "orange"] as Team[]).map((t) => (
              <View key={t} style={styles.finalSide}>
                <View style={styles.sideHead}>
                  <TeamMark team={t} size={14} />
                  <Text style={[styles.sideName, { color: TEAM_COLOR[t] }]}>{TEAM_NAME[t].toUpperCase()}</Text>
                </View>
                <Text style={styles.finalValue}>{fmt(r.scores[t] ?? 0)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.mapBox}>
            <BattleMap state={state} roads={roads} path={[]} start={null} position={null} flash={null} follow={false} fitContent />
          </View>
          <Text style={styles.section}>{unit === "m2" ? `${count(r.claims, "claim")}, ${formatArea(r.capturedM2)} taken from the other team` : `${count(r.claims, "road")} captured`}</Text>
          <View style={styles.list}>
            {r.players.map((p) => (
              <View key={p.userId} style={styles.player}>
                <TeamMark team={p.team} />
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.userId === room.me.userId ? `${p.name} (you)` : p.name}
                </Text>
                <Text style={styles.playerStat}>{unit === "m2" ? `${count(p.claims, "claim")}, +${formatArea(p.gainedM2)}` : `${count(p.roads, "road")}, +${showPoints(p.roadPoints)} pts`}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>{unit === "m2" ? "Scores are the ground each team held at the end, not everything ever captured." : "Scores are roads held at the end, plus each team's network bonus."}</Text>
        </>
      ) : null}
      <View style={styles.actions}>
        {room.me.isHost && room.room.status === "finished" ? (
          <RaisedButton
            label="Play again"
            busy={busy}
            onPress={() => {
              setBusy(true);
              void reopenRoom(room.room.id).catch(() => undefined).finally(() => {
                setBusy(false);
                onChanged();
              });
            }}
          />
        ) : null}
        <RaisedButton tone="white" label="Leave room" onPress={onLeave} />
      </View>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flex2: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl, backgroundColor: bg.canvas },
  title: { ...type.sectionTitle, fontWeight: "700", color: text.primary, textAlign: "center" },
  top: { position: "absolute", left: space.md, right: space.md, top: 0, gap: space.sm },
  board: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: 24, backgroundColor: bg.surface },
  side: { flex: 1 },
  sideRight: { alignItems: "flex-end" },
  sideHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  sideName: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  sideScore: { fontSize: 20, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  timer: { alignItems: "center", paddingHorizontal: space.md },
  timerValue: { fontSize: 22, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  timerLabel: { ...type.caption, color: text.secondary },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: border.default },
  liveDotOn: { backgroundColor: "#2F8F4E" },
  objective: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 16, backgroundColor: bg.surface },
  objectiveText: { ...type.caption, color: text.primary, flex: 1 },
  count: { ...type.caption, fontWeight: "700", color: text.secondary },
  warn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  paused: { backgroundColor: "#FFFFFF" },
  warnText: { fontSize: 13, fontWeight: "700", color: text.primary },
  toasts: { gap: 6, alignItems: "center" },
  toast: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: bg.surface },
  toastGood: { backgroundColor: accent.deep },
  toastBad: { backgroundColor: "#2A2926" },
  toastText: { fontSize: 14, fontWeight: "800", color: text.primary },
  toastTextBad: { color: "#FFFFFF" },
  countdown: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,27,26,0.45)" },
  countdownLabel: { ...type.eyebrow, color: "#FFFFFF" },
  countdownValue: { fontSize: 120, lineHeight: 130, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  bottom: { position: "absolute", left: space.md, right: space.md, bottom: 0, gap: space.sm },
  progress: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: 18, backgroundColor: bg.surface, flexWrap: "wrap" },
  progressReady: { backgroundColor: accent.deep },
  progressText: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1 },
  bar: { flexBasis: "100%", height: 6, borderRadius: 3, backgroundColor: bg.subtle, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: accent.band },
  controls: { flexDirection: "row", gap: space.sm },
  control: { flex: 1, height: 58, borderRadius: 18, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", gap: 2 },
  controlOff: { opacity: 0.5 },
  controlText: { fontSize: 11, fontWeight: "800", color: text.primary },
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)" },
  sheet: { backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xxl, gap: space.md },
  sheetTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  rule: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent.band, marginTop: 8 },
  ruleText: { ...type.supporting, color: text.primary, flex: 1 },
  teamBlock: { padding: space.md, borderRadius: radius.card, backgroundColor: bg.subtle, gap: 4 },
  teamHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  teamName: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  teamScore: { fontSize: 16, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  teamDetail: { ...type.caption, color: text.secondary },
  result: { paddingHorizontal: layout.gutter, gap: space.md },
  banner: { padding: space.xl, borderRadius: 28, backgroundColor: accent.deep, gap: 4 },
  bannerTitle: { fontSize: 28, lineHeight: 33, fontWeight: "800", color: text.primary },
  bannerLine: { ...type.body, color: text.primary },
  onColor: { color: "#FFFFFF" },
  finalScores: { flexDirection: "row", gap: space.md },
  finalSide: { flex: 1, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, gap: 4 },
  finalValue: { fontSize: 22, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  mapBox: { height: 240, borderRadius: 24, overflow: "hidden" },
  section: { ...type.supporting, fontWeight: "700", color: text.primary },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  player: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, height: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border.default },
  playerName: { ...type.cardTitle, color: text.primary, flex: 1 },
  playerStat: { ...type.caption, fontWeight: "700", color: text.secondary, fontVariant: ["tabular-nums"] },
  note: { ...type.caption, color: text.tertiary },
  actions: { gap: space.md, marginTop: space.md },
});
