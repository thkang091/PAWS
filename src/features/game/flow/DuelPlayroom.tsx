import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useIsFocused, usePreventRemove } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRightIcon, CheckIcon, MagnifyingGlassIcon, PawPrintIcon, PlusIcon, QrCodeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { ProfileDog } from "@/features/profile/components/ProfileDog";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, layout, pastel, radius, scene, space, text, type } from "@/constants/design";
import { GameButton, GameHeading, GameScreen, ui } from "./GameFlowUI";
import { GameSelectionPanel, JoinGamePanel, RoomInvitePanel } from "./DuelLobbyPanels";
import { PlayroomSheet } from "./PlayroomSheet";
import { DuelQrScanner } from "./DuelQrScanner";
import { useDuelRoom } from "./useDuelRoom";
import { normalizeDuelCode } from "./duelRoomApi";
import { gameForMode, parsePlayLocation, type PlayLocation } from "./gameFlow";
import { areDuelPlayersReady, canReadyDuel, canStartDuel, type DuelRoomState } from "./duelRoomState";

type Sheet = "leave" | null;
const GAME = gameForMode("duel")!;
// Preserve the accepted lower action position, independently of development tools.
const ACTION_BOTTOM_CLEARANCE = 100;

export function DuelPlayroom() {
  const params = useLocalSearchParams<{ action?: string; location?: string }>();
  const isFocused = useIsFocused();
  const dog = useCurrentDog();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const room = useDuelRoom();
  const [location, setLocation] = useState(() => parsePlayLocation(params.location));
  const state = room.snapshot ? room.state : { ...room.state, location };
  const [joinRequested, setJoining] = useState(() => parsePlayLocation(params.location) === "together" && params.action === "join");
  const joining = joinRequested && !state.room;
  const [frameHeight, setFrameHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [participantHeight, setParticipantHeight] = useState(0);
  const [roomDetailsHeight, setRoomDetailsHeight] = useState(0);
  const [inviteChromeHeight, setInviteChromeHeight] = useState(80);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState("");
  const error = formError || room.error || "";
  const [scanning, setScanning] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [matchUnavailable, setMatchUnavailable] = useState(false);
  const [returningToRoom, setReturningToRoom] = useState(false);
  const launched = useRef(false);
  const initialCreate = useRef(false);
  const busy = room.busy || room.restoring;
  const changingRoom = room.operation === "create" || room.operation === "join";
  const usableHeight = height - insets.top - insets.bottom;
  const compact = usableHeight < 740 || fontScale > 1.3;
  const choosingGame = areDuelPlayersReady(state);
  const hasRoomDetails = state.connection === "reconnecting" || !!error;
  // The room has a shorter footer than the entry screen. Its first render must
  // not size the invite using the entry ScrollView's previous onLayout value.
  const roomButtonHeight = Math.max(layout.controlHeight, Math.ceil(type.cardTitle.lineHeight * fontScale) + space.md * 2);
  const roomDockHeight = space.md + roomButtonHeight + insets.bottom + space.xxl + space.xl;
  const roomViewportHeight = Math.max(0, (frameHeight || height - insets.top - space.sm * 2 - layout.iconButton) - roomDockHeight);
  const inviteAvailableHeight = roomViewportHeight && participantHeight
    ? Math.floor(roomViewportHeight - participantHeight - space.sm * 2 - (hasRoomDetails ? roomDetailsHeight + space.md : 0))
    : 0;
  const compactInvite = width >= 360 && fontScale <= 1.3 && inviteAvailableHeight > 0 && inviteAvailableHeight < inviteChromeHeight + 112;
  const qrSize = compactInvite ? 112 : inviteAvailableHeight
    ? Math.min(176, Math.max(112, inviteAvailableHeight - inviteChromeHeight))
    : 156;
  const needsScroll = viewportHeight > 0 && contentHeight > viewportHeight + 1;

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  useEffect(() => {
    // A host closure or expired room can arrive while the leave sheet is open.
    if (!state.room && !busy && sheet === "leave") closeSheet();
  }, [state.room, busy, sheet, closeSheet]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const cancelJoin = useCallback(() => {
    Keyboard.dismiss(); setJoining(false); setCode(""); setFormError(""); room.clearError();
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [room.clearError]);
  const back = useCallback(() => {
    if (busy && (!!state.room || changingRoom)) return;
    if (scanning) setScanning(false);
    else if (sheet) closeSheet();
    else if (joining) cancelJoin();
    else if (state.room) { Keyboard.dismiss(); setSheet("leave"); }
    else router.dismissTo("/(tabs)/game");
  }, [busy, changingRoom, scanning, sheet, joining, cancelJoin, state.room, closeSheet]);

  // Join and the room are inline steps within this route. A native back gesture
  // must consume that step just like the header button, not remove the route.
  // Play/review screens own their exit flow while this lobby is unfocused.
  usePreventRemove(isFocused && (!!state.room || joining || scanning || !!sheet || changingRoom), () => {
    back();
  });

  // Only returning from the game resets the start latch; inline lobby UI changes do not.
  const returnToRoom = useCallback(async () => {
    setReturningToRoom(true);
    if (await room.resetRound()) setReturningToRoom(false);
  }, [room.resetRound]);
  useFocusEffect(useCallback(() => {
    if (launched.current) void returnToRoom();
  }, [returnToRoom]));
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => subscription.remove();
  }, [back]));

  const createRoom = async () => {
    if (state.location === "remote" || busy) return;
    if (state.room) { scroll.current?.scrollTo({ y: 0, animated: false }); return; }
    if (!dog.data) { setFormError("Add your dog’s profile before creating a game."); return; }
    setFormError(""); Keyboard.dismiss();
    if (!await room.create(dog.data.id)) return;
    setJoining(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const leave = async () => {
    if (busy) return;
    if (!await room.leave()) return;
    Keyboard.dismiss(); launched.current = false;
    setSheet(null); setJoining(false); setScanning(false); setCode(""); setFormError(""); setLocation("together");
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const join = async (value = code) => {
    if (state.location === "remote" || busy) return;
    const normalized = normalizeDuelCode(value);
    if (!normalized) { setFormError("Enter a 6-character game code."); scroll.current?.scrollTo({ y: 0, animated: false }); return; }
    if (!dog.data) { setFormError("Add your dog’s profile before joining a game."); return; }
    Keyboard.dismiss(); setFormError(""); setCode(normalized);
    if (!await room.join(normalized, dog.data.id)) return;
    setJoining(false); setScanning(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (!state.starting) { launched.current = false; setReturningToRoom(false); return; }
    if (!isFocused || launched.current || sheet) return;
    launched.current = true;
    router.push({ pathname: "/game/play/[gameId]", params: { gameId: GAME.id, mode: "duel", location: "together" } });
  }, [state.starting, isFocused, sheet]);

  useEffect(() => {
    if (params.action !== "create" || state.location !== "together" || busy || dog.isLoading || initialCreate.current) return;
    initialCreate.current = true;
    if (!state.room) void createRoom();
  }, [params.action, busy, dog.isLoading, state.location, state.room]);
  const reconnecting = state.connection === "reconnecting";
  const remote = state.location === "remote";
  const findMatch = () => setMatchUnavailable(true);
  const selfName = room.snapshot?.players.find(player => player.userId === room.snapshot?.meUserId)?.name || dog.data?.name || "Your dog";
  const openJoin = () => { setFormError(""); room.clearError(); setJoining(true); scroll.current?.scrollTo({ y: 0, animated: false }); };

  return <GameScreen label={joining ? "Join game" : undefined} onBack={back} scrollable={false} liveRooms>
    <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === "ios" ? "padding" : "height"}
      onLayout={event => setFrameHeight(Math.round(event.nativeEvent.layout.height))}
      keyboardVerticalOffset={insets.top + space.sm * 2 + layout.iconButton}>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.scrollContent}
        onLayout={event => setViewportHeight(Math.round(event.nativeEvent.layout.height))}
        onContentSizeChange={(_, measuredHeight) => setContentHeight(Math.round(measuredHeight))}
        scrollEnabled={needsScroll} bounces={false} alwaysBounceVertical={false} overScrollMode="never"
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        testID="duel-lobby-scroll">
        <View style={[styles.participantHeader, (joining || (keyboardVisible && !state.room)) && styles.keyboardHidden]}
          onLayout={event => {
            const measured = Math.round(event.nativeEvent.layout.height);
            if (measured > 0) setParticipantHeight(measured);
          }} testID="duel-participant-header">
          <View testID="duel-entry-heading">
            <GameHeading title={state.room ? choosingGame ? "Game lobby" : "Your room" : "Play together"}
              description={state.room ? choosingGame ? "You’re both ready. Pick a game." : "Invite a friend. Play together." : "Side by side. Or find a match."} />
          </View>
          <View style={[styles.players, { paddingTop: Math.min(48, Math.max(16, (usableHeight - 600) * 0.18)) }]}>
            <ParticipantSpot name={selfName} subtitle={selfName === "Your dog" ? "You" : "Your dog"}
              ready={state.room ? state.selfReady : undefined}
              onUnready={state.selfReady && !state.starting && !busy ? () => void room.ready(false) : undefined} />
            <View style={styles.paws} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {[0, 1, 2].map(index => <View key={index} style={{ marginTop: index % 2 ? 9 : 0, transform: [{ rotate: "22deg" }] }}>
                <PawPrintIcon size={13} color={scene.sage} weight="fill" />
              </View>)}
            </View>
            <ParticipantSpot friend name={state.friend?.name ?? (remote ? "Opponent" : "Your friend")}
              subtitle={state.friend?.ownerLabel ?? (state.friend ? "Your friend" : remote ? "Matchmaking" : state.room ? "Waiting for a friend" : "Empty spot")}
              empty={!state.friend} ready={state.friend ? state.friend.ready : undefined}
              reconnecting={reconnecting} matchmaking={remote}
              emptyActionLabel={remote ? "Find a match" : state.room ? "Show game code" : "Create game"}
              onEmptyPress={!state.friend ? remote ? findMatch : createRoom : undefined} />
          </View>
        </View>

        <View style={[styles.middle, !state.room && !joining && styles.entryMiddle,
          state.room && styles.roomMiddle, joining && styles.joinMiddle]} testID="duel-lobby-middle">
          {joining ? <JoinGamePanel code={code} error={error} busy={busy} onScan={() => { setFormError(""); room.clearError(); setScanning(true); }}
            onCodeChange={value => { setCode(value); setFormError(""); room.clearError(); }} onSubmit={() => void join()} />
            : state.room ? choosingGame ? <GameSelectionPanel state={state}
              busy={busy || state.starting} onChoose={() => void room.select()} /> : <>
              {!remote ? <View onLayout={event => {
                // Keep the stacked measurement stable when switching to the compact row.
                if (!compactInvite) setInviteChromeHeight(Math.round(event.nativeEvent.layout.height - qrSize));
              }}>
                <RoomInvitePanel code={state.room.code} qrSize={qrSize} compact={compactInvite} />
              </View> : null}
              {hasRoomDetails ? <View style={styles.roomDetails} onLayout={event => setRoomDetailsHeight(Math.round(event.nativeEvent.layout.height))}>
                {reconnecting ? <View style={styles.reconnect} accessibilityLiveRegion="polite">
                <Text style={ui.cardName}>Reconnecting…</Text>
                <Text style={ui.caption}>Ready status cleared. Waiting for the connection.</Text>
                </View> : null}
                {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
              </View> : null}
            </> : <LocationControl value={state.location} onChange={location => {
              if (busy) return;
              setLocation(location); setMatchUnavailable(false); setFormError(""); room.clearError();
            }} />}
          {choosingGame && error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.actionDock, (state.room || joining) && styles.roomActionDock,
        { paddingBottom: insets.bottom + (state.room ? space.xxl + space.xl : joining || compact || keyboardVisible ? space.xxl : ACTION_BOTTOM_CLEARANCE) }]} testID="duel-action-dock">
        <View style={state.room || joining ? styles.roomActionStack : styles.actionStack}>
          {joining ?
            <GameButton label={room.operation === "join" ? "Joining game…" : "Join game"} disabled={busy || dog.isLoading}
              onPress={() => void join()} icon={<ArrowRightIcon size={20} color={text.primary} />} />
          : state.room ? returningToRoom ? <GameButton label={busy ? "Returning to room…" : "Return to room"}
              disabled={busy} onPress={() => void returnToRoom()} />
            : <ReadyActionBar state={state} busy={busy} onReady={ready => void room.ready(ready)} onStart={() => void room.start()}
              onRetry={() => void room.retry()} />
            : remote ? <>
              <GameButton label="Find a match" onPress={findMatch} icon={<MagnifyingGlassIcon size={20} color={text.primary} />} />
              {matchUnavailable ? <Text accessibilityLiveRegion="polite" style={styles.matchNotice}>Matchmaking isn’t connected yet.</Text> : null}
            </> : <>
              {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
              <GameButton label={room.operation === "create" ? "Creating game…" : room.restoring ? "Connecting…" : "Create game"}
                disabled={busy || dog.isLoading} onPress={() => void createRoom()} icon={<ArrowRightIcon size={20} color={text.primary} />} />
              <GameButton label="Join game" secondary disabled={busy || dog.isLoading} onPress={openJoin} icon={<QrCodeIcon size={20} color={text.primary} />} />
            </>}
        </View>
      </View>
    </KeyboardAvoidingView>

    <PlayroomSheet visible={sheet === "leave"} rise title="Leave game?" onClose={() => { if (!busy) closeSheet(); }}>
      <Text style={ui.body}>{state.room?.role === "host" ? "Leaving closes this room for both players." : "Leave this room and clear your ready status?"}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
      <GameButton label="Stay in game" disabled={busy} onPress={closeSheet} />
      <GameButton label={room.operation === "leave" ? "Leaving…" : "Leave game"} secondary disabled={busy} onPress={() => void leave()} />
    </PlayroomSheet>
    <DuelQrScanner visible={scanning} busy={busy} error={error}
      onClose={() => { if (!busy) setScanning(false); }} onScan={join} />
  </GameScreen>;
}

function ParticipantSpot({ name, subtitle, friend = false, empty = false, ready, reconnecting = false, matchmaking = false, emptyActionLabel, onEmptyPress, onUnready }: {
  name: string; subtitle: string; friend?: boolean; empty?: boolean; ready?: boolean | null; reconnecting?: boolean;
  matchmaking?: boolean; emptyActionLabel?: string; onEmptyPress?: () => void; onUnready?: () => void;
}) {
  return <View style={styles.participant} testID={friend ? "duel-friend-spot" : "duel-self-spot"}>
    <View style={styles.dogStage}>
      <View style={[styles.ground, friend && styles.friendGround]} />
      {empty ? <PressScale accessibilityRole="button" accessibilityLabel={emptyActionLabel} onPress={onEmptyPress} style={styles.emptySpot}>
        {matchmaking ? <MagnifyingGlassIcon size={27} weight="light" color={text.secondary} /> : <PlusIcon size={27} weight="light" color={text.secondary} />}
      </PressScale> : <View accessible={false} style={friend ? styles.friendDrawing : undefined}><ProfileDog width={88} /></View>}
    </View>
    <Text accessibilityLabel={name} style={styles.dogName} numberOfLines={2}>{name}</Text>
    <Text style={styles.owner} numberOfLines={2}>{subtitle}</Text>
    <View style={styles.statusSpace} accessibilityLiveRegion="polite">
      {onUnready ? <PressScale accessibilityRole="button" accessibilityLabel="Not ready yet" accessibilityHint="Cancel your ready status"
        onPress={onUnready} style={styles.readyChipAction}>
        <View style={[styles.readyChip, styles.readyChipOn]}><CheckIcon size={13} color={text.primary} /><Text style={styles.readyText}>Ready</Text></View>
      </PressScale> : ready !== undefined && ready !== null ? <View style={[styles.readyChip, ready && !reconnecting && styles.readyChipOn]}>
        {ready && !reconnecting ? <CheckIcon size={13} color={text.primary} /> : null}
        <Text style={styles.readyText}>{reconnecting ? "Reconnecting…" : ready ? "Ready" : "Not ready"}</Text>
      </View> : null}
    </View>
  </View>;
}

function LocationControl({ value, onChange }: { value: PlayLocation; onChange: (location: PlayLocation) => void }) {
  return <View style={styles.locationControl} accessibilityRole="radiogroup" accessibilityLabel="Play location">
    {(["together", "remote"] as const).map(location => <PressScale key={location} accessibilityRole="radio"
      accessibilityLabel={location === "together" ? "Same place" : "Remote"} accessibilityState={{ checked: value === location }} aria-checked={value === location}
      onPress={() => onChange(location)} style={[styles.location, value === location && styles.locationOn]}>
      <Text style={styles.locationText}>{location === "together" ? "Same place" : "Remote"}</Text>
    </PressScale>)}
  </View>;
}

function ReadyActionBar({ state, busy, onReady, onStart, onRetry }: {
  state: DuelRoomState; busy: boolean; onReady: (ready: boolean) => void; onStart: () => void; onRetry: () => void;
}) {
  if (state.connection === "reconnecting") return <GameButton label="Try again" disabled={busy} onPress={onRetry} />;
  if (areDuelPlayersReady(state)) return <GameButton label={state.starting ? "Starting…" : state.room?.role === "guest" ? "Waiting for host" : "Start"}
    disabled={busy || !canStartDuel(state)} onPress={onStart} icon={<ArrowRightIcon size={20} color={text.primary} />} />;
  return <GameButton label={state.selfReady ? "Ready" : "I’m ready"} secondary={state.selfReady}
    disabled={busy || !canReadyDuel(state)} onPress={() => onReady(!state.selfReady)}
    icon={state.selfReady ? <CheckIcon size={20} color={text.primary} /> : <ArrowRightIcon size={20} color={text.primary} />} />;
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1 },
  participantHeader: { backgroundColor: bg.canvas, paddingHorizontal: layout.gutter, paddingTop: space.lg },
  keyboardHidden: { display: "none" },
  middle: { flexGrow: 1, gap: space.lg, paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.xxl },
  entryMiddle: { justifyContent: "flex-end" },
  roomMiddle: { gap: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  joinMiddle: { paddingTop: space.xxl, paddingBottom: space.lg },
  roomDetails: { gap: space.sm },
  actionDock: { paddingHorizontal: layout.gutter, paddingTop: space.xl, backgroundColor: bg.canvas },
  roomActionDock: { paddingTop: space.md },
  roomActionStack: { minHeight: layout.controlHeight },
  actionStack: { minHeight: layout.controlHeight * 2 + space.md, gap: space.md },
  players: { flexDirection: "row", alignItems: "flex-start", paddingBottom: space.md },
  participant: { flex: 1, minWidth: 0, alignItems: "center" },
  dogStage: { height: 108, width: "100%", alignItems: "center", justifyContent: "flex-end", paddingBottom: 9 },
  ground: { position: "absolute", bottom: 4, width: "90%", maxWidth: 116, height: 20, borderRadius: radius.pill, backgroundColor: accent.soft },
  friendGround: { backgroundColor: pastel.pistachio },
  friendDrawing: { transform: [{ scaleX: -1 }] },
  emptySpot: { width: 80, height: 80, borderWidth: 1.5, borderStyle: "dashed", borderColor: scene.sage, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: bg.canvas },
  dogName: { ...type.cardTitle, fontWeight: "600", color: text.primary, textAlign: "center", marginTop: space.md, minHeight: type.cardTitle.lineHeight, width: "100%" },
  owner: { ...type.supporting, color: text.secondary, textAlign: "center", minHeight: type.supporting.lineHeight, width: "100%" },
  statusSpace: { minHeight: layout.iconButton, marginTop: space.sm, alignItems: "center", justifyContent: "flex-start", width: "100%" },
  readyChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: border.default, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, maxWidth: "100%" },
  readyChipAction: { minHeight: layout.iconButton, minWidth: layout.iconButton, alignItems: "center" },
  readyChipOn: { backgroundColor: pastel.pistachio, borderColor: pastel.pistachio },
  readyText: { ...type.caption, color: text.secondary, flexShrink: 1, textAlign: "center" },
  paws: { width: 62, height: 108, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  locationControl: { flexDirection: "row", backgroundColor: bg.subtle, borderRadius: radius.pill, padding: 3 },
  location: { flex: 1, minHeight: 44, paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  locationOn: { backgroundColor: accent.deep },
  locationText: { ...type.supporting, color: text.primary, fontWeight: "600", textAlign: "center" },
  matchNotice: { ...type.supporting, color: text.secondary, textAlign: "center", paddingHorizontal: space.sm },
  reconnect: { gap: space.md },
  inlineError: { ...type.supporting, color: "#A14937" },
});
