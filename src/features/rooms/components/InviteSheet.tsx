import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowClockwiseIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { inviteLink, issueInvite, type Invite } from "@/services/roomService";
import { bg, radius, space, text, type } from "@/constants/design";

const minutesLeft = (iso: string) => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));

/**
 * Invite players: a QR code of the room's invitation link (an expiring token, nothing private), the room code to
 * type instead, and a share sheet. Only the host can make a new invitation; others see the code.
 */
export const InviteSheet = ({ visible, roomId, code, isHost, onClose }: { visible: boolean; roomId: string; code: string; isHost: boolean; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setInvite(await issueInvite(roomId));
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (visible && isHost && (!invite || Date.parse(invite.expiresAt) - Date.now() < 5 * 60_000)) void fresh();
  }, [visible, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = () =>
    void Share.share({ message: invite ? `Join my PAWS room. Open this link, or enter code ${code} in Tournament, Nearby: ${inviteLink(invite.token)}` : `Join my PAWS room with code ${code} in Tournament, Nearby.` });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.flex} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Invite players</Text>
            <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={onClose}>
              <XIcon size={18} color={text.primary} weight="bold" />
            </PressScale>
          </View>
          <View style={styles.qr}>
            {isHost ? (
              invite ? (
                <QRCode value={inviteLink(invite.token)} size={208} backgroundColor="#FFFFFF" color="#1C1B1A" />
              ) : busy ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.note}>{error ?? "No code yet."}</Text>
              )
            ) : (
              <Text style={styles.note}>Ask the host to show the QR code, or share the room code below.</Text>
            )}
          </View>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.code} selectable>
            {code}
          </Text>
          {isHost && invite ? (
            <View style={styles.expiry}>
              <Text style={styles.note}>{`QR code works for ${minutesLeft(invite.expiresAt)} more minutes.`}</Text>
              <PressScale accessibilityRole="button" accessibilityLabel="Make a new QR code" style={styles.refresh} onPress={() => void fresh()}>
                <ArrowClockwiseIcon size={16} color={text.primary} weight="bold" />
              </PressScale>
            </View>
          ) : null}
          <RaisedButton tone="white" label="Share invite" onPress={share} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)" },
  sheet: { backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xxl, gap: space.md, alignItems: "stretch" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  qr: { alignSelf: "center", width: 240, height: 240, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E7E2", alignItems: "center", justifyContent: "center", padding: space.lg },
  codeLabel: { ...type.eyebrow, color: text.tertiary, textAlign: "center", marginTop: space.sm },
  code: { fontSize: 36, lineHeight: 42, fontWeight: "800", letterSpacing: 6, textAlign: "center", color: text.primary },
  expiry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  refresh: { width: 32, height: 32, borderRadius: 16, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  note: { ...type.caption, color: text.secondary, textAlign: "center" },
});
