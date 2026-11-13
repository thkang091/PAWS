import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CameraIcon, FrameCornersIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { FriendCode } from "@/features/rooms/components/OnlineHub";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CriteriaList, PoseFacts, PoseImage, SafetyNote, SectionTitle, StepList } from "@/features/photoPose/components/PoseParts";
import { ENTRY_TEXT, HELD_TEXT, PHASE_LABEL, poseError } from "@/features/photoPose/copy";
import { actionFor, timingLine } from "@/features/photoPose/flow";
import { TournamentStatusBadge, type BadgeKind } from "@/features/tournament/components/TournamentStatusBadge";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { poseKeys, useConcept, useOwnPhotoUrl, usePhotoChallenges, useReferenceUrl } from "@/hooks/usePhotoPose";
import { joinChallenge, type Criterion, type MediaPhase, type MyEntry, type PoseInstructions } from "@/services/mediaService";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";
import { criteriaFor } from "../../../supabase/functions/media/entryCheck";

const BADGE: Record<MediaPhase, BadgeKind> = { entries: "live", voting: "live", registration: "open", upcoming: "upcoming", completed: "finished", cancelled: "cancelled" };

type View_ = {
  title: string;
  brief: string;
  referencePath: string | null;
  i: PoseInstructions;
  criteria: Criterion[];
};

/**
 * One pose: what to photograph, understood in a few seconds. The reference photo leads; steps, framing, what counts
 * and the safety reminder follow. Opened from a challenge (with entry, voting and results) or from the pose library
 * (instructions only, to practise).
 */
export default function PoseScreen() {
  const { challengeId, conceptId } = useLocalSearchParams<{ challengeId?: string; conceptId?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const challenges = usePhotoChallenges();
  const concept = useConcept(challengeId ? undefined : conceptId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const c = challengeId ? (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null : null;
  const now = c ? Date.parse(c.serverNow) : Date.now();
  const v: View_ | null = c
    ? { title: c.title, brief: c.brief, referencePath: c.referencePath, i: c.instructions ?? {}, criteria: criteriaFor(c.instructions?.criteria ?? [], c.requiresOwner) }
    : concept.data
      ? {
          title: concept.data.title,
          brief: concept.data.description,
          referencePath: concept.data.reference_media_path,
          i: {
            difficulty: concept.data.difficulty,
            setupMinutes: concept.data.setup_minutes,
            requiredObjects: concept.data.required_objects,
            framing: concept.data.framing,
            cameraAngle: concept.data.camera_angle,
            steps: concept.data.instructions,
            safety: concept.data.safety_notes,
          },
          criteria: criteriaFor(concept.data.objective_criteria ?? [], true),
        }
      : null;
  const ref = useReferenceUrl(v?.referencePath);
  const baseAction = c ? actionFor(c, now) : null;
  // Seasonal Selfie asks for a selfie, not a pose.
  const action =
    baseAction && c?.game === "seasonal_selfie" && baseAction.kind === "enter" ? { ...baseAction, label: "Take your selfie" }
    : baseAction && c?.game === "seasonal_selfie" && baseAction.kind === "retake" ? { ...baseAction, label: baseAction.tone === "yellow" ? "Retake your selfie" : "Change your selfie" }
    : baseAction;
  const loading = challengeId ? challenges.isPending : concept.isPending;
  const loadError = (challengeId ? (challenges.error as { code?: string } | null) : (concept.error as { code?: string } | null))?.code;

  const onAction = async () => {
    if (!c || !action) return;
    setError(null);
    if (action.kind === "vote") return router.push({ pathname: "/game/tournament/pose-vote", params: { challengeId: c.challengeId } });
    if (action.kind === "results") return router.push({ pathname: "/game/tournament/pose-results", params: { challengeId: c.challengeId } });
    if (action.kind !== "enter" && action.kind !== "retake") return;
    if (!c.joined) {
      setBusy(true);
      try {
        await joinChallenge(c.tournamentId, dog.data?.id ?? null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Promise.all([queryClient.invalidateQueries({ queryKey: poseKeys.challenges }), queryClient.invalidateQueries({ queryKey: poseKeys.seasonal })]);
      } catch (e) {
        setError(poseError((e as { code?: string }).code));
        return;
      } finally {
        setBusy(false);
      }
    }
    router.push({ pathname: "/game/tournament/pose-submit", params: { challengeId: c.challengeId } });
  };

  return (
    <View style={styles.flex}>
      <DetailShell title={c?.game === "seasonal_selfie" ? "Seasonal Selfie" : "Photo Pose"} glyph={<CameraIcon size={20} color={accent.band} weight="fill" />} back={c?.game === "seasonal_selfie" ? "/(tabs)/game" : "/game/tournament/photo-pose"}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={text.secondary} />
          </View>
        ) : !v ? (
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>This pose isn't available</Text>
            <Text style={styles.missingLine}>{loadError ? poseError(loadError) : "It may have finished or been taken down."}</Text>
          </View>
        ) : (
          <>
            {c?.private && c.inviteCode ? <FriendCode code={c.inviteCode} game="Photo Pose" /> : null}
            <View style={[styles.hero, !v.referencePath && styles.heroArt]}>
              {v.referencePath ? (
                <PoseImage url={ref.data} loading={ref.isPending} failed={ref.isError} accessibilityLabel={`Reference photo: ${v.title}`} />
              ) : (
                // No example photo for this one (seasonal themes, starter poses): a calm banner instead of an empty frame.
                <View style={styles.noRef}>
                  <View style={styles.noRefRing}>
                    <CameraIcon size={40} color={text.primary} weight="fill" />
                  </View>
                </View>
              )}
              {c ? (
                <View style={styles.heroBadge}>
                  <TournamentStatusBadge kind={BADGE[c.phase]} label={timingLine(c, now) ?? PHASE_LABEL[c.phase]} />
                </View>
              ) : null}
            </View>
            <Text style={styles.title}>{v.title}</Text>
            {v.brief ? <Text style={styles.brief}>{v.brief}</Text> : null}
            <View style={styles.facts}>
              <PoseFacts difficulty={v.i.difficulty} minutes={v.i.setupMinutes} objects={v.i.requiredObjects ?? []} />
            </View>

            {c?.myEntry ? <EntryCard entry={c.myEntry} /> : null}

            {v.i.steps?.length ? (
              <>
                <SectionTitle>How to</SectionTitle>
                <StepList steps={v.i.steps} />
              </>
            ) : null}

            {v.i.framing || v.i.cameraAngle ? (
              <View style={styles.framing}>
                <FrameCornersIcon size={20} color={text.primary} weight="bold" />
                <View style={styles.flex}>
                  <Text style={styles.framingTitle}>Framing</Text>
                  <Text style={styles.framingText}>{[v.i.cameraAngle, v.i.framing].filter(Boolean).join(". ")}</Text>
                </View>
              </View>
            ) : null}

            <SectionTitle>It counts when</SectionTitle>
            <CriteriaList criteria={v.criteria} />

            <View style={styles.safetyWrap}>
              <SafetyNote notes={v.i.safety?.length ? v.i.safety : ["Let your dog leave the pose whenever they want."]} />
            </View>

            {!c ? <Text style={styles.practice}>Not running as a challenge right now. Practise it, and watch for it in a future one.</Text> : null}
          </>
        )}
        <View style={{ height: action ? 104 + insets.bottom : 0 }} />
      </DetailShell>

      {action ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <RaisedButton label={action.label} sub={action.sub} tone={action.tone} busy={busy} disabled={action.kind === "none"} onPress={() => void onAction()} />
        </View>
      ) : null}
    </View>
  );
}

/** Your entry, its photo and where it stands. */
const EntryCard = ({ entry }: { entry: MyEntry }) => {
  const photo = useOwnPhotoUrl(entry.mediaPath);
  if (entry.status === "withdrawn") return null;
  const copy = ENTRY_TEXT[entry.status];
  const line = entry.status === "held" && entry.heldReason ? HELD_TEXT[entry.heldReason] : entry.status === "pending_review" && entry.hiddenByReports ? "Some players reported it. A moderator will decide." : copy.line;
  return (
    <View style={[styles.entry, entry.status === "approved" && styles.entryOk]}>
      <PoseImage url={photo.data} loading={photo.isPending} aspect={1} rounded={12} style={styles.entryThumb} />
      <View style={styles.flex}>
        <Text style={styles.entryTitle}>{copy.title}</Text>
        <Text style={styles.entryLine}>{line}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroArt: { aspectRatio: undefined, height: 200 },
  noRef: { flex: 1, borderRadius: 28, backgroundColor: "#FBE6D9", alignItems: "center", justifyContent: "center" },
  noRefRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, backgroundColor: "transparent" },
  loading: { height: 420, alignItems: "center", justifyContent: "center" },
  missing: { paddingVertical: space.sectionLg, alignItems: "center", gap: space.sm },
  missingTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  missingLine: { ...type.supporting, color: text.secondary, textAlign: "center" },
  hero: { marginTop: space.sm, borderRadius: 28, overflow: "hidden" },
  heroBadge: { position: "absolute", top: space.md, left: space.md },
  title: { ...type.pageTitle, fontWeight: "800", color: text.primary, marginTop: space.lg },
  brief: { ...type.body, color: text.secondary, marginTop: space.xs },
  facts: { marginTop: space.md },
  entry: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, padding: space.sm, paddingRight: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  entryOk: { backgroundColor: accent.soft },
  entryThumb: { width: 56 },
  entryTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  entryLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  framing: { flexDirection: "row", gap: space.md, marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  framingTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  framingText: { ...type.supporting, color: text.secondary, marginTop: 2 },
  safetyWrap: { marginTop: space.xl },
  practice: { ...type.supporting, color: text.secondary, marginTop: space.xl, textAlign: "center" },
  error: { ...type.supporting, color: "#B4432F", marginBottom: space.md, textAlign: "center" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
