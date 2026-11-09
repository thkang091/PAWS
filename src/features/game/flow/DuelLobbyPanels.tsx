import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowRightIcon, CheckIcon, CopySimpleIcon, QrCodeIcon, ShareNetworkIcon, StackIcon, VideoCameraIcon } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";
import { GameButton, ui } from "./GameFlowUI";
import { canChooseDuelGame, sanitizeRoomCode, type DuelRoomState } from "./duelRoomState";
import { gameForMode } from "./gameFlow";

const GAME = gameForMode("duel")!;
const COPY_FALLBACK = "Touch and hold the code to copy.";

export function RoomInvitePanel({ code, qrSize = 156, compact = false }: {
  code: string;
  qrSize?: number;
  compact?: boolean;
}) {
  const [copyNotice, setCopyNotice] = useState("");
  const [copyFeedbackVersion, setCopyFeedbackVersion] = useState(0);
  const [sharing, setSharing] = useState(false);
  const sharePending = useRef(false);
  const copyRequest = useRef(0);
  const currentCode = useRef(code);
  currentCode.current = code;

  useEffect(() => {
    setCopyNotice("");
    setSharing(false);
    copyRequest.current += 1;
    return () => { copyRequest.current += 1; };
  }, [code]);

  useEffect(() => {
    if (!copyNotice) return;
    const timeout = setTimeout(() => setCopyNotice(""), 2000);
    return () => clearTimeout(timeout);
  }, [copyNotice, copyFeedbackVersion]);

  const showNotice = (notice: string, request: number, value: string) => {
    if (request !== copyRequest.current || value !== currentCode.current) return;
    setCopyNotice(notice);
    setCopyFeedbackVersion(request);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(notice);
  };

  const copyCode = async () => {
    const request = ++copyRequest.current;
    const value = code;
    let notice = COPY_FALLBACK;
    try {
      if (Platform.OS === "web") {
        const clipboard = (globalThis as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } }).navigator?.clipboard;
        if (!clipboard?.writeText) throw new Error("Clipboard unavailable");
        await clipboard.writeText(value);
      } else {
        // Loaded only after a native copy tap; older dev builds may lack this module.
        const clipboard = (require("react-native") as { Clipboard?: { setString: (value: string) => void | Promise<void> } }).Clipboard;
        if (!clipboard?.setString) throw new Error("Clipboard unavailable");
        await clipboard.setString(value);
      }
      notice = "Copied";
    } catch {
      // The selectable code remains a native fallback without installing a module.
    }
    showNotice(notice, request, value);
  };

  const shareCode = async () => {
    if (sharePending.current) return;
    const webShare = (globalThis as { navigator?: { share?: (data: { title: string; text: string }) => Promise<void> } }).navigator;
    if (Platform.OS === "web" && !webShare?.share) { await copyCode(); return; }
    sharePending.current = true;
    setSharing(true);
    setCopyNotice("");
    const request = ++copyRequest.current;
    const value = code;
    try {
      const message = `PAWS game code: ${value}`;
      if (Platform.OS === "web") await webShare!.share!({ title: "PAWS", text: message });
      else await Share.share({ message });
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "AbortError")) {
        showNotice("Couldn’t share. Copy the code.", request, value);
      }
    } finally {
      sharePending.current = false;
      if (request === copyRequest.current && value === currentCode.current) setSharing(false);
    }
  };

  const codeLabel = <Text style={[ui.caption, styles.centeredText]}>Game code</Text>;
  const codeValue = <Text selectable accessibilityLabel={`Game code ${code}`} testID="duel-room-code"
    style={[styles.prominentCode, compact && styles.compactCode]}>{code}</Text>;
  const shareButton = <PressScale accessibilityRole="button" accessibilityLabel="Share game code" accessibilityState={{ disabled: sharing }}
    disabled={sharing} onPress={shareCode} style={styles.iconAction}>
    <ShareNetworkIcon size={20} color={text.primary} />
  </PressScale>;
  const copyButton = <PressScale accessibilityRole="button" accessibilityLabel="Copy game code" accessibilityState={{ disabled: sharing }}
    disabled={sharing} onPress={copyCode} style={styles.iconAction}>
    {copyNotice === "Copied" ? <CheckIcon size={20} color={text.primary} /> : <CopySimpleIcon size={20} color={text.primary} />}
  </PressScale>;
  const feedback = <Text accessibilityLiveRegion="polite" style={[ui.small, styles.feedback]}>{copyNotice}</Text>;
  const qr = <View style={[styles.qrDetails, compact && styles.compactQr]} testID="duel-room-qr" accessible accessibilityLabel={`Room QR for game code ${code}`}>
    <View style={[styles.scanFrame, { width: qrSize, height: qrSize }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <QRCode value={code} size={qrSize} color={text.primary} backgroundColor={bg.canvas}
        quietZone={qrSize * 4 / 21} ecl="M" testID="duel-room-qr-image" />
    </View>
  </View>;

  return <View style={styles.invitePanel}>
    {compact ? <>
      <View style={styles.compactInviteRow} testID="duel-invite-compact">
        <View style={styles.compactCodeGroup}>
          {codeLabel}
          {codeValue}
          <View style={styles.compactActions}>{shareButton}{copyButton}</View>
        </View>
        {qr}
      </View>
      {feedback}
    </> : <>
      {codeLabel}
      <View style={styles.codeRow}>{shareButton}{codeValue}{copyButton}</View>
      {feedback}
      {qr}
    </>}
  </View>;
}

export function GameSelectionPanel({ state, onChoose, busy = false }: {
  state: DuelRoomState;
  onChoose: () => void;
  busy?: boolean;
}) {
  const editable = !busy && canChooseDuelGame(state);
  const selected = !!state.selectedGame;
  const guest = state.room?.role === "guest";

  return <View style={styles.gamePanel} testID="duel-game-selection">
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={ui.sectionTitle}>Choose a game</Text>
    {guest && !selected ? <Text style={ui.caption}>Your host is choosing the game.</Text> : null}
    <PressScale accessibilityRole="radio" accessibilityLabel={GAME.title}
      accessibilityState={{ disabled: !editable, checked: selected }} aria-checked={selected}
      disabled={!editable} onPress={onChoose} style={[styles.gameRow, selected && styles.gameRowSelected]}>
      <View style={styles.gameIcon}><StackIcon size={21} color={text.primary} /></View>
      <View style={styles.flex}>
        <Text style={ui.cardName}>{GAME.title}</Text>
        <Text style={ui.small}>{GAME.subtitle}</Text>
      </View>
      {selected ? <CheckIcon size={20} color={text.primary} /> : editable ? <ArrowRightIcon size={19} color={text.primary} /> : null}
    </PressScale>
    {selected ? <View style={styles.videoNote}>
      <VideoCameraIcon size={18} color={text.secondary} /><Text style={[ui.caption, styles.flex]}>Video review after play.</Text>
    </View> : null}
  </View>;
}

export function JoinGamePanel({ code, error, onCodeChange, onSubmit, onScan, busy = false }: {
  code: string;
  error: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
  onScan: () => void;
  busy?: boolean;
}) {
  return <View style={styles.joinPanel} testID="duel-join-form">
    <View style={styles.joinCard}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Enter game code</Text>
      <TextInput accessibilityLabel="Game code" accessibilityHint="Enter the 6-character code from your friend"
        placeholder="A1B2C3" placeholderTextColor={text.tertiary}
        value={code} editable={!busy} onChangeText={value => onCodeChange(sanitizeRoomCode(value))}
        autoCapitalize="characters" autoCorrect={false} autoComplete="off" maxLength={6}
        returnKeyType="go" onSubmitEditing={() => { if (!busy) onSubmit(); }} style={[styles.codeInput, !!error && styles.codeInputError]} />
      <Text accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={error ? styles.error : ui.small}>
        {error || "6 characters from your friend’s lobby."}
      </Text>
    </View>
    <View style={styles.joinDivider}>
      <View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} />
    </View>
    <View style={[styles.joinCard, styles.scanCard]}>
      <View style={styles.scanBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <QrCodeIcon size={30} color={text.primary} weight="light" />
      </View>
      <Text accessibilityRole="header" style={ui.cardName}>Scan a room QR</Text>
      <GameButton label="Scan QR code" secondary disabled={busy} onPress={onScan} style={styles.scanButton} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  invitePanel: { gap: 0 },
  compactInviteRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  compactCodeGroup: { flex: 1, minWidth: 0 },
  compactCode: { flex: 0 },
  compactActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  compactQr: { marginTop: 0 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  prominentCode: { ...type.pageTitle, color: text.primary, letterSpacing: 2, flex: 1, minWidth: 0, textAlign: "center" },
  centeredText: { textAlign: "center" },
  feedback: { minHeight: type.caption.lineHeight, textAlign: "center" },
  iconAction: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  qrDetails: { alignItems: "center", marginTop: space.xs },
  scanFrame: { alignItems: "center", justifyContent: "center", backgroundColor: bg.canvas },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  gamePanel: { gap: space.lg },
  gameRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 76, padding: space.md, borderWidth: 1, borderColor: border.soft, borderRadius: radius.card },
  gameRowSelected: { backgroundColor: accent.soft, borderColor: accent.deep },
  gameIcon: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  videoNote: { flexDirection: "row", alignItems: "center", gap: space.sm },
  joinPanel: { gap: space.xl },
  joinCard: { gap: space.lg, padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas },
  joinDivider: { flexDirection: "row", alignItems: "center", gap: space.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: border.soft },
  dividerText: { ...type.eyebrow, color: text.tertiary },
  scanCard: { alignItems: "center" },
  scanBadge: { width: 60, height: 60, borderRadius: radius.input, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  scanButton: { alignSelf: "stretch" },
  codeInput: { ...type.pageTitle, color: text.primary, letterSpacing: 4, textAlign: "center", minHeight: 64,
    paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.input, borderWidth: 1, borderColor: border.default, backgroundColor: bg.subtle },
  codeInputError: { borderColor: "#A14937" },
  error: { ...type.supporting, color: "#A14937" },
});
