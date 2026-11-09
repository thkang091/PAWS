import { useState, type ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon, ArrowRightIcon, CheckIcon, InfoIcon, PawPrintIcon, ShuffleIcon, TimerIcon, FlagIcon, TrafficSignalIcon, XIcon, VideoCameraSlashIcon } from "phosphor-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, layout, pastel, radius, space, text, type } from "@/constants/design";
import type { PlayGame, PlayGameId } from "./gameFlow";

const ART = {
  "longest-sit": require("../../../../assets/images/game/longest-sit.png"),
  "trick-combo": require("../../../../assets/images/game/trick-combo.png"),
  "spot-sprint": require("../../../../assets/images/game/spot-sprint.png"),
  "red-light-green-light": require("../../../../assets/images/game/paws-says.png"),
  "paws-says": require("../../../../assets/images/game/paws-says.png"),
};
const GAME_STAGES = ["Camera setup", "Play round", "Video review", "Result"];

export function GameScreen({ label, children, footer, onBack, backLabel = "Back", centered = false, dark = false, progress, scrollable = true, headerAction, liveRooms = false }: {
  label?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void;
  backLabel?: string; centered?: boolean; dark?: boolean;
  progress?: { current: number; total: number };
  scrollable?: boolean;
  headerAction?: ReactNode;
  liveRooms?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [about, setAbout] = useState(false);
  return <View style={[ui.screen, dark && ui.darkScreen]}>
    <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
      <PressScale accessibilityRole="button" accessibilityLabel={backLabel}
        onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace("/(tabs)/game"))}
        style={[ui.iconButton, dark && ui.darkOutline]}>
        {backLabel === "Close" ? <XIcon size={24} color={dark ? "white" : text.primary} /> : <CaretLeftIcon size={iconSize.nav} weight="bold" color={dark ? "white" : text.primary} />}
      </PressScale>
      {label ? <Text style={[ui.headerLabel, dark && ui.onDark]} numberOfLines={1}>{label}</Text> : <View style={ui.flex} />}
      {headerAction}
      <PressScale accessibilityRole="button" accessibilityLabel="About this preview" onPress={() => setAbout(true)} style={ui.previewButton}>
        <InfoIcon size={21} color={dark ? "white" : text.secondary} />
      </PressScale>
    </View>
    {progress ? <View style={ui.progress} accessible accessibilityRole="progressbar" accessibilityLabel="Game progress"
      accessibilityValue={{ min: 0, max: progress.total, now: progress.current, text: `Step ${progress.current} of ${progress.total}${progress.total === GAME_STAGES.length ? ": " + GAME_STAGES[progress.current - 1] : ""}` }}>
      {Array.from({ length: progress.total }, (_, index) => <View key={index} style={[ui.segment, index < progress.current && ui.segmentFilled]} />)}
    </View> : null}
    {scrollable ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[ui.content, centered && ui.centered, !footer && { paddingBottom: insets.bottom + space.section }]}>
      <View style={ui.stack}>{children}</View>
    </ScrollView> : <View style={{ flex: 1, minHeight: 0 }}>{children}</View>}
    {footer ? <View style={[ui.footer, dark && ui.darkFooter, { paddingBottom: insets.bottom + space.lg }]}>{footer}</View> : null}
    <Modal visible={about} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setAbout(false)}>
      <View style={ui.scrim}><View style={ui.dialog} accessibilityViewIsModal>
        <InfoIcon size={24} color={text.primary} />
        <Text accessibilityRole="header" style={ui.sectionTitle}>Screen preview</Text>
        <Text style={ui.body}>{liveRooms
          ? "Same place uses a shared room code and each player’s Ready status. Remote matchmaking and AI review are not connected yet. No coins are spent."
          : "Solo videos stay on your phone. AI review and room connections are not connected yet. Demo results are not saved and no coins are spent."}</Text>
        <GameButton label="Got it" onPress={() => setAbout(false)} />
      </View></View>
    </Modal>
  </View>;
}

export function GameButton({ label, onPress, secondary = false, disabled = false, icon, style }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[ui.button, secondary && ui.secondaryButton, disabled && ui.disabled, style]}>
    <Text style={ui.buttonText}>{label}</Text>{icon}
  </PressScale>;
}

export function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <PressScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={ui.textAction}>
    <Text style={ui.textActionText}>{label}</Text>
  </PressScale>;
}

export function GameHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <View style={ui.heading}>
    {eyebrow ? <Text style={ui.eyebrow}>{eyebrow}</Text> : null}
    <Text accessibilityRole="header" style={ui.title}>{title}</Text>
    {description ? <Text style={ui.body}>{description}</Text> : null}
  </View>;
}

export function GameGlyph({ id, size = 22 }: { id: PlayGameId; size?: number }) {
  const Glyph = id === "longest-sit" ? TimerIcon : id === "trick-combo" ? ShuffleIcon : id === "spot-sprint" ? FlagIcon : id === "red-light-green-light" ? TrafficSignalIcon : PawPrintIcon;
  return <Glyph size={size} color={text.primary} />;
}

// Generated through Higgsfield; see assets/images/game/provenance.json.
export function GameArt({ id, width = 230, height = 176 }: { id: PlayGameId; width?: number; height?: number }) {
  if (id === "red-light-green-light") return <View style={{ width, height }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={ART[id]} contentFit="contain" style={{ width, height, transform: [{ scale: 1.12 }] }} accessible={false} />
    <View style={[ui.signalBadge, { right: width * 0.04, bottom: height * 0.06 }]}>
      <View style={[ui.signalLight, { backgroundColor: "#EAA29A" }]} />
      <View style={[ui.signalLight, { backgroundColor: "#96B999" }]} />
    </View>
  </View>;
  return <Image source={ART[id]} contentFit="contain" style={{ width, height, transform: [{ scale: 1.12 }] }} accessible={false} />;
}

export const gameTint = (id: PlayGameId) => id === "longest-sit" ? pastel.butter : id === "trick-combo" ? pastel.sky : id === "spot-sprint" ? pastel.mint : id === "red-light-green-light" ? pastel.pistachio : pastel.peach;

export function GameCard({ game, onPress, selected = false }: { game: PlayGame; onPress?: () => void; selected?: boolean }) {
  const contents = <>
    <View style={ui.cardTop}>
      <View style={ui.flex}><Text style={ui.gameName}>{game.title}</Text><Text style={ui.cardDescription}>{game.measure}</Text></View>
      <GameArt id={game.id} width={104} height={84} />
    </View>
    <View style={ui.cardFoot}>
      <Text style={ui.small}>{game.duration}</Text>
      <View style={ui.cardAction}><Text style={ui.cardActionText}>{selected ? "Selected" : "Play"}</Text>
        {selected ? <CheckIcon size={15} color={text.primary} weight="bold" /> : <ArrowRightIcon size={15} color={text.primary} weight="bold" />}
      </View>
    </View>
  </>;
  return onPress ? <PressScale accessibilityRole="button" accessibilityLabel={game.title} onPress={onPress} style={[ui.gameCard, { backgroundColor: gameTint(game.id) }]}>{contents}</PressScale>
    : <View style={[ui.gameCard, { backgroundColor: gameTint(game.id) }]}>{contents}</View>;
}

export function GameNote({ children }: { children: ReactNode }) {
  return <View style={ui.note}><InfoIcon size={15} color={text.secondary} /><Text style={ui.noteText}>{children}</Text></View>;
}

export function ChoiceRow({ title, detail, selected, onPress, role = "checkbox" }: {
  title: string; detail?: string; selected: boolean; onPress: () => void; role?: "checkbox" | "radio";
}) {
  return <PressScale accessibilityRole={role} accessibilityLabel={title} accessibilityState={{ checked: selected }} aria-checked={selected}
    onPress={onPress} style={[ui.choiceRow, role === "radio" && ui.radioChoice, selected && ui.choiceSelected]}>
    <View style={[ui.checkbox, role === "radio" && ui.radio, selected && ui.checkboxOn]}>
      {selected ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
    </View>
    <View style={ui.flex}><Text style={ui.rowTitle}>{title}</Text>{detail ? <Text style={ui.caption}>{detail}</Text> : null}</View>
  </PressScale>;
}

export function CameraStage({ compact = false, children, label = "Camera off · preview", dark = false }: {
  compact?: boolean; children?: ReactNode; label?: string; dark?: boolean;
}) {
  return <View style={[ui.cameraStage, compact && ui.cameraCompact, dark && ui.cameraDark]}>
    <View style={[ui.cameraTag, dark && ui.cameraTagDark]}><VideoCameraSlashIcon size={14} color={dark ? "#D0D4CD" : text.secondary} /><Text style={[ui.cameraLabel, dark && ui.onDark]}>{label}</Text></View>
    <View style={ui.frameGuide} pointerEvents="none">
      <View style={[ui.corner, ui.cornerTL]} /><View style={[ui.corner, ui.cornerTR]} />
      <View style={[ui.corner, ui.cornerBL]} /><View style={[ui.corner, ui.cornerBR]} />
    </View>
    {children ?? <View style={ui.cameraCenter}><View style={[ui.cameraDisc, dark && ui.cameraDiscDark]}><VideoCameraSlashIcon size={28} color={dark ? "#CCD4C6" : "#657A59"} /></View><Text style={[ui.cameraHint, dark && ui.onDark]}>Keep all four paws in view</Text></View>}
  </View>;
}

export function MissingGame() {
  return <GameScreen label="Games" centered footer={<GameButton label="Choose a game" onPress={() => router.replace("/game/challenge")} />}>
    <GameHeading title="Game not found" description="Choose a game from the solo collection." />
  </GameScreen>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", backgroundColor: bg.canvas },
  darkScreen: { backgroundColor: "#191F1B" },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  iconButton: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  darkOutline: { borderColor: "#41473F" },
  headerLabel: { ...type.supporting, color: text.secondary, flex: 1, textAlign: "center" },
  previewButton: { width: layout.iconButton, height: layout.iconButton, alignItems: "center", justifyContent: "center" },
  previewText: { ...type.caption, color: text.secondary },
  progress: { flexDirection: "row", gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  segment: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: border.soft },
  segmentFilled: { backgroundColor: accent.deep },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.xxl },
  centered: { justifyContent: "center" },
  stack: { gap: space.xl },
  heading: { gap: 8 },
  title: { ...type.pageTitle, color: text.primary },
  sectionTitle: { ...type.sectionTitle, color: text.primary },
  body: { ...type.body, color: text.secondary },
  caption: { ...type.supporting, color: text.secondary },
  small: { ...type.caption, color: text.secondary },
  eyebrow: { ...type.caption, color: text.secondary },
  footer: { gap: space.sm, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: 1, borderTopColor: border.soft },
  darkFooter: { backgroundColor: "#191F1B", borderTopColor: "#30372F" },
  button: { minHeight: layout.controlHeight, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: accent.deep, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  secondaryButton: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.soft },
  buttonText: { ...type.cardTitle, fontWeight: "700", color: text.primary, textAlign: "center", flexShrink: 1 },
  disabled: { opacity: 0.4 },
  textAction: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  textActionText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.input, backgroundColor: bg.subtle },
  noteText: { ...type.caption, color: text.secondary, flexShrink: 1 },
  flex: { flex: 1, gap: 4 },
  rowTitle: { ...type.body, color: text.primary, fontWeight: "500" },
  cardName: { ...type.cardTitle, color: text.primary, fontWeight: "600" },
  gameCard: { borderRadius: 26, padding: space.lg, gap: space.sm },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  gameName: { ...type.sectionTitle, color: text.primary },
  cardDescription: { ...type.caption, fontSize: 13, lineHeight: 18, color: text.secondary },
  signalBadge: { position: "absolute", gap: 4, padding: 5, borderRadius: 12, backgroundColor: "#42483F" },
  signalLight: { width: 9, height: 9, borderRadius: 5 },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardAction: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.82)" },
  cardActionText: { ...type.caption, fontWeight: "600", color: text.primary },
  arrowDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  panel: { backgroundColor: bg.subtle, borderRadius: radius.card, padding: space.lg, gap: space.md },
  choiceRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 56, borderRadius: radius.card, backgroundColor: bg.subtle, borderWidth: 1.5, borderColor: "transparent" },
  choiceSelected: { backgroundColor: accent.soft, borderColor: accent.primary },
  radioChoice: { minHeight: 72 },
  checkbox: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: border.default, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  radio: { borderRadius: 11 },
  checkboxOn: { backgroundColor: accent.primary, borderColor: "#DBD795" },
  scrim: { flex: 1, padding: layout.gutter, backgroundColor: "rgba(28,27,26,0.35)", alignItems: "center", justifyContent: "center" },
  dialog: { width: "100%", maxWidth: 400, padding: 24, borderRadius: 28, backgroundColor: bg.canvas, gap: 20 },
  centerText: { textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  onDark: { color: "#F7F6EE" },
  cameraStage: { height: 296, backgroundColor: pastel.pistachio, borderRadius: 26, overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" },
  cameraDark: { backgroundColor: "#283128" },
  cameraCompact: { height: 206 },
  cameraGrid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", justifyContent: "space-evenly" },
  gridVertical: { width: 1, backgroundColor: "rgba(255,255,255,0.045)" },
  cameraTag: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.8)" },
  cameraTagDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  cameraLabel: { ...type.caption, color: text.secondary },
  frameGuide: { position: "absolute", top: "24%", left: "12%", right: "12%", bottom: "18%" },
  corner: { position: "absolute", width: 24, height: 24, borderColor: "#A0AC90" },
  cornerTL: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1, borderBottomRightRadius: 8 },
  cameraCenter: { alignItems: "center", gap: 12 },
  cameraDisc: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
  cameraDiscDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  cameraHint: { ...type.caption, color: text.secondary, textAlign: "center" },
});
