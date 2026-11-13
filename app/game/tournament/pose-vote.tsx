import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { DotsThreeIcon, HeartIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import {
  PoseImage,
  chooseFrom,
} from "@/features/photoPose/components/PoseParts";
import { REPORT_REASONS, poseError } from "@/features/photoPose/copy";
import { timingLine } from "@/features/photoPose/flow";
import { poseKeys, useGallery, usePhotoChallenges } from "@/hooks/usePhotoPose";
import {
  castVote,
  reportEntry,
  type GalleryEntry,
  type ReportReason,
} from "@/services/mediaService";
import {
  accent,
  bg,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";
import { mediaPhase } from "../../../supabase/functions/media/phase";

/**
 * The voting gallery. Everyone sees the entries in their own shuffled order, so the first photo doesn't win for
 * being first. One vote, which you can move until voting closes. Counts stay hidden until then.
 */
export default function PoseVoteScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const challenges = usePhotoChallenges();
  const c =
    (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const gallery = useGallery(challengeId);
  const [voted, setVoted] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const entries = (gallery.data ?? []).filter((e) => !reported.has(e.id));
  const mine = voted ?? entries.find((e) => e.myVote)?.id ?? null;
  const now = c ? Date.parse(c.serverNow) : Date.now();
  const tile = (width - layout.gutter * 2 - space.md) / 2;
  // Worked out from the dates, so a list fetched a while ago can't keep voting open or shut. The server checks again.
  const closed = !c || mediaPhase(c, Date.now()) !== "voting";

  const vote = async (e: GalleryEntry) => {
    if (e.isMine || closed || mine === e.id) return;
    const before = mine;
    setVoted(e.id);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await castVote(e.id);
      void queryClient.invalidateQueries({ queryKey: poseKeys.challenges });
      void queryClient.invalidateQueries({ queryKey: poseKeys.seasonal });
    } catch (err) {
      setVoted(before);
      setError(poseError((err as { code?: string }).code));
    }
  };

  const report = (e: GalleryEntry) =>
    chooseFrom("Report this photo", REPORT_REASONS, async (why) => {
      try {
        await reportEntry(e.id, why as ReportReason);
        setReported((s) => new Set(s).add(e.id));
        setOpen(null);
      } catch (err) {
        setError(poseError((err as { code?: string }).code));
      }
    });

  return (
    <View style={styles.flex}>
      <DetailShell
        title="Vote"
        glyph={<HeartIcon size={20} color={accent.band} weight="fill" />}
        back="/game/tournament/photo-pose"
      >
        {c ? <Text style={styles.title}>{c.title}</Text> : null}
        <Text style={styles.lead}>
          {closed
            ? "Voting has closed."
            : `Pick your favourite. You can change your vote. ${timingLine({ ...c!, phase: "voting" }, now) ?? ""}`.trim()}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {gallery.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={text.secondary} />
          </View>
        ) : gallery.isError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {poseError((gallery.error as { code?: string }).code)}
            </Text>
            <RaisedButton
              tone="white"
              label="Try again"
              onPress={() => void gallery.refetch()}
              style={styles.retry}
            />
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No photos to vote on yet.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {entries.map((e, i) => (
              <Animated.View
                key={e.id}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeIn.delay(Math.min(i, 8) * 40).duration(
                        motion.duration.enter,
                      )
                }
                style={{ width: tile }}
              >
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`${e.dogName ?? "Entry"}${e.isMine ? ", your photo" : mine === e.id ? ", your vote" : ""}. Open`}
                  scaleTo={0.97}
                  onPress={() => setOpen(i)}
                >
                  <PoseImage url={e.url} failed={!e.url} rounded={18} />
                  {mine === e.id ? (
                    <View style={styles.badge}>
                      <HeartIcon size={14} color={text.primary} weight="fill" />
                    </View>
                  ) : null}
                  {e.isMine ? (
                    <View style={[styles.badge, styles.yours]}>
                      <Text style={styles.yoursText}>Yours</Text>
                    </View>
                  ) : null}
                </PressScale>
                <Text style={styles.name} numberOfLines={1}>
                  {e.dogName ?? " "}
                </Text>
              </Animated.View>
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + space.xl }} />
      </DetailShell>

      <Viewer
        entries={entries}
        index={open}
        mine={mine}
        closed={closed}
        error={error}
        onClose={() => setOpen(null)}
        onVote={vote}
        onReport={report}
      />
    </View>
  );
}

/** Full-screen photos, swipe between them, vote from the bottom. */
const Viewer = ({
  entries,
  index,
  mine,
  closed,
  error,
  onClose,
  onVote,
  onReport,
}: {
  entries: GalleryEntry[];
  index: number | null;
  mine: string | null;
  closed: boolean;
  error: string | null;
  onClose: () => void;
  onVote: (e: GalleryEntry) => void;
  onReport: (e: GalleryEntry) => void;
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState(index ?? 0);
  const list = useRef<FlatList<GalleryEntry>>(null);
  useEffect(() => {
    if (index != null) setAt(index);
  }, [index]);
  const current = entries[at];

  return (
    <Modal
      visible={index != null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.viewer}>
        <FlatList
          ref={list}
          data={entries}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          keyExtractor={(e) => e.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(ev) =>
            setAt(Math.round(ev.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View
              style={{
                width,
                height,
                paddingTop: insets.top + 64,
                paddingBottom: insets.bottom + 120,
                paddingHorizontal: space.lg,
              }}
            >
              {item.url ? (
                <Image
                  source={{ uri: item.url }}
                  style={styles.full}
                  contentFit="contain"
                  accessibilityLabel={item.dogName ?? "Entry"}
                />
              ) : null}
            </View>
          )}
        />
        <View style={[styles.viewerTop, { top: insets.top + space.sm }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.round}
            onPress={onClose}
          >
            <XIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          <Text style={styles.viewerCount}>
            {entries.length ? `${at + 1} of ${entries.length}` : ""}
          </Text>
          {current && !current.isMine ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Report this photo"
              style={styles.round}
              onPress={() => onReport(current)}
            >
              <DotsThreeIcon size={22} color={text.primary} weight="bold" />
            </PressScale>
          ) : (
            <View style={styles.round} />
          )}
        </View>
        {current ? (
          <View
            style={[
              styles.viewerBar,
              { paddingBottom: insets.bottom + space.md },
            ]}
          >
            {error ? (
              <Text style={styles.viewerError} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <View style={styles.viewerRow}>
              <Text style={styles.viewerName} numberOfLines={1}>
                {current.dogName ?? " "}
              </Text>
              {current.isMine ? (
                <Text style={styles.viewerNote}>Your photo</Text>
              ) : closed ? (
                <Text style={styles.viewerNote}>Voting has closed</Text>
              ) : (
                <VoteButton
                  on={mine === current.id}
                  onPress={() => onVote(current)}
                />
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

/** The heart: a short spring when it fills, so a vote feels cast, not toggled. */
const VoteButton = ({ on, onPress }: { on: boolean; onPress: () => void }) => {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? "Your vote" : "Vote for this photo"}
      style={[styles.vote, on && styles.voteOn]}
      onPress={() => {
        if (!on && !reduceMotion)
          pop.value = withSequence(
            withTiming(0.82, { duration: 90 }),
            withSpring(1, { damping: 9, stiffness: 340 }),
          );
        onPress();
      }}
    >
      <Animated.View style={style}>
        <HeartIcon
          size={22}
          color={text.primary}
          weight={on ? "fill" : "bold"}
        />
      </Animated.View>
      <Text style={styles.voteText}>{on ? "Your vote" : "Vote"}</Text>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  title: {
    ...type.sectionTitle,
    fontWeight: "800",
    color: text.primary,
    marginTop: space.xs,
  },
  lead: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  error: { ...type.supporting, color: "#B4432F", marginTop: space.md },
  loading: { height: 300, alignItems: "center", justifyContent: "center" },
  empty: {
    paddingVertical: space.sectionLg,
    alignItems: "center",
    gap: space.md,
  },
  emptyText: { ...type.supporting, color: text.secondary, textAlign: "center" },
  retry: { alignSelf: "stretch" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.xl,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  yours: {
    width: undefined,
    paddingHorizontal: 10,
    left: 8,
    right: undefined,
    backgroundColor: bg.surface,
  },
  yoursText: { fontSize: 12, fontWeight: "800", color: text.primary },
  name: {
    ...type.caption,
    fontWeight: "700",
    color: text.secondary,
    marginTop: 6,
    marginHorizontal: 2,
  },
  viewer: { flex: 1, backgroundColor: bg.canvas },
  full: { flex: 1, borderRadius: radius.card },
  viewerTop: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCount: {
    ...type.supporting,
    fontWeight: "700",
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  viewerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    backgroundColor: bg.canvas,
  },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  viewerError: { ...type.supporting, color: "#B4432F", marginBottom: space.md },
  viewerName: {
    ...type.sectionTitle,
    fontWeight: "800",
    color: text.primary,
    flex: 1,
  },
  viewerNote: { ...type.supporting, fontWeight: "700", color: text.secondary },
  vote: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: accent.band,
    backgroundColor: bg.surface,
  },
  voteOn: { backgroundColor: accent.deep, borderColor: accent.deep },
  voteText: { fontSize: 15, fontWeight: "800", color: text.primary },
});
