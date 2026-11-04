import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CheckIcon, ClockIcon, FilmStripIcon, PawPrintIcon, ScanIcon } from "phosphor-react-native";
import { accent, border, pastel, text, type } from "@/constants/design";
import { CameraStage, GameButton, GameGlyph, GameHeading, GameNote, GameScreen, MissingGame, TextAction, ui } from "./GameFlowUI";
import { formatGameTime, modeHome, parsePreviewDuration } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";
import SoloReviewScreen from "./SoloReviewScreen";

const TOURNAMENT_RESULTS = [
  { name: "Your pup", score: "00:06.4", tint: pastel.butter },
  { name: "Player 2", score: "00:07.2", tint: pastel.sky },
  { name: "Player 3", score: "00:08.6", tint: pastel.mint },
  { name: "Player 4", score: "00:09.1", tint: pastel.peach },
] as const;

export function GameReviewScreen() {
  const { game, mode, params, routeParams } = useGameFlowParams();
  const [reviewing, setReviewing] = useState(false);
  const elapsed = parsePreviewDuration(params.elapsed);
  if (!game) return <MissingGame />;
  if (mode === "solo") return <SoloReviewScreen key={`${game.id}:${routeParams.target}:${params.elapsed ?? ""}`} />;
  const recordAgain = () => router.dismissTo({ pathname: "/game/prepare", params: routeParams });
  const showResult = (outcome: "complete" | "unclear") =>
    router.replace({ pathname: "/game/result", params: { ...routeParams, outcome } });

  if (elapsed === null) {
    return <GameScreen label={game.title} progress={{ current: 3, total: 4 }} centered
      footer={<GameButton label="Set up camera" onPress={recordAgain} />}>
      <GameHeading title="No round to review" description="Start a round to see the recording and review flow." />
    </GameScreen>;
  }

  return <GameScreen label={game.title} progress={{ current: 3, total: 4 }}
    onBack={() => reviewing ? setReviewing(false) : router.dismissTo(modeHome(mode))}
    footer={reviewing
      ? <GameButton label="View sample result" onPress={() => showResult("complete")} />
      : <><GameButton label="Preview review" onPress={() => setReviewing(true)} /><TextAction label="Retake round" onPress={recordAgain} /></>}>
    <GameHeading title={reviewing ? "Review status" : "Review your round"}
      description={reviewing ? "Video checks before the final score." : "Check the framing before sending your video."} />
    {reviewing ? <>
      <View style={styles.reviewSummary}>
        <View style={styles.clipIcon}><FilmStripIcon size={24} color={text.primary} /></View>
        <View style={ui.flex}><Text style={ui.cardName}>{game.title}</Text><Text style={ui.small}>{formatGameTime(elapsed)} · sample video</Text></View>
      </View>
      <View style={styles.reviewSteps}>
        {[
          { title: "Receive video", detail: "A complete, unedited clip" },
          { title: "Check actions", detail: "Movement, sequence and timing" },
          { title: "Compare scores", detail: "After every player's review" },
        ].map((step, index) => <View key={step.title} accessible
          accessibilityLabel={`${step.title}. ${index === 0 ? "Completed" : index === 1 ? "Current step" : "Pending"}. ${step.detail}. Sample status.`}
          style={[styles.reviewStep, index === 1 && styles.reviewStepActive]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.stepDot, index < 2 && styles.stepDotFilled]}>
            {index === 0 ? <CheckIcon size={16} color={text.primary} weight="bold" /> : <Text style={styles.stepNumber}>{index + 1}</Text>}
          </View>
          <View style={styles.stepCopy}><Text style={ui.cardName}>{step.title}</Text><Text style={ui.small}>{step.detail}</Text></View>
          {index === 1 ? <View style={styles.activeDot} /> : null}
        </View>)}
      </View>
      <GameNote>Example review state. No video has been submitted.</GameNote>
      <TextAction label="Preview an unclear video" onPress={() => showResult("unclear")} />
    </> : <>
      <View style={styles.clip}>
        <CameraStage compact label="Video preview">
          <View style={styles.emptyClip}><FilmStripIcon size={32} color={text.secondary} weight="light" /><Text style={styles.clipLabel}>No recording attached</Text></View>
        </CameraStage>
        <View style={styles.clipMeta}>
          <View style={ui.row}><ClockIcon size={16} color={text.secondary} /><Text style={ui.rowTitle}>{formatGameTime(elapsed)}</Text></View>
          <Text style={ui.small}>Round duration</Text>
        </View>
      </View>
      <View style={styles.checks}>
        <Text style={ui.cardName}>Before you send</Text>
        <View style={styles.checkLine}><View style={styles.checkDisc}><CheckIcon size={14} color={text.primary} weight="bold" /></View><Text style={[ui.caption, ui.flex]}>Full body and target stay in frame</Text></View>
        <View style={styles.checkLine}><View style={styles.checkDisc}><CheckIcon size={14} color={text.primary} weight="bold" /></View><Text style={[ui.caption, ui.flex]}>The round plays from start to finish</Text></View>
      </View>
      <GameNote>This preview has no recorded clip to upload.</GameNote>
    </>}
  </GameScreen>;
}

export function GameResultScreen() {
  const { game, mode, params, routeParams } = useGameFlowParams();
  if (!game) return <MissingGame />;
  const unclear = params.outcome === "unclear";
  const playAgain = () => router.dismissTo({ pathname: "/game/prepare", params: routeParams });
  return <GameScreen label={unclear ? "Video review" : "Results"} progress={{ current: 4, total: 4 }}
    onBack={() => router.dismissTo(modeHome(mode))}
    footer={<><GameButton label={unclear ? "Record again" : "Play again"} onPress={playAgain} /><TextAction label="Back to games" onPress={() => router.dismissTo("/(tabs)/game")} /></>}>
    <View style={styles.resultHeading}>
      <View style={styles.sampleRow}><Text style={styles.sampleTag}>Sample result</Text><Text style={ui.small}>Not saved</Text></View>
      <GameHeading title={unclear ? "Record another take" : mode === "tournament" ? "Final standings" : mode === "duel" ? "Round comparison" : game.title}
        description={unclear ? "The finish was outside the frame." : mode === "solo" ? undefined : game.title} />
    </View>
    {unclear ? <>
      <View style={styles.noScore}>
        <View style={styles.retakeDisc}><ScanIcon size={28} color={text.primary} /></View>
        <Text style={ui.sectionTitle}>No score confirmed</Text>
        <Text style={[ui.caption, styles.centerText]}>A clearer view will help the review.</Text>
      </View>
      <View style={styles.fixList}>
        <Text style={ui.cardName}>Before the next take</Text>
        {[
          ["Move the phone back", "Leave room around your dog's full body."],
          ["Keep the finish visible", "Include all four paws and the target."],
          ["Record without cuts", "Keep filming until the action ends."],
        ].map(([title, detail], index) => <View key={title} style={styles.fixRow}>
          <View style={styles.fixNumber}><Text style={styles.stepNumber}>{index + 1}</Text></View>
          <View style={ui.flex}><Text style={ui.rowTitle}>{title}</Text><Text style={ui.small}>{detail}</Text></View>
        </View>)}
      </View>
      <Text style={[ui.small, styles.centerText]}>An unclear recording is not a failed action.</Text>
    </> : mode === "duel" ? <>
      <View style={styles.matchup}>
        <PlayerScore name="Your pup" score="4" tint={pastel.butter} />
        <PlayerScore name="Player 2" score="3" tint={pastel.sky} />
      </View>
      <View style={styles.statTiles}><StatTile label="Difference" value="1 command" tint={pastel.mint} /><StatTile label="Ranking" value="Most completed" tint={pastel.peach} /></View>
      <GameNote>Example scores. No AI verdict or reward has been issued.</GameNote>
    </> : mode === "tournament" ? <>
      <View style={styles.leaderboard}>
        <View style={styles.tableHeader}><Text style={ui.cardName}>Time to sit</Text><Text style={ui.small}>Fastest first</Text></View>
        {TOURNAMENT_RESULTS.map((entry, index) => <View key={entry.name} style={[styles.rankRow, index === 0 && styles.yourRank]}>
          <Text style={styles.rankNumber}>{index + 1}</Text>
          <View style={[styles.rankAvatar, { backgroundColor: entry.tint }]}><PawPrintIcon size={17} color={text.primary} weight="fill" /></View>
          <Text style={[ui.rowTitle, ui.flex]}>{entry.name}</Text><Text style={styles.rankScore}>{entry.score}</Text>
        </View>)}
      </View>
      <View style={styles.statTiles}><StatTile label="Your place" value="1 of 4" tint={pastel.butter} /><StatTile label="Players" value="4 demo players" tint={pastel.mint} /></View>
      <GameNote>Example standings. Final places require every video to be reviewed.</GameNote>
    </> : <>
      <View style={styles.soloScore}>
        <View style={styles.scoreIcon}><GameGlyph id={game.id} size={23} /></View>
        <Text style={ui.caption}>{game.scoreLabel}</Text><Text style={styles.score}>{game.sampleScore}</Text>
        <Text style={ui.small}>{game.measure}</Text>
      </View>
      <View style={styles.statTiles}><StatTile label="Personal best" value="—" tint={pastel.mint} /><StatTile label="Previous round" value="—" tint={pastel.sky} /></View>
      <GameNote>Verified records will appear here. This sample score is not an AI verdict.</GameNote>
    </>}
  </GameScreen>;
}

function PlayerScore({ name, score, tint }: { name: string; score: string; tint: string }) {
  return <View style={[styles.playerScore, { backgroundColor: tint }]}>
    <View style={styles.pawAvatar}><PawPrintIcon size={23} color={text.primary} weight="fill" /></View>
    <Text style={ui.cardName}>{name}</Text>
    <Text style={styles.duelScore}>{score}<Text style={styles.scoreDenominator}> / 5</Text></Text>
    <Text style={ui.small}>Commands</Text>
  </View>;
}

function StatTile({ label, value, tint }: { label: string; value: string; tint: string }) {
  return <View style={[styles.statTile, { backgroundColor: tint }]}><Text style={ui.small}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  clip: { gap: 12 },
  emptyClip: { alignItems: "center", gap: 10 },
  clipLabel: { ...type.caption, color: text.secondary },
  clipMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  checks: { gap: 14, padding: 18, borderRadius: 26, backgroundColor: pastel.mint },
  checkLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkDisc: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
  reviewSummary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 26, backgroundColor: pastel.sky },
  clipIcon: { width: 42, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.7)" },
  reviewSteps: { padding: 10, borderRadius: 26, borderWidth: 1, borderColor: border.soft, gap: 4 },
  reviewStep: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, padding: 12, borderRadius: 18 },
  reviewStepActive: { backgroundColor: pastel.butter },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F1F1EE", alignItems: "center", justifyContent: "center" },
  stepDotFilled: { backgroundColor: accent.deep },
  stepNumber: { ...type.supporting, fontWeight: "600", color: text.primary },
  stepCopy: { flex: 1, gap: 4 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: accent.band },
  resultHeading: { gap: 12 },
  sampleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sampleTag: { ...type.caption, fontWeight: "500", color: text.secondary, backgroundColor: "#F4F4F2", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: "hidden" },
  centerText: { textAlign: "center" },
  soloScore: { alignItems: "center", gap: 6, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 26, backgroundColor: pastel.butter },
  scoreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", marginBottom: 2 },
  score: { fontSize: 52, lineHeight: 62, letterSpacing: -1.5, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  statTiles: { flexDirection: "row", gap: 12 },
  statTile: { flex: 1, gap: 8, minHeight: 82, padding: 16, borderRadius: 22, justifyContent: "center" },
  statValue: { ...type.supporting, color: text.primary, fontWeight: "600" },
  matchup: { flexDirection: "row", gap: 12 },
  playerScore: { flex: 1, gap: 8, alignItems: "center", paddingHorizontal: 12, paddingVertical: 20, borderRadius: 26 },
  pawAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", marginBottom: 2 },
  duelScore: { fontSize: 48, lineHeight: 58, fontWeight: "600", letterSpacing: -1.5, color: text.primary, fontVariant: ["tabular-nums"] },
  scoreDenominator: { ...type.sectionTitle, fontWeight: "500", color: text.secondary },
  leaderboard: { borderRadius: 26, padding: 12, borderWidth: 1, borderColor: border.soft, gap: 3 },
  tableHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 10 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 54, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 18 },
  yourRank: { backgroundColor: pastel.butter },
  rankNumber: { ...type.caption, color: text.secondary, fontWeight: "600", width: 14, textAlign: "center" },
  rankAvatar: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  rankScore: { ...type.supporting, color: text.primary, fontWeight: "600", fontVariant: ["tabular-nums"] },
  noScore: { alignItems: "center", gap: 10, padding: 22, borderRadius: 26, backgroundColor: pastel.peach },
  retakeDisc: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.75)" },
  fixList: { gap: 18 },
  fixRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  fixNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: pastel.butter, alignItems: "center", justifyContent: "center" },
});
