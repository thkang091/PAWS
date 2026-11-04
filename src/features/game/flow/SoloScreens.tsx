import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckIcon, TimerIcon } from "phosphor-react-native";
import { accent, pastel, radius, space, text, type } from "@/constants/design";
import { SOLO_GAMES, gameForMode, modeLabel, parsePlayLocation, parsePlayMode } from "./gameFlow";
import { CameraStage, ChoiceRow, GameArt, GameButton, GameCard, GameGlyph, GameHeading, GameNote, GameScreen, MissingGame, gameTint, ui } from "./GameFlowUI";

export function useGameFlowParams() {
  const params = useLocalSearchParams<{ gameId?: string; mode?: string; location?: string; target?: string; elapsed?: string; outcome?: string }>();
  const mode = parsePlayMode(params.mode);
  const location = parsePlayLocation(params.location);
  const game = gameForMode(mode, params.gameId);
  return { params, mode, location, game, routeParams: { gameId: game?.id ?? "", mode, location, target: params.target === "platform" ? "platform" : "mat" } };
}

export function SoloGamesScreen() {
  return <GameScreen label="Solo" onBack={() => router.replace("/(tabs)/game")}>
    <GameHeading title="Solo games" description="Choose a game to play with your dog." />
    <View style={styles.collection}>{SOLO_GAMES.map(game => <GameCard key={game.id} game={game}
      onPress={() => router.push({ pathname: "/game/play/[gameId]", params: { gameId: game.id, mode: "solo" } })} />)}</View>
    <GameNote>Play, record, then review your round.</GameNote>
  </GameScreen>;
}

export function GameDetailsScreen() {
  const { game, mode, location, routeParams } = useGameFlowParams();
  if (!game) return <MissingGame />;
  return <GameScreen label={modeLabel(mode)} footer={<GameButton label="Set up camera" onPress={() => router.push({ pathname: "/game/prepare", params: routeParams })} />}>
    <View style={[styles.art, { backgroundColor: gameTint(game.id) }]}>
      <View style={styles.artBadge}><GameGlyph id={game.id} size={16} /><Text style={ui.small}>{game.duration}</Text></View>
      <GameArt id={game.id} width={224} height={160} />
    </View>
    <GameHeading title={game.title} description={game.description} />
    <View style={styles.scoring}><GameGlyph id={game.id} size={18} /><Text style={ui.rowTitle}>{game.measure}</Text>
      {mode !== "solo" ? <Text style={ui.small}>· {location === "remote" ? "Remote" : "Same place"}</Text> : null}
    </View>
    <View style={styles.rules}><Text style={ui.sectionTitle}>How to play</Text>
      {game.steps.map((step, index) => <View key={step} style={styles.step}>
        <View style={styles.numberDisc}><Text style={styles.number}>{index + 1}</Text></View><Text style={[ui.body, styles.stepCopy]}>{step}</Text>
      </View>)}
    </View>
    <View style={styles.equipment}><CheckIcon size={18} color={text.primary} /><View style={ui.flex}><Text style={ui.rowTitle}>Bring along</Text><Text style={ui.small}>{game.equipment}</Text></View></View>
  </GameScreen>;
}

export function GamePreparationScreen() {
  const { game, mode, routeParams } = useGameFlowParams();
  const [checked, setChecked] = useState<string[]>([]);
  const [target, setTarget] = useState(routeParams.target);
  useFocusEffect(useCallback(() => { setChecked([]); }, []));
  if (!game) return <MissingGame />;
  const checks = ["Full body in frame", "Phone steady, space clear", "Ready to begin"];
  return <GameScreen label={game.title} progress={{ current: 1, total: 4 }} footer={<GameButton label="Start round" disabled={checked.length !== checks.length}
    onPress={() => router.push({ pathname: "/game/session", params: { ...routeParams, target } })} />}>
    <GameHeading title="Ready to play?" description="Set your phone down with all four paws in view." />
    <CameraStage compact />
    {game.id === "spot-sprint" ? <View style={styles.targetBlock}>
      <Text style={ui.cardName}>Choose your target</Text>
      <View style={styles.targets} accessibilityRole="radiogroup" accessibilityLabel="Target type">
        <View style={ui.flex}><ChoiceRow title="Mat" role="radio" selected={target === "mat"} onPress={() => setTarget("mat")} /></View>
        <View style={ui.flex}><ChoiceRow title="Low platform" role="radio" selected={target === "platform"} onPress={() => setTarget("platform")} /></View>
      </View>
      <Text style={ui.small}>{mode === "tournament" ? "Match the target type and starting distance for every player." : "Keep the target and the route in frame."}</Text>
    </View> : null}
    <View style={styles.checks}><View style={styles.checksHeading}><Text style={ui.cardName}>Quick check</Text><Text style={ui.small}>{checked.length} of {checks.length}</Text></View>{checks.map(check => <View key={check}>
      <ChoiceRow title={check} selected={checked.includes(check)} onPress={() => setChecked(current => current.includes(check) ? current.filter(item => item !== check) : [...current, check])} />
    </View>)}</View>
    <View style={ui.row}><TimerIcon size={16} color={text.secondary} /><Text style={[ui.small, ui.flex]}>You’ll have 3 seconds before the first cue.</Text></View>
  </GameScreen>;
}

const styles = StyleSheet.create({
  collection: { gap: space.md },
  art: { alignItems: "center", paddingTop: 24, paddingBottom: 4, borderRadius: 26, overflow: "hidden" },
  artBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.82)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  scoring: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, marginTop: -space.sm },
  rules: { gap: space.md },
  step: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  numberDisc: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  number: { ...type.caption, color: text.primary, fontWeight: "600" },
  stepCopy: { flex: 1, paddingTop: 3 },
  equipment: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: pastel.pistachio },
  targetBlock: { gap: space.sm },
  targets: { flexDirection: "row", gap: space.sm },
  checks: { gap: space.sm },
  checksHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
});
