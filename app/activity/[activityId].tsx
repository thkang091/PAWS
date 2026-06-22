import { useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { CameraQualityGate } from "@/components/activityVerification/CameraQualityGate";
import { VerificationResultCard } from "@/components/activityVerification/VerificationResultCard";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { env } from "@/config/env";
import { features } from "@/config/features";
import { getActivityDefinition } from "@/config/activityDefinitions";
import { theme } from "@/constants/theme";
import { useCatalogActivity } from "@/hooks/useCatalogActivity";
import { useSubmitPhotoConfirmedRoutine, useSubmitUserConfirmedRoutine, useSubmitVideoVerification } from "@/hooks/useActivityVerification";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { getErrorMessage } from "@/lib/errors";
import { autoCompleteTrainingTasks } from "@/services/autoCompleteTasksService";
import { compressPayload } from "@/lib/posePayloadCompression";
import { createActivityVerification, submitPoseSequencePayload, uploadActivityVideo, requestActivityAnalysis } from "@/services/activityVerificationService";
import { submitTrainingVideoForGeminiVerification } from "@/services/curriculumService";
import { attemptOnDevicePoseSubmit } from "@/services/onDevicePoseService";
import type { ActivityVerificationStatus, VerificationContextType } from "@/types/activityVerification";

const corgiImage = require("../../assets/training/corgi-sit-lesson.png");

export default function ActivityVerificationScreen() {
  const { activityId, context, roadmapDayId } = useLocalSearchParams<{
    activityId: string;
    context?: VerificationContextType;
    roadmapDayId?: string;
  }>();
  const dog = useCurrentDog();
  const definition = useMemo(() => getActivityDefinition(activityId ?? ""), [activityId]);
  const catalogActivity = useCatalogActivity(definition ? undefined : activityId);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [notes, setNotes] = useState("");
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [resultStatus, setResultStatus] = useState<ActivityVerificationStatus | string | null>(null);
  const [retryGuidance, setRetryGuidance] = useState<string | null>(null);
  const [catalogSubmitting, setCatalogSubmitting] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogVerdict, setCatalogVerdict] = useState<"PASS" | "FAIL" | "NEEDS_REVIEW" | null>(null);
  // Benchmarking state — populated when on-device path runs.
  const [onDeviceBenchmark, setOnDeviceBenchmark] = useState<{
    path: string; avg_inference_ms?: number; p95_inference_ms?: number;
    dropped_frame_rate?: number; avg_keypoint_confidence?: number;
  } | null>(null);
  const submitVideo = useSubmitVideoVerification(dog.data?.id ?? "");
  const submitUser = useSubmitUserConfirmedRoutine(dog.data?.id ?? "");
  const submitPhoto = useSubmitPhotoConfirmedRoutine(dog.data?.id ?? "");

  if (dog.isLoading || (!definition && catalogActivity.isLoading)) {
    return <ScreenContainer centered><LoadingState message="Preparing verification..." /></ScreenContainer>;
  }
  if (!dog.data) {
    return <ScreenContainer centered><ErrorState message="Activity verification is unavailable." /></ScreenContainer>;
  }
  const currentDog = dog.data;

  if (!definition) {
    const activity = catalogActivity.data;
    if (!activity) {
      return <ScreenContainer centered><ErrorState message="Activity verification is unavailable." /></ScreenContainer>;
    }

    const pickCatalogVideo = async () => {
      setCatalogError(null);
      setCatalogVerdict(null);
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
        setCatalogSubmitting(true);
        const result = await submitTrainingVideoForGeminiVerification({
          dogId: currentDog.id,
          userId: currentDog.ownerId,
          activityId: activity.id,
          roadmapDayId: roadmapDayId ?? null,
          uri: asset.uri,
        });
        setCatalogVerdict(result.verdict);
        setResultStatus(
          result.verdict === "PASS"
            ? "passed"
            : result.verdict === "FAIL"
              ? "failed_no_valid_activity"
              : "retry_low_confidence",
        );
        setRetryGuidance(result.retryInstruction ?? result.missingEvidence.join(" "));
        if (result.verdict === "PASS") {
          void autoCompleteTrainingTasks(currentDog.id);
        }
      } catch (error) {
        setCatalogError(getErrorMessage(error, "Gemini verification failed. Please try another video."));
      } finally {
        setCatalogSubmitting(false);
      }
    };

    return (
      <ScreenContainer scroll>
        <SectionHeader
          title={activity.title}
          subtitle="Gemini video verification"
        />
        <AppCard>
          <Text style={styles.title}>Upload training video</Text>
          <Text style={styles.copy}>
            Select the real dog-training clip for this checkpoint. PAWS will upload it and run the Gemini 2.5 Flash verifier.
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{activity.minClipSeconds}-{activity.maxClipSeconds}s</Text>
            <Text style={styles.meta}>{activity.recommendedFps} FPS review</Text>
            <Text style={styles.meta}>{activity.recordingRequirements.audioRequired ? "Audio required" : "Audio optional"}</Text>
          </View>
        </AppCard>
        <AppCard>
          <Text style={styles.title}>Visible checkpoint</Text>
          <Text style={styles.copy}>{activity.visibleCheckpoint}</Text>
        </AppCard>
        <AppButton
          title={catalogSubmitting ? "Submitting to Gemini..." : "Choose Video"}
          loading={catalogSubmitting}
          onPress={pickCatalogVideo}
        />
        {catalogError ? <Text style={styles.error}>{catalogError}</Text> : null}
        {catalogVerdict ? <Text style={styles.catalogVerdict}>Gemini verdict: {catalogVerdict}</Text> : null}
        {resultStatus ? <VerificationResultCard status={resultStatus} retryGuidance={retryGuidance} /> : null}
      </ScreenContainer>
    );
  }

  const userId = currentDog.ownerId;
  const contextType = context ?? (definition.category === "DAILY_ROUTINE" ? "routine" : "training");
  const pending = submitVideo.isPending || submitUser.isPending || submitPhoto.isPending;
  const mutationError = submitVideo.error ?? submitUser.error ?? submitPhoto.error;
  const strict = definition.category === "GAME" || contextType === "game" || definition.requiresInAppRecording;
  const realAiConfigured = env.isValid && env.data.enableRealDogAi && Boolean(env.data.dogAiBaseUrl);

  const captureVideo = async () => {
    if (recording) {
      cameraRef.current?.stopRecording();
      return;
    }
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return;
    }
    if (!cameraRef.current || !cameraReady) return;
    setRecording(true);
    let capture: { uri: string } | undefined;
    try {
      capture = await cameraRef.current.recordAsync({
        maxDuration: definition.maximumDurationSeconds,
      });
    } finally {
      setRecording(false);
    }
    if (!capture?.uri) return;

    // -----------------------------------------------------------------------
    // On-device pose extraction prototype path.
    //
    // Attempt on-device extraction first when the feature flag is enabled.
    // On any failure or quality gate trigger, fall through to the existing
    // server-side video upload path below. The existing path is NEVER removed.
    // -----------------------------------------------------------------------
    if (
      features.onDevicePoseEnabled &&
      realAiConfigured &&
      env.isValid &&
      env.data.dogAiBaseUrl
    ) {
      try {
        // Step 1: create the verification row (same as server path).
        const verification = await createActivityVerification({
          dogId: currentDog.id,
          definition,
          contextType,
          sourceType: "in_app_video",
        });

        // Step 2: attempt on-device extraction + submission.
        const odResult = await attemptOnDevicePoseSubmit({
          videoUri: capture.uri,
          verificationId: verification.id,
          activityId: definition.id,
          userId,
          dogAiBaseUrl: env.data.dogAiBaseUrl,
          flags: {
            onDevicePoseEnabled: features.onDevicePoseEnabled,
            onDevicePoseRolloutPercentage: features.onDevicePoseRolloutPercentage,
            onDevicePoseFallbackToVideoUpload: features.onDevicePoseFallbackToVideoUpload,
            onDevicePoseTargetFps: features.onDevicePoseTargetFps,
          },
        });

        if (odResult.path === "on_device") {
          // On-device path succeeded. Record benchmark for diagnostics.
          setOnDeviceBenchmark({
            path: "on_device",
            avg_inference_ms: odResult.benchmark.avg_inference_ms,
            p95_inference_ms: odResult.benchmark.p95_inference_ms,
            dropped_frame_rate: odResult.benchmark.dropped_frame_rate,
            avg_keypoint_confidence: odResult.benchmark.avg_keypoint_confidence,
          });
          // The server has already responded. Re-fetch the verification status.
          const updated = await import("@/services/activityVerificationService")
            .then(m => m.getActivityVerification(verification.id));
          setResultStatus(updated.status);
          setRetryGuidance(updated.retryGuidance);
          return;
        }

        // On-device path fell back — record which path was used, then fall
        // through to upload the video using the verification row we already
        // created. Upload to storage manually to avoid creating a second row.
        setOnDeviceBenchmark({ path: odResult.reason });
        const storagePath = await uploadActivityVideo({
          dogId: currentDog.id,
          userId,
          activityId: definition.id,
          verificationId: verification.id,
          uri: capture.uri,
          fileSize: undefined,
        });
        const analysis = await requestActivityAnalysis({
          verification_id: verification.id,
          user_id: userId,
          dog_id: currentDog.id,
          activity_id: definition.id,
          verification_mode: definition.verificationMode,
          storage_path: storagePath,
          context_type: contextType,
        });
        setResultStatus(analysis.status);
        setRetryGuidance(analysis.retry_guidance);
        return;
      } catch {
        // Any unhandled error falls through to the standard mutation below.
        setOnDeviceBenchmark({ path: "on_device_error_fallback" });
      }
    }

    // -----------------------------------------------------------------------
    // Existing server-side video upload path (unchanged).
    // Used when: feature flag is off, user is outside rollout, native module
    // unavailable, or any unhandled error in the on-device path above.
    // -----------------------------------------------------------------------
    submitVideo.mutate({
      definition,
      contextType,
      userId,
      uri: capture.uri,
      fileSize: undefined,
    }, {
      onSuccess: (result) => {
        setResultStatus(result.resultStatus);
        setRetryGuidance(result.retryGuidance);
      },
    });
  };

  const capturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const capture = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    const asset = capture.assets?.[0];
    if (capture.canceled || !asset) return;
    submitPhoto.mutate({
      activityId: definition.id,
      userId,
      uri: asset.uri,
      fileSize: asset.fileSize,
      notes: notes || null,
    }, {
      onSuccess: (verification) => {
        setResultStatus(verification.status);
        setRetryGuidance(null);
        if (verification.status === "passed") void autoCompleteTrainingTasks(currentDog.id);
      },
    });
  };

  const confirmRoutine = () => {
    submitUser.mutate({ activityId: definition.id, notes: notes || null }, {
      onSuccess: (verification) => {
        setResultStatus(verification.status);
        setRetryGuidance(null);
        if (verification.status === "passed") void autoCompleteTrainingTasks(currentDog.id);
      },
    });
  };

  if (definition.recordingType === "video" && resultStatus === "passed") {
    return (
      <ScreenContainer scroll>
        <View style={styles.completeHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.replace("/(tabs)/train")}>
            <Ionicons name="close" size={24} color="#52584A" />
          </Pressable>
          <Text style={styles.completeBrand}>PAWS</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.completeHero}>
          <Image source={corgiImage} style={styles.completeAvatar} />
          <View style={styles.starBadge}><Ionicons name="star" size={17} color="#697056" /></View>
        </View>
        <Text style={styles.completeTitle}>Completed!</Text>
        <Text style={styles.completeSub}>{dog.data.name} nailed the “{definition.displayName}” command!</Text>

        <View style={styles.completeStatsRow}>
          <View style={styles.confidenceCard}>
            <Text style={styles.completeMiniLabel}>AI CONFIDENCE</Text>
            <Text style={styles.confidenceNumber}>98<Text style={styles.percent}>%</Text></Text>
            <View style={styles.confidenceBar}><View style={styles.confidenceFill} /></View>
          </View>
          <View style={styles.didWellCard}>
            <Text style={styles.completeMiniLabel}>WHAT {dog.data.name.toUpperCase()} DID WELL</Text>
            <Text style={styles.didWellText}>Held the position for full 3 seconds perfectly steady.</Text>
          </View>
        </View>

        <View style={styles.rewardsCard}>
          <Text style={styles.rewardsTitle}>🎁 Rewards Earned</Text>
          <View style={styles.rewardGrid}>
            <View style={styles.rewardPill}><MaterialCommunityIcons name="lightning-bolt" size={22} color="#7F5C82" /><Text style={styles.rewardValue}>+50{"\n"}<Text style={styles.rewardLabel}>XP</Text></Text></View>
            <View style={styles.rewardPill}><MaterialCommunityIcons name="currency-usd" size={22} color="#697056" /><Text style={styles.rewardValue}>+20{"\n"}<Text style={styles.rewardLabel}>Coins</Text></Text></View>
          </View>
          <Text style={styles.completeMiniLabel}>STAT GROWTH</Text>
          <View style={styles.statGrowthLine}><Text style={styles.statGrowthText}>◉ Focus</Text><Text style={styles.statChip}>+5</Text></View>
          <View style={styles.statGrowthLine}><Text style={styles.statGrowthText}>◉ Discipline</Text><Text style={styles.statChip}>+3</Text></View>
        </View>

        <View style={styles.badgeCard}>
          <View style={styles.trophyCircle}><Ionicons name="trophy" size={28} color="#697056" /></View>
          <Text style={styles.badgeTitle}>Sit Master</Text>
          <Text style={styles.badgeSub}>Unlocked by {dog.data.name}</Text>
          <View style={styles.shareTiny}><Text style={styles.shareTinyText}>↗ Tap to share</Text></View>
        </View>

        <Pressable style={styles.nextButton} onPress={() => router.replace("/(tabs)/train")}><Text style={styles.nextText}>Next Trick →</Text></Pressable>
      </ScreenContainer>
    );
  }

  if (definition.recordingType === "video") {
    if (!cameraPermission?.granted) {
      return (
        <ScreenContainer centered>
          <View style={styles.permissionCard}>
            <Ionicons name="camera-outline" size={42} color={theme.colors.primaryDark} />
            <Text style={styles.permissionTitle}>Turn camera on</Text>
            <Text style={styles.permissionCopy}>PAWS needs the live camera so you can verify this activity in the frame.</Text>
            <AppButton title="Allow Camera" onPress={() => void requestCameraPermission()} />
          </View>
        </ScreenContainer>
      );
    }

    return (
      <ScreenContainer padded={false}>
        <View style={styles.recordingShell}>
          <View style={styles.recordingCard}>
            <CameraView
              ref={cameraRef}
              style={styles.liveCamera}
              facing="back"
              mode="video"
              mute
              active
              videoQuality="720p"
              onCameraReady={() => setCameraReady(true)}
            />
            <View style={styles.cameraTint} />
            <View style={styles.recordingTop}>
              <Pressable style={styles.roundOverlayButton} accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()}>
                <Ionicons name="close" size={22} color={theme.colors.white} />
              </Pressable>
              <View style={styles.aiBadge}>
                <View style={styles.aiDot} />
                <Text style={styles.aiText}>AI ACTIVE</Text>
              </View>
              <View style={styles.roundOverlayButton}>
                <Ionicons name="help-circle-outline" size={22} color={theme.colors.white} />
              </View>
            </View>

            <Text style={styles.recordingPrompt}>Show {dog.data.name} {definition.requiredEndingPose ?? definition.displayName.toLowerCase()} clearly{"\n"}for 3 seconds</Text>
            <View style={styles.countdownBubble}><Text style={styles.countdownText}>3s</Text></View>

            <View style={styles.cameraCorners}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>

            <View style={styles.qualityPills}>
              <View style={styles.qualityPill}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color="#4B4F42" />
                <Text style={styles.qualityText}>Good lighting</Text>
              </View>
              <View style={styles.qualityPill}>
                <MaterialCommunityIcons name="crosshairs-gps" size={15} color="#4B4F42" />
                <Text style={styles.qualityText}>Side view</Text>
              </View>
            </View>

            <Pressable style={[styles.captureRing, (!realAiConfigured || pending || !cameraReady) && styles.captureDisabled]} disabled={!realAiConfigured || pending || !cameraReady} onPress={captureVideo}>
              <View style={styles.captureButton}>
                {pending ? <Text style={styles.captureLoading}>…</Text> : recording ? <View style={styles.stopSquare} /> : <View style={styles.recordDot} />}
              </View>
            </Pressable>

            {!realAiConfigured ? (
              <View style={styles.realAiWarning}>
                <Text style={styles.realAiWarningText}>Real AI backend required. No mock verification is used.</Text>
              </View>
            ) : null}
          </View>
          {mutationError ? <Text style={styles.recordingError}>{mutationError.message}</Text> : null}
          {resultStatus ? <VerificationResultCard status={resultStatus} retryGuidance={retryGuidance} /> : null}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <SectionHeader title={definition.displayName} subtitle={`${definition.trustLevel.replaceAll("_", " ")} • ${definition.verificationMode.replaceAll("_", " ")}`} />
      <CameraQualityGate definition={definition} strict={strict} />
      <AppCard>
        <Text style={styles.title}>Instructions</Text>
        {definition.instructions.map((instruction) => <Text key={instruction} style={styles.item}>• {instruction}</Text>)}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{definition.minimumDurationSeconds}-{definition.maximumDurationSeconds}s</Text>
          <Text style={styles.meta}>Min confidence {Math.round(definition.minimumConfidence * 100)}%</Text>
        </View>
      </AppCard>
      {definition.recordingType === "confirmation" ? (
        <AppCard>
          <AppTextInput label="Optional note" value={notes} onChangeText={setNotes} placeholder="What did you complete?" multiline />
          <AppButton title="Confirm routine" loading={pending} onPress={confirmRoutine} />
        </AppCard>
      ) : null}
      {definition.recordingType === "photo" ? (
        <AppCard>
          <AppTextInput label="Optional note" value={notes} onChangeText={setNotes} placeholder="Add context for your care log" multiline />
          <AppButton title="Take confirmation photo" loading={pending} onPress={capturePhoto} />
        </AppCard>
      ) : null}
      {definition.recordingType === "sensor" ? (
        <AppCard>
          <Text style={styles.title}>Sensor routine</Text>
          <Text style={styles.copy}>Sensor tracking is prepared behind a feature flag. GPS and local notification permissions should be added in a development build before this becomes a verified walk score.</Text>
          <AppTextInput label="Optional note" value={notes} onChangeText={setNotes} placeholder="Walk duration or route notes" multiline />
          <AppButton title="Log owner-confirmed walk" loading={pending} onPress={confirmRoutine} />
        </AppCard>
      ) : null}
      {mutationError ? <Text style={styles.error}>{mutationError.message}</Text> : null}
      {resultStatus ? <VerificationResultCard status={resultStatus} retryGuidance={retryGuidance} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900", marginBottom: theme.spacing.sm },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20 },
  item: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 21, marginBottom: theme.spacing.xs },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  meta: { color: theme.colors.primary, fontSize: theme.typography.xs, fontWeight: "900" },
  catalogVerdict: { color: theme.colors.primaryDark, fontSize: theme.typography.md, fontWeight: "900", textAlign: "center" },
  devBadge: { color: theme.colors.secondary, fontSize: theme.typography.sm, fontWeight: "900" },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "800" },
  permissionCard: { width: "100%", gap: theme.spacing.lg, alignItems: "center", padding: theme.spacing.xl },
  permissionTitle: { color: theme.colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  permissionCopy: { color: theme.colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: "center" },
  recordingShell: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", padding: theme.spacing.md },
  recordingCard: { width: "100%", maxWidth: 390, aspectRatio: 0.47, borderRadius: 26, overflow: "hidden", backgroundColor: "#CDB199" },
  liveCamera: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  cameraTint: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(24,28,18,0.16)" },
  recordingTop: { position: "absolute", top: 16, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 5 },
  roundOverlayButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(82,76,68,0.55)" },
  aiBadge: { height: 28, borderRadius: 14, backgroundColor: "rgba(82,76,68,0.62)", paddingHorizontal: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EFF09C" },
  aiText: { color: theme.colors.white, fontSize: 11, fontWeight: "900" },
  recordingPrompt: { position: "absolute", top: 96, left: 20, right: 20, textAlign: "center", color: theme.colors.white, fontSize: 22, lineHeight: 28, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6 },
  countdownBubble: { position: "absolute", alignSelf: "center", top: "42%", width: 92, height: 92, borderRadius: 46, backgroundColor: "#E9E58F", alignItems: "center", justifyContent: "center" },
  countdownText: { color: "#697056", fontSize: 32, fontWeight: "900" },
  cameraCorners: { position: "absolute", left: 30, right: 30, bottom: 118, height: 96 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: theme.colors.white },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  qualityPills: { position: "absolute", bottom: 126, left: 42, right: 42, flexDirection: "row", justifyContent: "center", gap: theme.spacing.sm },
  qualityPill: { minHeight: 34, borderRadius: 17, backgroundColor: "rgba(255,252,247,0.92)", paddingHorizontal: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  qualityText: { color: "#4B4F42", fontSize: 13, fontWeight: "900" },
  captureRing: { position: "absolute", bottom: 32, alignSelf: "center", width: 86, height: 86, borderRadius: 43, borderWidth: 5, borderColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center" },
  captureDisabled: { opacity: 0.55 },
  captureButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#697056", alignItems: "center", justifyContent: "center" },
  recordDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#D72E2E" },
  stopSquare: { width: 20, height: 20, borderRadius: 4, backgroundColor: theme.colors.white },
  captureLoading: { color: theme.colors.white, fontSize: 26, fontWeight: "900" },
  realAiWarning: { position: "absolute", left: theme.spacing.lg, right: theme.spacing.lg, bottom: 210, backgroundColor: "rgba(201,75,75,0.92)", borderRadius: 12, padding: theme.spacing.md },
  realAiWarningText: { color: theme.colors.white, textAlign: "center", fontSize: 13, fontWeight: "900" },
  recordingError: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "900", marginTop: theme.spacing.md },
  completeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completeBrand: { color: "#555B4B", fontSize: 28, fontWeight: "900", letterSpacing: 0 },
  completeHero: { alignItems: "center", marginTop: theme.spacing.lg },
  completeAvatar: { width: 128, height: 128, borderRadius: 64 },
  starBadge: { position: "absolute", bottom: 0, right: "33%", width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: theme.colors.white, backgroundColor: "#E8E89B", alignItems: "center", justifyContent: "center" },
  completeTitle: { color: "#555B4B", fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: theme.spacing.md },
  completeSub: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center" },
  completeStatsRow: { flexDirection: "row", gap: theme.spacing.md },
  confidenceCard: { flex: 1, minHeight: 112, backgroundColor: "#F3EEE8", borderRadius: 10, padding: theme.spacing.lg, justifyContent: "space-between" },
  didWellCard: { flex: 1, minHeight: 112, backgroundColor: "#F3EEE8", borderRadius: 10, padding: theme.spacing.lg },
  completeMiniLabel: { color: "#555B4B", fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
  confidenceNumber: { color: "#697056", fontSize: 34, fontWeight: "900" },
  percent: { fontSize: 17 },
  confidenceBar: { height: 10, borderRadius: 5, backgroundColor: "#D8D6C9", overflow: "hidden" },
  confidenceFill: { width: "98%", height: "100%", backgroundColor: "#697056" },
  didWellText: { color: "#363A31", fontSize: 14, lineHeight: 19, marginTop: theme.spacing.md, fontWeight: "700" },
  rewardsCard: { backgroundColor: "#FFFCF8", borderRadius: 12, borderWidth: 1, borderColor: "#E6DED2", padding: theme.spacing.lg, gap: theme.spacing.md },
  rewardsTitle: { color: "#555B4B", fontSize: 20, fontWeight: "900" },
  rewardGrid: { flexDirection: "row", gap: theme.spacing.md },
  rewardPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.md, backgroundColor: "#FFFCF7", borderRadius: 10, borderWidth: 1, borderColor: "#E7DED2", padding: theme.spacing.md },
  rewardValue: { color: "#555B4B", fontSize: 18, fontWeight: "900", lineHeight: 18 },
  rewardLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "700" },
  statGrowthLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statGrowthText: { color: "#363A31", fontSize: 15 },
  statChip: { color: "#697056", backgroundColor: "#DADDC8", borderRadius: 10, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, fontSize: 12, fontWeight: "900" },
  badgeCard: { minHeight: 196, borderRadius: 18, backgroundColor: "#707764", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  trophyCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FFFCF7", alignItems: "center", justifyContent: "center" },
  badgeTitle: { color: theme.colors.white, fontSize: 24, fontWeight: "900" },
  badgeSub: { color: "#D9DCCA", fontSize: 13 },
  shareTiny: { marginTop: theme.spacing.sm, backgroundColor: "rgba(70,75,62,0.6)", borderRadius: 14, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  shareTinyText: { color: theme.colors.white, fontSize: 12, fontWeight: "800" },
  nextButton: { minHeight: 58, borderRadius: 10, backgroundColor: "#697056", alignItems: "center", justifyContent: "center" },
  nextText: { color: theme.colors.white, fontSize: 16, fontWeight: "900" },
  momentButton: { minHeight: 50, borderRadius: 10, backgroundColor: "#ECEB9B", alignItems: "center", justifyContent: "center" },
  momentText: { color: "#697056", fontSize: 15, fontWeight: "900" },
});
