import { useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CheckIcon, FlagIcon, HeartIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ReelPlayer } from "@/features/dogReels/components/ReelPlayer";
import { reelError } from "@/features/dogReels/copy";
import { REPORT_REASONS } from "@/features/photoPose/copy";
import { timingLine } from "@/features/photoPose/flow";
import { poseKeys, useGallery, useReelChallenges } from "@/hooks/usePhotoPose";
import { castVote, reportEntry, type GalleryEntry, type ReportReason } from "@/services/mediaService";
import { accent, bg, layout, radius, space, text, type } from "@/constants/design";

const GAP = 10;

/**
 * Vote: every clip as its still, two across. Tap one to watch it full screen and give it your vote (one vote, movable
 * until voting closes). Counts stay hidden until the end.
 */
export default function ReelVoteScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challenges = useReelChallenges();
  const c = (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const gallery = useGallery(challengeId);
  const [open, setOpen] = useState<GalleryEntry | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tile = Math.floor((width - layout.gutter * 2 - GAP) / 2);
  const myVote = voted ?? c?.myVote ?? null;
  const now = c ? Date.parse(c.serverNow) : Date.now();

  const vote = async (e: GalleryEntry) => {
    setBusy(true);
    setError(null);
    try {
      await castVote(e.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVoted(e.id);
      await queryClient.invalidateQueries({ queryKey: poseKeys.reels });
    } catch (err) {
      setError(reelError((err as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  const report = (e: GalleryEntry) => {
    const send = (why: ReportReason) =>
      reportEntry(e.id, why)
        .then(() => Alert.alert("Thanks", "A moderator will take a look."))
        .catch((err) => Alert.alert("Couldn't send", reelError((err as { code?: string }).code)));
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...REPORT_REASONS.map(([, label]) => label), "Cancel"], cancelButtonIndex: REPORT_REASONS.length, destructiveButtonIndex: undefined }, (i) => {
        if (i < REPORT_REASONS.length) void send(REPORT_REASONS[i][0] as ReportReason);
      });
    } else Alert.alert("Report this clip", undefined, [...REPORT_REASONS.map(([k, label]) => ({ text: label, onPress: () => void send(k as ReportReason) })), { text: "Cancel", style: "cancel" as const }]);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={gallery.data ?? []}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.section, gap: GAP }}
        ListHeaderComponent={
          <View style={styles.head}>
            <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack("/game/tournament/reels")}>
              <CaretLeftIcon size={22} color={text.primary} weight="bold" />
            </PressScale>
            <Text style={styles.title}>{c?.title ?? "Vote"}</Text>
            <Text style={styles.line}>{c ? (timingLine(c, now) ?? "Pick your favourite") : ""}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{gallery.isPending ? "Loading clips" : gallery.error ? reelError((gallery.error as { code?: string }).code) : "No clips in the gallery yet."}</Text>}
        renderItem={({ item, index }) => (
          <Animated.View entering={reduceMotion ? FadeIn.duration(180) : FadeIn.delay(Math.min(index, 8) * 40).duration(200)}>
            <PressScale accessibilityRole="button" accessibilityLabel={`${item.dogName ?? "A dog"}'s clip${item.isMine ? ", yours" : ""}${myVote === item.id ? ", your vote" : ""}. Watch it`} scaleTo={0.97} style={[styles.tile, { width: tile, height: Math.round(tile * 1.6) }]} onPress={() => setOpen(item)}>
              {item.posterUrl ? <Image source={{ uri: item.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
              <View style={styles.shade} />
              <Text style={styles.tileName} numberOfLines={1}>
                {item.isMine ? "You" : (item.dogName ?? "")}
              </Text>
              {myVote === item.id ? (
                <Animated.View entering={reduceMotion ? FadeIn.duration(150) : ZoomIn.duration(160).withInitialValues({ transform: [{ scale: 0.9 }] })} style={styles.check}>
                  <CheckIcon size={14} color={text.primary} weight="bold" />
                </Animated.View>
              ) : null}
            </PressScale>
          </Animated.View>
        )}
      />

      <Modal visible={open != null} animationType="fade" onRequestClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.viewer}>
            <ReelPlayer url={open.url} poster={open.posterUrl} style={StyleSheet.absoluteFill} />
            <View style={[styles.viewerTop, { paddingTop: insets.top + space.sm }]}>
              <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.round} onPress={() => setOpen(null)}>
                <XIcon size={20} color="#FFFFFF" weight="bold" />
              </PressScale>
              {!open.isMine ? (
                <PressScale accessibilityRole="button" accessibilityLabel="Report this clip" style={styles.round} onPress={() => report(open)}>
                  <FlagIcon size={18} color="#FFFFFF" weight="bold" />
                </PressScale>
              ) : null}
            </View>
            <View style={[styles.viewerBar, { paddingBottom: insets.bottom + space.lg }]}>
              <Text style={styles.viewerName}>{open.isMine ? "Your clip" : (open.dogName ?? "")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {open.isMine ? null : myVote === open.id ? (
                <View style={styles.votedPill}>
                  <HeartIcon size={18} color={text.primary} weight="fill" />
                  <Text style={styles.votedText}>Your vote</Text>
                </View>
              ) : (
                <RaisedButton label={myVote ? "Move my vote here" : "Vote for this one"} busy={busy} onPress={() => void vote(open)} />
              )}
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  head: { marginBottom: space.md },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: "#E8E7E2", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -1, color: text.primary, marginTop: space.lg },
  line: { ...type.supporting, fontWeight: "700", color: text.secondary, marginTop: 4 },
  empty: { ...type.supporting, color: text.secondary, textAlign: "center", marginTop: space.section },
  tile: { borderRadius: 20, overflow: "hidden", backgroundColor: "#1C1B1A", justifyContent: "flex-end" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64, backgroundColor: "rgba(0,0,0,0.28)" },
  tileName: { margin: space.md, fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  check: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  viewer: { flex: 1, backgroundColor: "#0E0E0D" },
  viewerTop: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: layout.gutter },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  viewerBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, gap: space.md },
  viewerName: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  votedPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 18, backgroundColor: accent.deep },
  votedText: { fontSize: 16, fontWeight: "800", color: text.primary },
  error: { ...type.supporting, fontWeight: "700", color: "#FFB4A6" },
});
