import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { VerificationResultCard } from "@/components/activityVerification/VerificationResultCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useReferenceAssets } from "@/hooks/useReferenceAssets";
import { getErrorMessage } from "@/lib/errors";
import { getRoadmapDay, submitTrainingVideoForGeminiVerification } from "@/services/curriculumService";
import { autoCompleteTrainingTasks } from "@/services/autoCompleteTasksService";
import { useState } from "react";
import type { ReferenceAssetRequirement, ReferenceAssetType } from "@/types/domain";

const ASSET_DISPLAY: Record<string, string> = {
  TARGET_MAT: "Training Mat",
  TARGET_TOY: "Training Toy",
  TARGET_CRATE: "Crate",
  TARGET_BOWL: "Food Bowl",
  TARGET_BASKET: "Toy Basket",
  TARGET_BUTTON: "Button",
  TARGET_BELL: "Bell",
  TARGET_DOORWAY: "Doorway",
  TARGET_PLATFORM: "Platform",
  TARGET_CONE: "Cone",
  TARGET_BOX: "Box",
  TARGET_DRAWER: "Drawer",
  TARGET_PERSON: "Helper Person",
  CUSTOM_OBJECT: "Custom Item",
  DOG_PROFILE: "Dog Profile",
};

const getRequirementAssetType = (requirement: ReferenceAssetRequirement): ReferenceAssetType =>
  requirement.type;

const DIFFICULTY_LABEL: Record<string, string> = {
  LEARN: "Learn",
  REPEAT: "Repeat",
  ADD_DURATION: "Add Duration",
  ADD_DISTANCE: "Add Distance",
  ADD_DISTRACTION: "Add Distraction",
  REAL_LIFE_PROOF: "Real-Life Proof",
  MAINTENANCE: "Maintenance",
  REGRESSION: "Regression",
  BOSS_BATTLE: "Boss Battle",
};

export default function RoadmapActivityDetailScreen() {
  const { dayId, totalDays } = useLocalSearchParams<{ dayId: string; totalDays?: string }>();
  const dog = useCurrentDog();
  const { hasAsset } = useReferenceAssets(dog.data?.id);
  const [stepsVisible, setStepsVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "NEEDS_REVIEW" | null>(null);
  const [retryGuidance, setRetryGuidance] = useState<string | null>(null);

  const dayQuery = useQuery({
    queryKey: ["roadmapDay", dayId],
    queryFn: () => getRoadmapDay(dayId ?? ""),
    enabled: Boolean(dayId),
  });

  if (dog.isLoading || dayQuery.isLoading) {
    return <ScreenContainer centered><LoadingState message="Loading activity..." /></ScreenContainer>;
  }

  const day = dayQuery.data;
  const activity = day?.primaryActivity;

  if (!dog.data || !day || !activity) {
    return <ScreenContainer centered><ErrorState message="Training activity could not load." /></ScreenContainer>;
  }

  const currentDog = dog.data;
  const hasRequiredAssets =
    activity.requiredReferenceAssets.length === 0 ||
    activity.requiredReferenceAssets.every((req) => hasAsset(getRequirementAssetType(req)));

  const chooseVideoForGemini = async () => {
    setSubmitError(null);
    setVerdict(null);
    setRetryGuidance(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset?.uri) return;

    try {
      setSubmitting(true);
      const result = await submitTrainingVideoForGeminiVerification({
        dogId: currentDog.id,
        userId: currentDog.ownerId,
        activityId: activity.id,
        roadmapDayId: day.id,
        uri: asset.uri,
      });
      setVerdict(result.verdict);
      setRetryGuidance(result.retryInstruction ?? result.missingEvidence.join(" "));
      if (result.verdict === "PASS") void autoCompleteTrainingTasks(currentDog.id);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Gemini verification failed. Please try another video."));
    } finally {
      setSubmitting(false);
    }
  };

  const resultStatus =
    verdict === "PASS"
      ? "passed"
      : verdict === "FAIL"
        ? "failed_no_valid_activity"
        : verdict === "NEEDS_REVIEW"
          ? "retry_low_confidence"
          : null;

  const difficultyLabel = DIFFICULTY_LABEL[day.difficultyMode] ?? day.difficultyMode;
  const isBoss = day.difficultyMode === "BOSS_BATTLE";
  const starsCount = activity.starsAvailable ?? 3;

  return (
    <>
      <ScreenContainer scroll>
        {/* Back */}
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to roadmap">
          <Ionicons name="chevron-back" size={18} color={theme.colors.primaryDark} />
          <Text style={styles.backText}>Roadmap</Text>
        </Pressable>

        {/* Hero card */}
        <View style={[styles.hero, isBoss && styles.heroBoss]}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activity.skillFamily}</Text>
            </View>
            <View style={[styles.badge, styles.badgeAlt]}>
              <Text style={styles.badgeText}>{difficultyLabel}</Text>
            </View>
            {isBoss && (
              <View style={[styles.badge, styles.badgeBoss]}>
                <Ionicons name="trophy-outline" size={11} color="#C47A2B" />
                <Text style={[styles.badgeText, styles.badgeBossText]}>Boss Battle</Text>
              </View>
            )}
          </View>
          <Text style={styles.dayLabel}>DAY {day.dayNumber}{totalDays ? ` of ${totalDays}` : ""}</Text>
          <Text style={styles.title}>{activity.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="videocam-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{activity.minClipSeconds}–{activity.maxClipSeconds}s clip</Text>
            <View style={styles.metaDot} />
            <View style={styles.starsRow}>
              {Array.from({ length: starsCount }).map((_, i) => (
                <Ionicons key={i} name="star-outline" size={13} color={theme.colors.gold} />
              ))}
            </View>
          </View>
        </View>

        {/* Rewards */}
        <View style={styles.rewardBar}>
          <View style={styles.rewardChip}>
            <Ionicons name="flash-outline" size={14} color={theme.colors.primaryDark} />
            <Text style={styles.rewardChipText}>+{activity.xpReward} XP</Text>
          </View>
          <View style={[styles.rewardChip, styles.rewardChipSilver]}>
            <Ionicons name="cash-outline" size={14} color={theme.colors.silver} />
            <Text style={[styles.rewardChipText, styles.rewardChipTextSilver]}>Silver on pass</Text>
          </View>
          {(day.difficultyMode === "REAL_LIFE_PROOF" || isBoss) && (
            <View style={[styles.rewardChip, styles.rewardChipLevel]}>
              <Ionicons name="trending-up-outline" size={14} color={theme.colors.primaryDark} />
              <Text style={[styles.rewardChipText, styles.rewardChipTextLevel]}>Level up possible</Text>
            </View>
          )}
        </View>

        {/* Why picked */}
        {day.reasonSelected ? (
          <View style={styles.whyCard}>
            <Text style={styles.sectionLabel}>WHY PAWS PICKED THIS</Text>
            <Text style={styles.bodyText}>{day.reasonSelected}</Text>
          </View>
        ) : null}

        {/* AI Checkpoint */}
        <View style={styles.checkpointCard}>
          <View style={styles.rowHeader}>
            <Ionicons name="camera-outline" size={15} color={theme.colors.primaryDark} />
            <Text style={styles.sectionLabel}>AI CHECKPOINT</Text>
          </View>
          <Text style={styles.bodyText}>{activity.visibleCheckpoint}</Text>
        </View>

        {/* Reference assets */}
        {activity.requiredReferenceAssets.length > 0 && (
          <View style={styles.assetsCard}>
            <Text style={styles.sectionLabel}>REFERENCE SETUP</Text>
            <View style={styles.assetsRow}>
              {activity.requiredReferenceAssets.map((req) => {
                const type = getRequirementAssetType(req);
                const ready = hasAsset(type);
                return (
                  <Pressable
                    key={type}
                    style={[styles.assetChip, ready ? styles.assetReady : styles.assetMissing]}
                    onPress={!ready ? () => router.push(`/train/reference-setup/${type}`) : undefined}
                    accessibilityRole={ready ? "text" : "button"}
                    accessibilityLabel={ready ? `${ASSET_DISPLAY[type] ?? type} ready` : `Set up ${ASSET_DISPLAY[type] ?? type}`}
                  >
                    <Ionicons name={ready ? "checkmark-circle" : "alert-circle-outline"} size={13} color={ready ? theme.colors.success : theme.colors.warning} />
                    <Text style={[styles.assetText, ready ? styles.assetTextReady : styles.assetTextMissing]}>{ASSET_DISPLAY[type] ?? type}</Text>
                    {!ready && <Ionicons name="chevron-forward" size={11} color={theme.colors.warning} />}
                  </Pressable>
                );
              })}
            </View>
            {!hasRequiredAssets && (
              <Text style={styles.assetsHint}>
                Tap a missing item above to upload its reference photo. Gemini needs it to verify your video.
              </Text>
            )}
          </View>
        )}

        {/* Steps summary (inline, collapsible) */}
        {activity.tutorialSteps?.length > 0 && (
          <Pressable style={styles.stepsToggle} onPress={() => setStepsVisible((v) => !v)}>
            <Text style={styles.stepsToggleText}>Training steps</Text>
            <Ionicons name={stepsVisible ? "chevron-up" : "chevron-down"} size={15} color={theme.colors.primaryDark} />
          </Pressable>
        )}
        {stepsVisible && (
          <View style={styles.stepsList}>
            {activity.tutorialSteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, !hasRequiredAssets && styles.submitBtnWarn, submitting && styles.submitBtnLoading]}
          onPress={chooseVideoForGemini}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Choose video for Gemini review"
        >
          <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.white} />
          <Text style={styles.submitText}>{submitting ? "Submitting..." : "Choose Video"}</Text>
        </Pressable>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
        {verdict ? <View style={styles.verdictBadge}><Ionicons name={verdict === "PASS" ? "checkmark-circle" : verdict === "FAIL" ? "close-circle" : "time-outline"} size={18} color={verdict === "PASS" ? theme.colors.success : verdict === "FAIL" ? theme.colors.error : theme.colors.warning} /><Text style={styles.verdictText}>{verdict}</Text></View> : null}
        {resultStatus ? <VerificationResultCard status={resultStatus} retryGuidance={retryGuidance} /> : null}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  backText: { color: theme.colors.primaryDark, fontSize: theme.typography.sm, fontWeight: "900" },

  hero: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.sm, borderWidth: 1.5, borderColor: theme.colors.border, ...theme.shadows.soft },
  heroBoss: { borderColor: theme.colors.gold + "88", backgroundColor: theme.colors.goldSoft + "55" },
  badgeRow: { flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" },
  badge: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 10, paddingVertical: 3 },
  badgeAlt: { backgroundColor: theme.colors.accentSoft },
  badgeBoss: { backgroundColor: theme.colors.goldSoft, flexDirection: "row", alignItems: "center", gap: 3 },
  badgeText: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.primaryDark },
  badgeBossText: { color: "#C47A2B" },
  dayLabel: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark, letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: theme.typography.xl, fontWeight: "900", color: theme.colors.text, lineHeight: 28 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "600" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.colors.borderStrong },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },

  rewardBar: { flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" },
  rewardChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6 },
  rewardChipSilver: { backgroundColor: theme.colors.silverSoft },
  rewardChipLevel: { backgroundColor: theme.colors.primarySoft },
  rewardChipText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.primaryDark },
  rewardChipTextSilver: { color: theme.colors.silver },
  rewardChipTextLevel: { color: theme.colors.primaryDark },

  whyCard: { backgroundColor: theme.colors.backgroundSoft, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: theme.spacing.xs, borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  checkpointCard: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: theme.spacing.sm },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  sectionLabel: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark, textTransform: "uppercase", letterSpacing: 0.5 },
  bodyText: { fontSize: theme.typography.sm, color: theme.colors.text, lineHeight: 20 },

  assetsCard: { gap: theme.spacing.sm },
  assetsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  assetChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5 },
  assetReady: { backgroundColor: theme.colors.successSoft, borderColor: theme.colors.success + "44" },
  assetMissing: { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning + "44" },
  assetText: { fontSize: theme.typography.xs, fontWeight: "700" },
  assetTextReady: { color: theme.colors.success },
  assetTextMissing: { color: theme.colors.warning },
  assetsHint: { fontSize: theme.typography.xs, color: theme.colors.textMuted },

  stepsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  stepsToggleText: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.primaryDark },
  stepsList: { gap: theme.spacing.md, paddingBottom: theme.spacing.md },
  stepRow: { flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText: { color: theme.colors.primaryDark, fontSize: theme.typography.sm, fontWeight: "900" },
  stepText: { flex: 1, fontSize: theme.typography.sm, color: theme.colors.text, lineHeight: 21, paddingTop: 3 },

  submitBtn: { minHeight: 52, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  submitBtnWarn: { backgroundColor: theme.colors.secondary },
  submitBtnLoading: { opacity: 0.65 },
  submitText: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.white },

  errorText: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "900", textAlign: "center" },
  verdictBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  verdictText: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text },
});
