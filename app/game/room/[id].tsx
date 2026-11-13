import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretRightIcon, CheckIcon, CrownSimpleIcon, GlobeHemisphereWestIcon, MapPinIcon, PlusIcon, ShareNetworkIcon, SignOutIcon, SpeakerHighIcon, SpeakerSlashIcon, TrophyIcon, VibrateIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { BattleScreen } from "@/features/rooms/components/BattleScreen";
import { InviteSheet } from "@/features/rooms/components/InviteSheet";
import { MafiaRound } from "@/features/rooms/components/MafiaRound";
import { NearbyGames } from "@/features/rooms/components/NearbyGames";
import { Pager, type PagerHandle } from "@/features/rooms/components/Pager";
import { OnlineGames } from "@/features/rooms/components/PlayStart";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { roomFeedback, useRoomPrefs } from "@/features/rooms/roomFeedback";
import { ROUTES, isBattle, roomView, startBlocker } from "@/features/rooms/lobbyRules";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import { useRoom } from "@/hooks/useRoom";
import { balanceTeams, cancelRoom, inviteLink, issueInvite, latestMatch, leaveRoom, removeMember, roadAreaFor, setBattleSettings, setReady, setRoomGame, startBattle, startRound, type Invite, type RoomGame, type RoomState } from "@/services/roomService";
import { createNumberMatch, createOnlineRace } from "@/services/numberRaceService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";


/**
 * A nearby room. Before a round: the lobby, the same for everyone because it comes from the server. During and after
 * a round: the game itself.
 */
export default function RoomScreen() {
  const { id, invite } = useLocalSearchParams<{ id?: string; invite?: string }>();
  const room = useRoom(id);
  const state = room.state;
  const code = (room.error as { code?: string } | null)?.code;
  const battleRoom = isBattle(state?.room.gameType);
  // A battle room's current match; reloaded whenever the room changes.
  const match = useQuery({
    queryKey: ["latestMatch", id, state?.room.version],
    queryFn: () => latestMatch(id ?? ""),
    enabled: Boolean(id && battleRoom && state && state.room.status !== "open"),
  });

  const home = (state?.room.playMode === "online" ? "/game/tournament?mode=online" : ROUTES.nearby) as never;
  const leave = () =>
    Alert.alert("Leave this room?", state?.me.isHost ? "The room passes to the next player. If nobody is left, it closes." : "You can rejoin with the code while it's open.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          if (!id) return;
          void leaveRoom(id).catch(() => undefined).finally(() => router.replace(home));
        },
      },
    ]);

  const view = roomView({
    hasState: Boolean(state),
    errorCode: code,
    game: state?.room.gameType,
    roomStatus: state?.room.status,
    match: match.data ?? null,
    mafiaRound: Boolean(state?.round && state.round.status !== "cancelled"),
  });

  // A Number Trail race under way has its own screens; everyone in the room moves there when it's made.
  if (state?.room.gameType === "number_trail" && state.numberMatch && id) return <Redirect href={{ pathname: "/game/number-trail/room/[id]", params: { id } }} />;

  if (!state || view === "loading" || view === "error") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{code ? roomErrorText(code) : "Opening the room"}</Text>
        {code ? <RaisedButton tone="white" label="Back" onPress={() => router.replace(home)} /> : null}
      </View>
    );
  }

  if (view === "battle" && match.data) {
    return <BattleScreen room={state} matchId={match.data.id} roomVersion={state.room.version} live={room.live} onLeave={leave} onChanged={room.refresh} />;
  }
  if (view === "mafia") return <MafiaRound state={state} offsetMs={room.offsetMs} onChanged={room.refresh} onLeave={leave} />;
  if (view === "closed") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>This room was closed</Text>
        <RaisedButton tone="white" label="Back" onPress={() => router.replace(home)} />
      </View>
    );
  }
  return <Lobby state={state} online={room.online} live={room.live} openInvite={invite === "1"} onChanged={room.refresh} onLeave={leave} />;
}


type Pending = Partial<{ gameType: RoomGame | null; ready: boolean }>;

const AVATAR_TINTS = ["#F6E7A8", "#DCEBE4", "#F3D9CF", "#E4E0F2", "#E9E4D4"];
const GAME_TITLE: Record<RoomGame, string> = { steal_territory: "Steal Your Territory", steal_road: "Steal Your Road", find_mafia: "Find the Mafia", number_trail: "Number Trail" };

/**
 * The room before a game: the invite and who's here on the first page, the games on the second (the host picks one
 * there). Teams and the road area are set up by themselves when the host starts. Sound and vibration are this phone's.
 */
const Lobby = ({ state, online, openInvite, onChanged, onLeave }: { state: RoomState; online: Set<string>; live: boolean; openInvite: boolean; onChanged: () => void; onLeave: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const pager = useRef<PagerHandle | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { prefs, set: setPrefs } = useRoomPrefs();
  const { me, members } = state;
  // Taps show at once; the server's answer replaces them (or a refusal puts them back).
  const [pending, setPending] = useState<Pending>({});
  const serverRoom = state.room;
  const mineServer = members.find((m) => m.userId === me.userId);
  useEffect(() => setPending({}), [serverRoom.version, mineServer?.ready]);
  const room = { ...serverRoom, gameType: pending.gameType !== undefined ? pending.gameType : serverRoom.gameType };
  const isOnline = serverRoom.playMode === "online";
  const mine = mineServer ? { ...mineServer, ready: pending.ready ?? mineServer.ready } : undefined;
  const setup = state.setup;
  const setupReady = Boolean(setup?.confirmed_safe && (setup?.checkpoints?.length ?? 0) >= 2);
  const battle = isBattle(room.gameType);
  const canStart = me.canStart ?? me.isHost;

  useEffect(() => {
    if (openInvite && me.isHost) setInviting(true);
  }, [openInvite, me.isHost]);

  // A small doorbell when someone new walks in (this phone's sound setting).
  const count = useRef(members.length);
  useEffect(() => {
    if (members.length > count.current) {
      roomFeedback.play("join");
      roomFeedback.tap();
    }
    count.current = members.length;
  }, [members.length]);

  const change = (patch: Pending, fn: () => Promise<unknown>) => {
    setPending((p) => ({ ...p, ...patch }));
    setError(null);
    roomFeedback.tap();
    fn()
      .then(onChanged)
      .catch((e) => {
        setPending((p) => {
          const next = { ...p };
          for (const k of Object.keys(patch) as (keyof Pending)[]) delete next[k];
          return next;
        });
        setError(roomErrorText((e as { code?: string }).code));
      });
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      roomFeedback.tap();
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const pick = (g: RoomGame) => {
    pager.current?.goTo(0);
    change({ gameType: g }, async () => {
      await setRoomGame(room.id, g);
      // Nearby Number Trail runs in its own screens: its race is set up as soon as it's picked.
      if (g === "number_trail") await createNumberMatch(room.id);
    });
  };

  const startNow = () =>
    void act(async () => {
      roomFeedback.play("start");
      if (room.gameType === "number_trail") {
        if (isOnline) await createOnlineRace(room.id, { number: null, category: serverRoom.ntCategory ?? "standard", ranked: serverRoom.ntRanked ?? true, countdownS: room.startDelayS });
        else await createNumberMatch(room.id);
        return;
      }
      if (battle) {
        // The roads around you and fair teams, set up at the moment of starting. Where no road area is published
        // nearby, the server builds one from the real streets here.
        if (room.gameType === "steal_road") {
          setPreparing(true);
          try {
            const access = await LocationTracking.requestAccess();
            const at = access === "granted" ? await LocationTracking.current() : null;
            if (!at) throw Object.assign(new Error("location_needed"), { code: "location_needed" });
            const area = await roadAreaFor(room.id, at);
            if (area.regionId !== room.regionId) await setBattleSettings(room.id, room.battleMinutes || 15, area.regionId);
          } finally {
            setPreparing(false);
          }
        }
        const blue = members.filter((m) => m.team === "blue").length;
        const orange = members.filter((m) => m.team === "orange").length;
        if (members.some((m) => !m.team) || Math.abs(blue - orange) > 1 || blue === 0 || orange === 0) await balanceTeams(room.id);
        await startBattle(room.id);
        return;
      }
      await startRound(room.id);
    });

  const blocker = startBlocker({ game: room.gameType, members, regionId: room.regionId, regionPublished: true, mafiaSetupReady: setupReady, autoSetup: true });
  const gameTitle = room.gameType ? GAME_TITLE[room.gameType] : null;
  // Find the Mafia needs the host's route before anything else: the main button goes straight there, and the route
  // can be set while players are still arriving.
  const needsRoute = me.isHost && room.gameType === "find_mafia" && !setupReady;

  const roomPage = (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 150 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {/* The invite: the host's QR (nearby) or the code, and this phone's sound and vibration. */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          {me.isHost && !isOnline ? <RoomQr roomId={room.id} onOpen={() => setInviting(true)} /> : null}
          <View style={styles.flexOnly}>
            <Text style={styles.codeLabel}>Code</Text>
            <Text style={styles.code} adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`Room code ${room.code.split("").join(" ")}`}>
              {room.code}
            </Text>
            <PressScale accessibilityRole="button" accessibilityLabel="Share the room" scaleTo={0.95} style={styles.share} onPress={() => setInviting(true)}>
              <ShareNetworkIcon size={16} color={text.primary} weight="bold" />
              <Text style={styles.shareText}>Share</Text>
            </PressScale>
          </View>
        </View>
        <View style={styles.prefs}>
          <PrefToggle on={prefs.sound} label="Sound effects" iconOn={<SpeakerHighIcon size={20} color={text.primary} weight="fill" />} iconOff={<SpeakerSlashIcon size={20} color="#B8B5AE" weight="fill" />} onChange={(v) => setPrefs({ sound: v })} />
          <PrefToggle on={prefs.vibration} label="Vibration" iconOn={<VibrateIcon size={20} color={text.primary} weight="fill" />} iconOff={<VibrateIcon size={20} color="#B8B5AE" weight="regular" />} onChange={(v) => setPrefs({ vibration: v })} />
        </View>
      </View>

      {/* Who's here. */}
      <View style={styles.sectionHead}>
        <Text style={styles.section}>Players</Text>
        <View style={styles.countChip}>
          <Text style={styles.countText}>{members.length}</Text>
        </View>
      </View>
      <View style={styles.players}>
        {members.map((m, i) => {
          const ready = m.ready || m.isHost;
          return (
            <Animated.View key={m.userId} entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.duration(200).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })} exiting={FadeOut.duration(150)}>
              <PressScale
                accessibilityRole={me.isHost && !m.isHost ? "button" : undefined}
                accessibilityLabel={`${m.name}${m.userId === me.userId ? ", you" : ""}${m.isHost ? ", host" : ""}. ${ready ? "Ready" : "Not ready"}. ${m.score ?? 0} wins${me.isHost && !m.isHost ? ". Long press to remove" : ""}`}
                disabled={!me.isHost || m.isHost}
                scaleTo={0.98}
                onLongPress={() => Alert.alert(`Remove ${m.name}?`, "They won't be able to rejoin this room.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void act(() => removeMember(room.id, m.userId)) }])}
                style={styles.player}
              >
                <View style={[styles.avatar, { backgroundColor: AVATAR_TINTS[i % AVATAR_TINTS.length] }]}>
                  <Text style={styles.avatarText}>{m.name.slice(0, 1).toUpperCase()}</Text>
                  <View style={[styles.presence, online.has(m.userId) && styles.presenceOn]} />
                </View>
                <View style={styles.flexOnly}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {m.isHost ? <CrownSimpleIcon size={15} color={accent.band} weight="fill" /> : null}
                    {m.userId === me.userId ? (
                      <View style={styles.youTag}>
                        <Text style={styles.youText}>You</Text>
                      </View>
                    ) : null}
                  </View>
                  {(m.score ?? 0) > 0 ? (
                    <View style={styles.wins}>
                      <TrophyIcon size={12} color={text.tertiary} weight="fill" />
                      <Text style={styles.winsText}>{m.score}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.ready, ready && styles.readyOn]}>
                  {ready ? (
                    <Animated.View entering={reduceMotion ? FadeIn.duration(150) : ZoomIn.duration(160).withInitialValues({ transform: [{ scale: 0.9 }] })}>
                      <CheckIcon size={15} color="#FFFFFF" weight="bold" />
                    </Animated.View>
                  ) : null}
                </View>
              </PressScale>
            </Animated.View>
          );
        })}
      </View>

      {/* The route, once set (until then the main button sets it). */}
      {room.gameType === "find_mafia" && me.isHost && setupReady ? (
        <PressScale accessibilityRole="button" accessibilityLabel={`Route with ${setup!.checkpoints.length} stops. Change it`} style={[styles.setup, styles.setupDone]} onPress={() => router.push({ pathname: "/game/room/mafia-setup", params: { id: room.id } })}>
          <MapPinIcon size={20} color={text.primary} weight="fill" />
          <Text style={styles.setupTitle}>{`Route, ${setup!.checkpoints.length} stops`}</Text>
          <Text style={styles.setupEdit}>Change</Text>
          <CaretRightIcon size={16} color={text.secondary} weight="bold" />
        </PressScale>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {me.isHost ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Close the room"
          style={styles.textButton}
          onPress={() => Alert.alert("Close this room?", "Everyone in it will be sent back.", [{ text: "Keep it", style: "cancel" }, { text: "Close room", style: "destructive", onPress: () => void act(() => cancelRoom(room.id)) }])}
        >
          <Text style={styles.cancelText}>Close room</Text>
        </PressScale>
      ) : null}
    </ScrollView>
  );

  const gamesPage = isOnline ? (
    <OnlineGames key="games" inRoom heading={null} topInset={space.sm} bottomInset={150 + insets.bottom} />
  ) : (
    <NearbyGames key="games" selected={room.gameType} players={members.length} busy={busy} onPick={me.isHost ? pick : undefined} topInset={space.sm} bottomInset={150 + insets.bottom} />
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.modeChip}>
          {isOnline ? <GlobeHemisphereWestIcon size={14} color={text.primary} weight="bold" /> : <MapPinIcon size={14} color={text.primary} weight="bold" />}
          <Text style={styles.modeText}>{isOnline ? "Online room" : "Nearby room"}</Text>
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Leave the room" scaleTo={0.95} style={styles.leave} onPress={onLeave}>
          <SignOutIcon size={16} color={text.inverse} weight="bold" />
          <Text style={styles.leaveText}>Leave</Text>
        </PressScale>
      </View>

      <Pager ref={pager} labels={["Room", "Games"]} tabs pages={[roomPage, gamesPage]} />

      {/* The picked game rides with the start button, so what starts is never in doubt. */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <PressScale accessibilityRole="button" accessibilityLabel={gameTitle ? `Game: ${gameTitle}. See the games` : "Pick a game"} scaleTo={0.94} style={[styles.thumb, !room.gameType && styles.thumbEmpty]} onPress={() => pager.current?.goTo(1)}>
          {room.gameType ? (
            <Animated.View key={room.gameType} entering={reduceMotion ? FadeIn.duration(160) : ZoomIn.duration(180).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.9 }] })}>
              <TournamentArt game={room.gameType} width={56} height={56} />
            </Animated.View>
          ) : (
            <PlusIcon size={22} color={text.secondary} weight="bold" />
          )}
        </PressScale>
        <View style={styles.flexOnly}>
          {needsRoute ? (
            <RaisedButton label="Set the route" sub={blocker && blocker !== "Set the checkpoints first" ? blocker : "Find the Mafia"} onPress={() => router.push({ pathname: "/game/room/mafia-setup", params: { id: room.id } })} />
          ) : canStart ? (
            <RaisedButton label="Start" sub={preparing ? "Finding the roads around you" : blocker ?? gameTitle ?? undefined} disabled={Boolean(blocker)} busy={busy} onPress={startNow} />
          ) : (
            <RaisedButton
              tone={mine?.ready ? "white" : "yellow"}
              label={mine?.ready ? "Ready" : "I'm ready"}
              sub={gameTitle ?? "The host picks the game"}
              onPress={() => change({ ready: !mine?.ready }, () => setReady(room.id, !mine?.ready))}
            />
          )}
        </View>
      </View>

      <InviteSheet visible={inviting} roomId={room.id} code={room.code} isHost={me.isHost} onClose={() => setInviting(false)} />
    </View>
  );
};

/** The host's fresh QR. Tap for the larger code and share. */
const RoomQr = ({ roomId, onOpen }: { roomId: string; onOpen: () => void }) => {
  const [invite, setInvite] = useState<Invite | null>(null);
  useEffect(() => {
    let alive = true;
    issueInvite(roomId)
      .then((i) => alive && setInvite(i))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [roomId]);
  return (
    <PressScale accessibilityRole="button" accessibilityLabel="Room QR. Show it larger" scaleTo={0.96} style={styles.qr} onPress={onOpen}>
      {invite ? <QRCode value={inviteLink(invite.token)} size={104} backgroundColor="#FFFFFF" color="#1C1B1A" /> : <View style={styles.qrWait} />}
    </PressScale>
  );
};

/** A phone setting as one icon pill: bright when on, dim and crossed when off. */
const PrefToggle = ({ on, label, iconOn, iconOff, onChange }: { on: boolean; label: string; iconOn: React.ReactNode; iconOff: React.ReactNode; onChange: (v: boolean) => void }) => (
  <PressScale accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} scaleTo={0.94} style={[styles.pref, on && styles.prefOn]} onPress={() => onChange(!on)}>
    {on ? iconOn : iconOff}
    <Text style={[styles.prefText, on && styles.prefTextOn]}>{label}</Text>
  </PressScale>
);

const styles = StyleSheet.create({
  flexOnly: { flex: 1 },
  screen: { flex: 1, backgroundColor: bg.canvas },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl, backgroundColor: bg.canvas },
  title: { fontSize: 24, lineHeight: 29, fontWeight: "800", color: text.primary, textAlign: "center" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter, paddingBottom: space.md },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  modeText: { fontSize: 14, fontWeight: "800", color: text.primary },
  leave: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: text.primary },
  leaveText: { fontSize: 14, fontWeight: "800", color: text.inverse },
  page: { paddingHorizontal: layout.gutter, paddingTop: space.md },
  hero: { borderRadius: 28, backgroundColor: text.primary, padding: space.xl, gap: space.xl },
  heroRow: { flexDirection: "row", alignItems: "center", gap: space.xl },
  qr: { width: 120, height: 120, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  qrWait: { width: 104, height: 104, borderRadius: 12, backgroundColor: "#F1F0EC" },
  codeLabel: { fontSize: 13, fontWeight: "700", color: "#A9A59B" },
  code: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: 3, color: "#FFFFFF", fontVariant: ["tabular-nums"], marginTop: 2 },
  share: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: accent.deep, marginTop: space.md },
  shareText: { fontSize: 14, fontWeight: "800", color: text.primary },
  prefs: { flexDirection: "row", gap: space.sm },
  pref: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.08)" },
  prefOn: { backgroundColor: "#FFFFFF" },
  prefText: { fontSize: 14, fontWeight: "800", color: "#B8B5AE" },
  prefTextOn: { color: text.primary },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.section, marginBottom: space.md },
  section: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.6, color: text.primary },
  countChip: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 14, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  players: { gap: space.sm },
  player: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 22, backgroundColor: bg.subtle },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 19, fontWeight: "800", color: text.primary },
  presence: { position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: border.default, borderWidth: 2.5, borderColor: bg.subtle },
  presenceOn: { backgroundColor: "#2F8F4E" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2, color: text.primary, flexShrink: 1 },
  youTag: { height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: "#FFFFFF", justifyContent: "center" },
  youText: { fontSize: 11, fontWeight: "800", color: text.secondary },
  wins: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  winsText: { fontSize: 12, fontWeight: "800", color: text.tertiary, fontVariant: ["tabular-nums"] },
  ready: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: border.default, alignItems: "center", justifyContent: "center" },
  readyOn: { borderColor: "#2F8F4E", backgroundColor: "#2F8F4E" },
  setup: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, height: 56, paddingHorizontal: space.lg, borderRadius: 22, backgroundColor: accent.soft, borderWidth: 2, borderColor: accent.band },
  setupDone: { backgroundColor: bg.subtle, borderColor: bg.subtle },
  setupTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: text.primary },
  setupEdit: { fontSize: 14, fontWeight: "800", color: text.secondary },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  textButton: { alignSelf: "center", paddingVertical: space.sm, paddingHorizontal: space.lg, marginTop: space.lg },
  cancelText: { ...type.supporting, fontWeight: "700", color: "#B4442C" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  thumb: { width: 60, height: 60, borderRadius: 18, overflow: "hidden", backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  thumbEmpty: { borderWidth: 2, borderStyle: "dashed", borderColor: border.strong, backgroundColor: bg.canvas },
});
