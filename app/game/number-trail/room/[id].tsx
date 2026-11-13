import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { NtLive } from "@/features/numberTrail/components/NtLive";
import { NtLobby } from "@/features/numberTrail/components/NtLobby";
import { NtOnlineLobby } from "@/features/numberTrail/components/NtOnlineLobby";
import { NtResults } from "@/features/numberTrail/components/NtResults";
import { NtReveal } from "@/features/numberTrail/components/NtReveal";
import { IndeterminateTrail, RacePlayerList, Toasts, type Toast } from "@/features/numberTrail/components/RacePieces";
import { ntStore, type Area } from "@/features/numberTrail/localStore";
import { eventLine, numberErrorText } from "@/features/numberTrail/raceCopy";
import { screenOf } from "@/features/numberTrail/raceView";
import { useNumberWalk } from "@/features/numberTrail/useNumberWalk";
import { useNumberRace } from "@/hooks/useNumberRace";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { prepareNumberRace, playNumberRaceAgain, type RaceState } from "@/services/numberRaceService";
import type { NumberEvent } from "../../../../supabase/functions/tournament/numberContract";
import { bg, layout, space, text, type } from "@/constants/design";

/**
 * One Number Trail room, from lobby to results. Every screen comes from the server's canonical state; this screen
 * only adds what the phone itself knows (its own GPS walk, the host's meeting point) and keeps the walk running from
 * the countdown on, so nothing is lost when the view changes.
 */
export default function NumberTrailRoomScreen() {
  const { id, prepare, invite } = useLocalSearchParams<{ id?: string; prepare?: string; invite?: string }>();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const meRef = useRef<string | null>(null);

  const onEvents = useCallback((fresh: NumberEvent[], s: RaceState) => {
    const name = (uid: string | null) => s.players.find((p) => p.userId === uid)?.name ?? "A player";
    for (const e of fresh) {
      // Your own news is shown by your own screen; others' is neutral until the server decides.
      if (e.userId && e.userId === meRef.current) continue;
      const line = eventLine(e.kind, name(e.userId), e.payload);
      if (!line) continue;
      const tid = `${e.seq}`;
      setToasts((list) => [...list.slice(-1), { id: tid, text: line }]);
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== tid)), 3_200);
    }
  }, []);
  const race = useNumberRace(id, onEvents);
  const state = race.state;
  meRef.current = state?.me.userId ?? null;
  const matchId = race.matchId;

  // The host's meeting point lives only on the host's phone.
  const [area, setAreaState] = useState<Area | null>(null);
  useEffect(() => {
    if (matchId) void ntStore.area(matchId).then(setAreaState);
  }, [matchId]);
  const setArea = (a: Area) => {
    setAreaState(a);
    if (matchId) void ntStore.setArea(matchId, a);
  };

  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const prepareNow = useCallback(
    async (opts?: { area?: Area }) => {
      const a = opts?.area ?? area;
      if (!matchId || !a || preparing) return;
      setPreparing(true);
      setPrepareError(null);
      try {
        await prepareNumberRace(matchId, a);
      } catch (e) {
        setPrepareError((e as { code?: string }).code ?? "server_error");
      } finally {
        setPreparing(false);
        race.refresh();
      }
    },
    [area, matchId, preparing, race],
  );
  // Right after Create: find the number straight away.
  const autoPrepared = useRef(false);
  useEffect(() => {
    if (prepare !== "1" || autoPrepared.current || !state || !area || !state.me.isHost || state.match.status !== "waiting") return;
    autoPrepared.current = true;
    void prepareNow();
  }, [prepare, state, area, prepareNow]);

  const status = state?.match.status;
  const racer = state?.me.assignment?.status === "racing";
  const walk = useNumberWalk({
    matchId,
    racing: Boolean(racer && (status === "countdown" || status === "active" || status === "verifying")),
    startsAt: state?.match.startsAt ?? null,
    course: state?.course ?? null,
    onServerProgress: race.refresh,
  });

  // The winner is celebrated once per match on this phone, however often it reconnects.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (status !== "completed" || !matchId) return;
    void ntStore.announced().then((set) => {
      if (set.has(matchId)) return;
      setCelebrate(true);
      void ntStore.markAnnounced(matchId);
    });
  }, [status, matchId]);

  const toastLayer = <Toasts toasts={toasts} top={insets.top + 110} />;

  if (!state) {
    const message = race.error ? numberErrorText(race.error) : race.noMatch ? null : "Opening the game";
    return (
      <View style={styles.centered}>
        {race.noMatch ? <NoMatch roomId={id ?? ""} onDone={race.refresh} /> : <Text style={styles.title}>{message}</Text>}
        {!race.error && !race.noMatch ? <IndeterminateTrail /> : null}
        {race.error ? <RaisedButton tone="white" label="Back" onPress={() => router.replace(ROUTES.nearby as never)} /> : null}
      </View>
    );
  }

  const screen = screenOf(state);
  if (screen === "cancelled") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>This race was cancelled</Text>
        <Text style={styles.line}>Nothing from it counts. Walks recorded for it were deleted.</Text>
        <RaisedButton tone="white" label="Back" onPress={() => router.replace((state.match.mode === "online" ? "/game/tournament?mode=online" : ROUTES.nearby) as never)} />
      </View>
    );
  }
  if (screen === "results") return <NtResults state={state} celebrate={celebrate} walkedM={walk.distanceM} onChanged={race.refresh} />;
  if ((screen === "live" || screen === "finish") && !racer) {
    return (
      <View style={[styles.spectate, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.title}>{state.me.assignment?.status === "left" ? "You left this race" : "A race is on"}</Text>
        <Text style={styles.line}>You'll see the results here when it ends.</Text>
        <View style={styles.list}>
          <RacePlayerList players={state.players.filter((p) => p.status)} me={state.me.userId} racing />
        </View>
        {toastLayer}
      </View>
    );
  }
  if (screen === "live" || screen === "finish") {
    return (
      <>
        <NtLive state={state} offsetMs={race.offsetMs} live={race.live} walk={walk} onChanged={race.refresh} />
        {toastLayer}
      </>
    );
  }
  // Online, before the countdown: search, match and check in, each on their own streets.
  if (state.match.mode === "online" && state.online && (screen === "lobby" || (screen === "reveal" && state.match.status === "ready"))) {
    return (
      <>
        <NtOnlineLobby state={state} live={race.live} onChanged={race.refresh} openInvite={invite === "1"} />
        {toastLayer}
      </>
    );
  }
  if (screen === "reveal" && state.course && state.match.number) {
    return (
      <>
        <NtReveal state={state} offsetMs={race.offsetMs} live={race.live} preparing={preparing} onRedraw={() => void prepareNow()} onChanged={race.refresh} />
        {toastLayer}
      </>
    );
  }
  return (
    <>
      <NtLobby
        state={state}
        online={race.online}
        live={race.live}
        area={area}
        preparing={preparing}
        prepareError={prepareError}
        onPrepare={(o) => void prepareNow(o)}
        onArea={setArea}
        onChanged={race.refresh}
        openInvite={invite === "1"}
      />
      {toastLayer}
    </>
  );
}

/** A room with no race yet (after one was cancelled or finished): the host starts another. */
const NoMatch = ({ roomId, onDone }: { roomId: string; onDone: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Text style={styles.title}>No race in this room yet</Text>
      <RaisedButton
        label="Start a new race"
        busy={busy}
        onPress={() => {
          setBusy(true);
          void playNumberRaceAgain(roomId, { minutes: 25, difficulty: null })
            .then(onDone)
            .catch((e) => setError(numberErrorText((e as { code?: string }).code)))
            .finally(() => setBusy(false));
        }}
      />
      {error ? <Text style={styles.line}>{error}</Text> : null}
    </>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl, backgroundColor: bg.canvas },
  spectate: { flex: 1, paddingHorizontal: layout.gutter, backgroundColor: bg.canvas },
  title: { fontSize: 24, lineHeight: 29, fontWeight: "800", color: text.primary, textAlign: "center" },
  line: { ...type.supporting, color: text.secondary, textAlign: "center" },
  list: { marginTop: space.xl },
});
