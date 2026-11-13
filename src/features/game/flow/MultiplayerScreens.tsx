import { useCallback, useState } from "react";
import { BackHandler, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckIcon, GlobeIcon, MapPinIcon, PawPrintIcon, PlusIcon, QrCodeIcon, ScanIcon, UsersIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { ModeIllustration } from "@/features/game/components/ModeIllustration";
import { accent, bg, border, pastel, radius, space, text, type } from "@/constants/design";
import { CameraStage, ChoiceRow, GameButton, GameCard, GameHeading, GameNote, GameScreen, ui } from "./GameFlowUI";
import { gameForMode, modeHome, modeLabel, parsePlayLocation, parsePlayMode, type PlayLocation } from "./gameFlow";

const DEMO_CODE = "PAWS24";
const PLAYER_COLORS = [pastel.butter, pastel.sky, pastel.mint, pastel.peach] as const;

export function MultiplayerHomeScreen({ tournament = false }: { tournament?: boolean }) {
  const [location, setLocation] = useState<PlayLocation>("together");
  const mode = tournament ? "tournament" : "duel";
  const openRoom = (action: "create" | "join") => router.push({ pathname: "/game/room", params: { mode, location, action } });

  return <GameScreen label="Play together" onBack={() => router.replace("/(tabs)/game")}
    footer={<>
      <GameButton label="Create a room" icon={<PlusIcon size={18} color={text.primary} />} onPress={() => openRoom("create")} />
      <GameButton label="Join a room" secondary onPress={() => openRoom("join")} />
    </>}>
    <View style={[styles.introCard, { backgroundColor: tournament ? pastel.mint : pastel.sky }]}>
      <View style={styles.introTop}>
        <View style={styles.introCopy}>
          <Text accessibilityRole="header" style={styles.introTitle}>{modeLabel(mode)}</Text>
          <Text style={styles.introDescription}>{tournament ? "Race to the target with a group." : "Follow the same cues, one on one."}</Text>
        </View>
        <View style={styles.introArt} accessible={false}><ModeIllustration mode={mode} width={112} /></View>
      </View>
      <View style={styles.chips}>
        <View style={styles.chip}><Text style={styles.chipText}>{tournament ? "Spot Sprint" : "PAWS Says"}</Text></View>
        <View style={styles.chip}><UsersIcon size={13} color={text.secondary} /><Text style={styles.chipText}>{tournament ? "Group play" : "2 players"}</Text></View>
      </View>
    </View>

    <View style={styles.block}>
      <Text style={ui.sectionTitle}>Where will you play?</Text>
      <View style={styles.locations} accessibilityRole="radiogroup" accessibilityLabel="Play location">
        {(["together", "remote"] as const).map(value => {
          const selected = location === value;
          return <PressScale key={value} accessibilityRole="radio"
            accessibilityLabel={value === "together" ? "Same place" : "Remote"}
            accessibilityState={{ checked: selected }} aria-checked={selected}
            onPress={() => setLocation(value)} style={[styles.location, selected && styles.locationSelected]}>
            <View style={styles.locationTop}>
              {value === "together" ? <MapPinIcon size={21} color={text.primary} /> : <GlobeIcon size={21} color={text.primary} />}
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <CheckIcon size={11} color={text.primary} weight="bold" /> : null}</View>
            </View>
            <Text style={ui.cardName}>{value === "together" ? "Same place" : "Remote"}</Text>
            <Text style={ui.small}>{value === "together" ? "Scan a room QR" : "Use a room code"}</Text>
          </PressScale>;
        })}
      </View>
    </View>
    <Text style={ui.caption}>One phone per dog. AI reviews each video after the round.</Text>
  </GameScreen>;
}

export function GameRoomScreen() {
  const params = useLocalSearchParams<{ mode?: string; location?: string; action?: string }>();
  const parsedMode = parsePlayMode(params.mode);
  const mode = parsedMode === "tournament" ? "tournament" : "duel";
  const location = parsePlayLocation(params.location);
  const join = params.action === "join";
  const [stage, setStage] = useState<"invite" | "lobby" | "choose">("invite");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [exampleGuests, setExampleGuests] = useState(false);
  const capacity = mode === "duel" ? 2 : 4;
  const playerCount = exampleGuests ? capacity : 1;
  const readyCount = (ready ? 1 : 0) + (exampleGuests ? capacity - 1 : 0);
  const game = gameForMode(mode)!;

  useFocusEffect(useCallback(() => {
    if (stage === "invite") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setStage(stage === "choose" ? "lobby" : "invite");
      return true;
    });
    return () => subscription.remove();
  }, [stage]));

  const back = () => {
    if (stage === "choose") setStage("lobby");
    else if (stage === "lobby") setStage("invite");
    else if (router.canGoBack()) router.back();
    else router.replace(modeHome(mode));
  };

  const joinPreview = () => {
    if (code.trim().toUpperCase() !== DEMO_CODE) {
      setError("This preview uses PAWS24. Try that room code.");
      return;
    }
    setError("");
    setStage("lobby");
  };

  if (stage === "choose") return <GameScreen key="choose" label={modeLabel(mode)} onBack={back}
    footer={<GameButton label="View rules" onPress={() => router.push({
      pathname: "/game/play/[gameId]", params: { gameId: game.id, mode, location },
    })} />}>
    <GameHeading title="Choose a game" description={mode === "duel" ? "One sequence for both players." : "One challenge for the whole room."} />
    <View style={styles.roomStrip}>
      <Text style={styles.roomStripCode}>{DEMO_CODE}</Text>
      <View style={styles.playerCount}><CheckIcon size={15} color={text.primary} /><Text style={ui.small}>{capacity} ready · demo</Text></View>
    </View>
    <GameCard game={game} selected />
    <View style={styles.rulesSummary}>
      <Text style={ui.cardName}>{mode === "duel" ? "Most completed commands wins" : "Fastest time wins"}</Text>
      <Text style={ui.caption}>{mode === "duel" ? "Both players receive the same cues." : "Match the target type and starting distance."}</Text>
    </View>
    <GameNote>Places are confirmed after all videos are reviewed.</GameNote>
  </GameScreen>;

  if (stage === "lobby") return <GameScreen key="lobby" label="Waiting room" onBack={back}
    footer={<>
      <View style={styles.readiness}><Text style={ui.small}>{readyCount} of {capacity} ready</Text><Text style={ui.small}>Demo room</Text></View>
      <GameButton label="Choose the game" disabled={!ready || !exampleGuests} onPress={() => setStage("choose")} />
    </>}>
    <GameHeading title="Players" description={modeLabel(mode) + " · " + (location === "remote" ? "Remote" : "Same place")} />
    <View style={styles.roomStrip}>
      <View style={styles.codeInline}><Text style={ui.small}>Code</Text><Text style={styles.roomStripCode}>{DEMO_CODE}</Text></View>
      <View style={styles.playerCount}><UsersIcon size={15} color={text.secondary} /><Text style={ui.small}>{playerCount} / {capacity}</Text></View>
    </View>

    <View style={styles.participants}>
      <Participant title="You & your dog" subtitle={join ? "Guest" : "Host"} ready={ready} index={0} />
      {exampleGuests
        ? Array.from({ length: capacity - 1 }, (_, index) => <Participant key={index} title={"Player " + (index + 2)} subtitle="Demo player" ready index={index + 1} />)
        : Array.from({ length: capacity - 1 }, (_, index) => <View key={index} style={styles.emptyPlayer}>
          <View style={styles.emptyAvatar}><PawPrintIcon size={20} color={text.tertiary} /></View>
          <Text style={ui.caption}>Waiting for player {index + 2}</Text>
        </View>)}
    </View>
    <View style={styles.lobbyControls}>
      <ChoiceRow title="My dog and I are ready" selected={ready} onPress={() => setReady(value => !value)} />
      <DemoAction label={exampleGuests ? "Reset demo players" : mode === "duel" ? "Add a demo opponent" : "Fill demo room"}
        onPress={() => setExampleGuests(value => !value)} />
      <Text style={[ui.small, ui.centerText]}>Demo players only. No phones connected.</Text>
    </View>
  </GameScreen>;

  return <GameScreen key="invite" label={modeLabel(mode)} onBack={back}
    footer={join ? <GameButton label="Join with code" onPress={joinPreview} />
      : <GameButton label="Open demo room" onPress={() => setStage("lobby")} />}>
    <GameHeading title={join ? "Join a room" : "Invite players"}
      description={join ? "Scan the host’s QR or enter a code."
        : location === "remote" ? "Share the room code with your group."
          : "Each player joins from their own phone."} />

    {join ? <>
      <View style={styles.scanner}>
        <CameraStage compact label="Scanner off · preview">
          <View style={styles.scanCenter}><ScanIcon size={58} color={text.secondary} weight="light" /><Text style={styles.scanText}>Room QR</Text></View>
        </CameraStage>
        <DemoAction label="Preview QR scan" onPress={() => { setCode(DEMO_CODE); setError(""); setStage("lobby"); }} />
      </View>
      <View style={styles.codeEntry}>
        <Text style={ui.cardName}>Room code</Text>
        <TextInput accessibilityLabel="Room code" placeholder={DEMO_CODE} placeholderTextColor={text.tertiary}
          value={code} onChangeText={value => { setCode(value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6)); setError(""); }}
          autoCapitalize="characters" autoCorrect={false} maxLength={6} returnKeyType="go" onSubmitEditing={joinPreview} style={styles.input} />
        <Text style={ui.small}>Try PAWS24 in this preview.</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </View>
    </> : <>
      <View style={styles.invitation}>
        <View style={styles.qr}><QrCodeIcon size={142} color={text.primary} weight="regular" /></View>
        <View style={styles.codeArea}>
          <Text style={ui.small}>Room code</Text>
          <Text accessibilityLabel={"Demo room code " + DEMO_CODE} style={styles.inviteCode}>{DEMO_CODE}</Text>
          <Text style={ui.small}>Sample QR · not scannable</Text>
        </View>
        <View style={styles.inviteMeta}>
          <View style={styles.chip}><UsersIcon size={14} color={text.secondary} /><Text style={styles.chipText}>{mode === "duel" ? "2 players" : "4-player demo"}</Text></View>
          <View style={styles.chip}>{location === "remote" ? <GlobeIcon size={14} color={text.secondary} /> : <MapPinIcon size={14} color={text.secondary} />}<Text style={styles.chipText}>{location === "remote" ? "Remote" : "Same place"}</Text></View>
        </View>
      </View>
      <GameNote>Live invites will be connected next.</GameNote>
    </>}
  </GameScreen>;
}

function DemoAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <PressScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.demoAction}>
    <Text style={styles.demoActionText}>{label}</Text>
  </PressScale>;
}

function Participant({ title, subtitle, ready, index }: { title: string; subtitle: string; ready: boolean; index: number }) {
  return <View style={[styles.participant, { backgroundColor: PLAYER_COLORS[index % PLAYER_COLORS.length] }]}>
    <View style={styles.avatar}><PawPrintIcon size={21} color={text.primary} weight="fill" /></View>
    <View style={ui.flex}><Text style={ui.cardName}>{title}</Text><Text style={ui.small}>{subtitle}</Text></View>
    <View style={styles.status}>
      {ready ? <View style={styles.readyCheck}><CheckIcon size={12} color={text.primary} weight="bold" /></View> : <View style={styles.waitingDot} />}
      <Text style={styles.statusText}>{ready ? "Ready" : "Not ready"}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  introCard: { borderRadius: 26, padding: space.lg, gap: space.lg },
  introTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  introCopy: { flex: 1, gap: 6 },
  introTitle: { ...type.sectionTitle, fontSize: 23, lineHeight: 27, letterSpacing: -0.4, color: text.primary },
  introDescription: { ...type.caption, fontSize: 13, lineHeight: 18, color: text.secondary },
  introArt: { height: 106, justifyContent: "center" },
  chips: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.7)", paddingVertical: 7, paddingHorizontal: 10 },
  chipText: { ...type.caption, fontWeight: "600", color: text.secondary },
  block: { gap: space.md },
  locations: { flexDirection: "row", gap: space.md },
  location: { flex: 1, gap: 6, borderWidth: 1.5, borderColor: "transparent", borderRadius: radius.card, backgroundColor: pastel.mist, padding: space.lg },
  locationSelected: { borderColor: "rgba(28,27,26,0.15)", backgroundColor: accent.primary },
  locationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  radio: { width: 17, height: 17, borderRadius: radius.pill, borderWidth: 1, borderColor: border.strong, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.45)" },
  radioSelected: { backgroundColor: accent.deep, borderColor: "transparent" },
  roomStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: 13, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: pastel.butter },
  codeInline: { flexDirection: "row", alignItems: "center", gap: space.md },
  roomStripCode: { ...type.cardTitle, letterSpacing: 1.1, color: text.primary, fontWeight: "600" },
  playerCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  participants: { gap: space.sm },
  participant: { flexDirection: "row", alignItems: "center", gap: 10, padding: space.md, borderRadius: radius.card, minHeight: 64 },
  avatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { ...type.caption, color: text.secondary, fontSize: 11 },
  readyCheck: { width: 18, height: 18, borderRadius: radius.pill, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  waitingDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: text.tertiary },
  emptyPlayer: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, borderRadius: radius.card, backgroundColor: bg.subtle, padding: space.md },
  emptyAvatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  readiness: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  lobbyControls: { gap: space.sm },
  rulesSummary: { gap: space.sm },
  scanner: { gap: space.md },
  scanCenter: { alignItems: "center", gap: space.md },
  scanText: { ...type.caption, color: text.secondary },
  codeEntry: { gap: 10 },
  input: { minHeight: 56, paddingHorizontal: space.lg, borderWidth: 1, borderColor: border.soft, borderRadius: radius.input, fontSize: 22, lineHeight: 30, letterSpacing: 3, color: text.primary, backgroundColor: bg.subtle },
  error: { ...type.supporting, color: "#A14937" },
  invitation: { alignItems: "center", gap: space.lg, padding: space.xxl, borderRadius: 26, backgroundColor: pastel.butter },
  qr: { width: 184, height: 184, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: bg.canvas },
  codeArea: { alignItems: "center", gap: 4 },
  inviteCode: { fontSize: 28, lineHeight: 35, letterSpacing: 2, fontWeight: "600", color: text.primary },
  inviteMeta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, flexWrap: "wrap" },
  demoAction: { alignSelf: "center", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: radius.pill, backgroundColor: pastel.mist, paddingHorizontal: space.lg, paddingVertical: space.sm },
  demoActionText: { ...type.caption, fontWeight: "600", color: text.secondary },
});
