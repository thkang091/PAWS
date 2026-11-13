import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CheckCircleIcon, QuestionIcon, ShieldCheckIcon, XCircleIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { PoseImage, chooseFrom } from "@/features/photoPose/components/PoseParts";
import { HELD_FOR_MODERATOR, REJECT_TEXT, REPORT_REASONS, countLabel, poseError } from "@/features/photoPose/copy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { poseKeys, useModerationQueue } from "@/hooks/usePhotoPose";
import { moderate, type QueueItem, type ReportReason } from "@/services/mediaService";
import { accent, bg, motion, radius, space, text, type } from "@/constants/design";

/**
 * Photos waiting for a person: the automatic check was unsure, couldn't see something, players reported the photo,
 * or its owner asked for a review. Reference and entry side by side, the reasons, then approve or reject. Moderators
 * decide whether a photo follows the challenge, never which is best; votes decide that.
 */
export default function PoseModerationScreen() {
  return (
    <OrganizerGate explain={poseError} body="Entries are reviewed by PAWS organizers.">
      <Queue />
    </OrganizerGate>
  );
}

const Queue = () => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const queue = useModerationQueue();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = (queue.data ?? []).filter((i) => !gone.has(i.id));

  const decide = async (item: QueueItem, decision: "approve" | "reject", why?: ReportReason) => {
    setBusy(item.id + decision);
    setError(null);
    try {
      await moderate(item.id, decision, why);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGone((s) => new Set(s).add(item.id));
      void queryClient.invalidateQueries({ queryKey: poseKeys.queue });
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DetailShell title="Review photos" glyph={<ShieldCheckIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/photo-pose">
      <Text style={styles.lead}>Decide only whether each photo follows the challenge and is safe. Votes decide the winner.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {queue.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color={text.secondary} />
        </View>
      ) : queue.isError ? (
        <Text style={styles.empty}>{poseError((queue.error as { code?: string }).code)}</Text>
      ) : items.length === 0 ? (
        <View style={styles.clear}>
          <CheckCircleIcon size={32} color={accent.band} weight="fill" />
          <Text style={styles.clearTitle}>All caught up</Text>
          <Text style={styles.empty}>No photos are waiting.</Text>
        </View>
      ) : (
        items.map((item) => (
          <Animated.View key={item.id} exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)} layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.challenge?.title ?? "Challenge"}
            </Text>
            <View style={styles.pair}>
              <View style={styles.side}>
                <PoseImage url={item.challenge?.referenceUrl} failed={!item.challenge?.referenceUrl} rounded={16} />
                <Text style={styles.label}>Reference</Text>
              </View>
              <View style={styles.side}>
                <PoseImage url={item.url} failed={!item.url} rounded={16} />
                <Text style={styles.label}>{item.dogName ?? "Entry"}</Text>
              </View>
            </View>
            <View style={styles.reasons}>
              {reasonsOf(item).map((r) => (
                <Text key={r} style={styles.reason}>
                  {r}
                </Text>
              ))}
            </View>
            {item.challenge?.criteria.length ? (
              <View style={styles.answers}>
                {item.challenge.criteria.map((c) => {
                  const a = item.check?.answers?.find((x) => x.id === c.id);
                  const Icon = a?.answer === "yes" ? CheckCircleIcon : a?.answer === "no" ? XCircleIcon : QuestionIcon;
                  return (
                    <View key={c.id} style={styles.answer}>
                      <Icon size={15} color={a?.answer === "yes" ? "#2F8F4E" : a?.answer === "no" ? "#B4432F" : text.tertiary} weight="fill" />
                      <Text style={styles.answerText}>{c.label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.actions}>
              <RaisedButton label="Approve" height={50} busy={busy === item.id + "approve"} onPress={() => void decide(item, "approve")} style={styles.half} />
              <RaisedButton label="Reject" tone="white" height={50} busy={busy === item.id + "reject"} onPress={() => chooseFrom("Why reject it?", REPORT_REASONS, (k) => void decide(item, "reject", k as ReportReason), true)} style={styles.half} />
            </View>
          </Animated.View>
        ))
      )}
      <View style={{ height: insets.bottom }} />
    </DetailShell>
  );
};

/** Why this photo is here, in plain words. */
const reasonsOf = (i: QueueItem) => {
  const out: string[] = [];
  if (i.reviewRequested) out.push(i.reviewNote ? `The owner asked for a review: "${i.reviewNote}"` : "The owner asked for a review.");
  if (i.status === "held" && i.heldReason) out.push(`Held by the check: ${HELD_FOR_MODERATOR[i.heldReason]}.`);
  if (i.hiddenByReports || Object.keys(i.reports).length) {
    const parts = Object.entries(i.reports).map(([k, n]) => `${REJECT_TEXT[k] ?? k} (${n})`);
    out.push(`Reported ${countLabel(Object.values(i.reports).reduce((a, b) => a + (b ?? 0), 0), "time", "times")}: ${parts.join(", ")}`);
  }
  if (i.checkStatus === "unclear") out.push("The automatic check wasn't sure.");
  if (i.checkStatus === "unavailable") out.push("The automatic check couldn't run.");
  return out.length ? out : ["Waiting for a person."];
};

const styles = StyleSheet.create({
  lead: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  error: { ...type.supporting, color: "#B4432F", marginTop: space.md },
  loading: { height: 300, alignItems: "center", justifyContent: "center" },
  empty: { ...type.supporting, color: text.secondary, textAlign: "center" },
  clear: { alignItems: "center", gap: space.sm, paddingVertical: space.sectionLg },
  clearTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  card: { marginTop: space.xl, padding: space.lg, borderRadius: 24, backgroundColor: bg.subtle },
  cardTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  pair: { flexDirection: "row", gap: space.md, marginTop: space.md },
  side: { flex: 1 },
  label: { ...type.caption, fontWeight: "700", color: text.secondary, marginTop: 6, textAlign: "center" },
  reasons: { gap: 4, marginTop: space.md },
  reason: { ...type.supporting, color: text.primary },
  answers: { gap: 6, marginTop: space.md, padding: space.md, borderRadius: radius.control, backgroundColor: bg.surface },
  answer: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  answerText: { ...type.caption, color: text.primary, flex: 1 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  half: { flex: 1 },
});
