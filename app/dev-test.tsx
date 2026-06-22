/**
 * Developer AI Test Screen
 *
 * Three inference modes:
 *   Mock     - instant JSON response, no real AI needed
 *   Real     - DeepLabCut pose estimation + geometry classifier
 *   VLM      - Mistral Pixtral vision model, prompt-based, ~3-5 seconds
 *
 * Only accessible in development builds (__DEV__ === true).
 */

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { env } from "@/config/env";
import { theme } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InferenceMode = "mock" | "real" | "vlm";

type Stage =
  | "idle"
  | "picking"
  | "uploading"
  | "analyzing"
  | "done"
  | "error";

type ModuleOutput = {
  module_name: string;
  implementation_status: string;
  passed: boolean | null;
  confidence: number | null;
  reason_codes: string[];
  latency_ms: number;
};

type AnalysisResult = {
  verification_id: string;
  activity_id: string;
  status: string;
  confidence_score: number | null;
  model_name: string | null;
  failure_reason: string | null;
  retry_guidance: string | null;
  analysis_summary: Record<string, unknown> | null;
  module_outputs?: ModuleOutput[];
};

type VlmResult = {
  verdict: "pass" | "fail" | "error";
  confidence: number;
  reasoning: string;
  model: string;
  latency_ms: number;
  frame_count: number;
  preview_frames: string[];
  verification_id: string;
  activity_prompt: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_OPTIONS = ["sit", "down", "paw", "spin", "stay"];
const TIER_OPTIONS = ["standard_daily", "premium_challenge", "gold_coin_reward"];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DevTestScreen() {
  const [selectedActivity, setSelectedActivity] = useState("sit");
  const [selectedTier, setSelectedTier] = useState("standard_daily");
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>("mock");
  const [vlmPrompt, setVlmPrompt] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageLabel, setStageLabel] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [vlmResult, setVlmResult] = useState<VlmResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Pick or record video
  // -------------------------------------------------------------------------

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    setStage("picking");
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      setStage("idle");
      return;
    }
    setVideoUri(picked.assets[0].uri);
    setResult(null);
    setVlmResult(null);
    setErrorMessage(null);
    setStage("idle");
  }, []);

  const recordVideo = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    setStage("picking");
    const recorded = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 10,
      quality: 1,
    });
    if (recorded.canceled || !recorded.assets?.[0]) {
      setStage("idle");
      return;
    }
    setVideoUri(recorded.assets[0].uri);
    setResult(null);
    setVlmResult(null);
    setErrorMessage(null);
    setStage("idle");
  }, []);

  // -------------------------------------------------------------------------
  // Upload + analyze
  // -------------------------------------------------------------------------

  const runAnalysis = useCallback(async () => {
    if (!videoUri) return;

    const verificationId = `dev-test-${Date.now()}`;

    try {
      const baseUrl = env.isValid ? env.data.dogAiBaseUrl : null;
      if (!baseUrl) {
        throw new Error(
          "EXPO_PUBLIC_DOG_AI_BASE_URL is not set.\n\nAdd it to your .env.local:\n" +
            "EXPO_PUBLIC_DOG_AI_BASE_URL=http://<your-mac-ip>:8000",
        );
      }

      // ---- VLM mode --------------------------------------------------------
      if (inferenceMode === "vlm") {
        const prompt = vlmPrompt.trim();
        if (!prompt) {
          throw new Error("Enter a description of the activity to verify.");
        }

        setStage("uploading");
        setStageLabel("Sending video to backend...");

        const videoResponse = await fetch(videoUri);
        const blob = await videoResponse.blob();
        const rawExt = videoUri.split(".").pop()?.toLowerCase() ?? "";
        const ext = ["mp4", "mov", "m4v", "webm"].includes(rawExt) ? rawExt : "mp4";

        const form = new FormData();
        form.append("video", blob, `video.${ext}`);
        form.append("activity_prompt", prompt);
        form.append("verification_id", verificationId);

        setStage("analyzing");
        setStageLabel("Asking Mistral Pixtral...");

        const res = await fetch(`${baseUrl}/dev/infer-vlm`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Backend returned ${res.status}: ${text.slice(0, 300)}`);
        }

        const data = (await res.json()) as VlmResult;
        setVlmResult(data);
        setResult(null);
        setStage("done");
        setStageLabel("");
        return;
      }

      // ---- Mock mode -------------------------------------------------------
      if (inferenceMode === "mock") {
        const storagePath = `dev-test/mock/${selectedActivity}/${verificationId}/video.mp4`;
        setStage("analyzing");
        setStageLabel("Requesting mock result...");

        const res = await fetch(`${baseUrl}/dev/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verification_id: verificationId,
            user_id: "dev-tester",
            dog_id: "dev-dog",
            activity_id: selectedActivity,
            verification_mode: "server",
            storage_path: storagePath,
            context_type: "reward",
            verification_tier: selectedTier,
            recording_metadata: {},
            device_metadata: {},
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Backend returned ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = (await res.json()) as AnalysisResult;
        if (!data.module_outputs && data.analysis_summary?.modules) {
          data.module_outputs = data.analysis_summary.modules as ModuleOutput[];
        }
        setResult(data);
        setVlmResult(null);
        setStage("done");
        setStageLabel("");
        return;
      }

      // ---- Real mode (DeepLabCut) ------------------------------------------
      setStage("uploading");
      setStageLabel("Sending video to backend...");

      const videoResponse = await fetch(videoUri);
      const blob = await videoResponse.blob();
      const rawExt = videoUri.split(".").pop()?.toLowerCase() ?? "";
      const ext = ["mp4", "mov", "m4v", "webm"].includes(rawExt) ? rawExt : "mp4";

      const form = new FormData();
      form.append("video", blob, `video.${ext}`);
      form.append("activity_id", selectedActivity);
      form.append("verification_tier", selectedTier);
      form.append("verification_id", verificationId);

      setStage("analyzing");
      setStageLabel("Running DeepLabCut inference...");

      const res = await fetch(`${baseUrl}/dev/infer`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend returned ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as AnalysisResult;
      if (!data.module_outputs && data.analysis_summary?.modules) {
        data.module_outputs = data.analysis_summary.modules as ModuleOutput[];
      }
      setResult(data);
      setVlmResult(null);
      setStage("done");
      setStageLabel("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStage("error");
      setStageLabel("");
    }
  }, [videoUri, selectedActivity, selectedTier, inferenceMode, vlmPrompt]);

  const reset = useCallback(() => {
    setVideoUri(null);
    setResult(null);
    setVlmResult(null);
    setErrorMessage(null);
    setStage("idle");
    setStageLabel("");
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const busy = stage === "uploading" || stage === "analyzing" || stage === "picking";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>AI Test Lab</Text>
          <Text style={styles.subtitle}>Developer-only. Not in production builds.</Text>
        </View>

        {/* Inference mode */}
        <Section label="Inference mode">
          <View style={styles.chips}>
            <ChipButton label="Mock" selected={inferenceMode === "mock"} onPress={() => setInferenceMode("mock")} />
            <ChipButton label="DeepLabCut" selected={inferenceMode === "real"} onPress={() => setInferenceMode("real")} />
            <ChipButton label="VLM (Mistral)" selected={inferenceMode === "vlm"} onPress={() => setInferenceMode("vlm")} />
          </View>
          {inferenceMode === "real" ? (
            <Text style={styles.modeNote}>
              Requires DeepLabCut + PyTorch and backend started with start-real.sh. Takes ~25 seconds.
            </Text>
          ) : inferenceMode === "vlm" ? (
            <Text style={styles.modeNote}>
              Uses Mistral Pixtral vision model. Requires MISTRAL_API_KEY in paws-dog-ai/.env. Takes ~3-5 seconds. Experimental — not certified for production.
            </Text>
          ) : null}
        </Section>

        {/* VLM prompt */}
        {inferenceMode === "vlm" ? (
          <Section label="Activity description (prompt)">
            <TextInput
              style={styles.promptInput}
              placeholder="e.g. The dog lies flat on the ground with all four legs extended"
              placeholderTextColor={theme.colors.textMuted}
              value={vlmPrompt}
              onChangeText={setVlmPrompt}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.promptHint}>
              Describe what the dog should be doing at the end of the clip. Be specific about body position.
            </Text>
          </Section>
        ) : null}

        {/* Activity selector (shown for mock + real) */}
        {inferenceMode !== "vlm" ? (
          <Section label="Activity">
            <View style={styles.chips}>
              {ACTIVITY_OPTIONS.map((act) => (
                <ChipButton
                  key={act}
                  label={act}
                  selected={selectedActivity === act}
                  onPress={() => setSelectedActivity(act)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Tier selector (mock + real only) */}
        {inferenceMode !== "vlm" ? (
          <Section label="Verification tier">
            <View style={styles.chips}>
              {TIER_OPTIONS.map((t) => (
                <ChipButton
                  key={t}
                  label={t.replace(/_/g, " ")}
                  selected={selectedTier === t}
                  onPress={() => setSelectedTier(t)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Video picker */}
        <Section label="Video">
          {videoUri ? (
            <View style={styles.videoWrap}>
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoFilename} numberOfLines={2}>
                  {videoUri.split("/").pop()}
                </Text>
                <Text style={styles.videoReady}>Ready to analyze</Text>
              </View>
              <Pressable onPress={reset} style={styles.clearBtn}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickRow}>
              <ActionButton label="Record video" onPress={recordVideo} disabled={busy} />
              <ActionButton label="Pick from library" onPress={pickFromLibrary} disabled={busy} />
            </View>
          )}
        </Section>

        {/* Analyze button */}
        {videoUri && stage !== "done" ? (
          <Pressable
            onPress={runAnalysis}
            disabled={busy}
            style={[styles.analyzeBtn, busy && styles.analyzeBtnDisabled]}
          >
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={theme.colors.white} />
                <Text style={styles.analyzeBtnText}>{stageLabel}</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>Run analysis</Text>
            )}
          </Pressable>
        ) : null}

        {/* Error */}
        {stage === "error" && errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
            <Pressable onPress={reset} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Results */}
        {vlmResult ? <VlmResultPanel result={vlmResult} onReset={reset} /> : null}
        {result ? <DlcResultPanel result={result} onReset={reset} /> : null}

        {/* Setup hint */}
        <SetupHint />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// VLM result panel
// ---------------------------------------------------------------------------

function VlmResultPanel({ result, onReset }: { result: VlmResult; onReset: () => void }) {
  const passed = result.verdict === "pass";
  const failed = result.verdict === "fail";
  const color = passed
    ? theme.colors.success
    : failed
      ? theme.colors.error
      : theme.colors.textMuted;

  return (
    <View style={styles.resultCard}>
      <Text style={styles.sectionLabel}>VLM Result</Text>

      <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
        <Text style={[styles.statusText, { color }]}>
          {result.verdict.toUpperCase()}
        </Text>
      </View>

      {/* Why it passed or failed — the most important part */}
      <View style={[styles.reasoningBox, { borderLeftWidth: 3, borderLeftColor: color }]}>
        <Text style={[styles.reasoningLabel, { color }]}>
          {passed ? "Why it passed" : failed ? "Why it failed" : "Error"}
        </Text>
        <Text style={styles.reasoningText}>{result.reasoning}</Text>
      </View>

      <ResultRow label="Confidence" value={`${(result.confidence * 100).toFixed(1)}%`} />
      <ResultRow label="Model" value={result.model} />
      <ResultRow label="Inference time" value={`${(result.latency_ms / 1000).toFixed(1)}s`} />

      {/* Frames the model actually saw */}
      {result.preview_frames && result.preview_frames.length > 0 ? (
        <View style={styles.previewSection}>
          <Text style={styles.moduleSectionTitle}>
            Frames analyzed by Gemini ({result.preview_frames.length} sampled evenly)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
            {result.preview_frames.map((b64, i) => (
              <View key={i} style={styles.previewFrame}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${b64}` }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <Text style={styles.previewLabel}>
                  {i === 0 ? "Start" : i === result.preview_frames.length - 1 ? "End" : `Frame ${i + 1}`}
                </Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.previewHint}>
            Gemini saw these frames in order and judged the dog's position.
          </Text>
        </View>
      ) : null}

      <ResultRow label="Prompt used" value={result.activity_prompt} muted />
      <ResultRow label="Verification ID" value={result.verification_id} mono />

      <View style={styles.experimentalBadge}>
        <Text style={styles.experimentalText}>
          Experimental — VLM results are not certified and cannot be used for Gold Coin rewards or tournaments.
        </Text>
      </View>

      <Pressable onPress={onReset} style={styles.resetBtn}>
        <Text style={styles.resetBtnText}>Test another video</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DLC result panel (same as before, renamed for clarity)
// ---------------------------------------------------------------------------

function DlcResultPanel({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const statusColor = statusToColor(result.status);

  return (
    <View style={styles.resultCard}>
      <Text style={styles.sectionLabel}>Result</Text>

      <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {result.status.replace(/_/g, " ").toUpperCase()}
        </Text>
      </View>

      <ResultRow label="Activity" value={result.activity_id} />
      <ResultRow
        label="Confidence"
        value={
          result.confidence_score !== null && result.confidence_score !== undefined
            ? `${(result.confidence_score * 100).toFixed(1)}%`
            : "n/a"
        }
      />
      {result.model_name ? (
        <ResultRow label="Model" value={result.model_name} />
      ) : null}
      {result.failure_reason ? (
        <ResultRow label="Failure reason" value={result.failure_reason} warning />
      ) : null}
      {result.retry_guidance ? (
        <ResultRow label="Retry guidance" value={result.retry_guidance} muted />
      ) : null}
      <ResultRow label="Verification ID" value={result.verification_id} mono />

      {Array.isArray(result.module_outputs) && result.module_outputs.length > 0 ? (
        <View style={styles.moduleSection}>
          <Text style={styles.moduleSectionTitle}>Module outputs</Text>
          {result.module_outputs.map((m, i) => (
            <ModuleRow key={i} module={m} />
          ))}
        </View>
      ) : null}

      {Array.isArray(result.analysis_summary?.preview_frames) &&
      (result.analysis_summary!.preview_frames as string[]).length > 0 ? (
        <View style={styles.previewSection}>
          <Text style={styles.moduleSectionTitle}>Pose analysis frames</Text>
          <Text style={styles.previewHint}>
            Yellow lines = skeleton  ·  Green dots = keypoint (conf &gt;= 50%)  ·  Blue = low confidence
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
            {(result.analysis_summary!.preview_frames as string[]).map((b64, i) => (
              <View key={i} style={styles.previewFrame}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${b64}` }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <Text style={styles.previewLabel}>Frame {i + 1}</Text>
              </View>
            ))}
          </ScrollView>
          {result.analysis_summary?.inference_latency_ms ? (
            <Text style={styles.previewHint}>
              Inference time: {((result.analysis_summary.inference_latency_ms as number) / 1000).toFixed(1)}s
            </Text>
          ) : null}
        </View>
      ) : null}

      {result.analysis_summary ? (
        <View style={styles.rawWrap}>
          <Text style={styles.rawLabel}>Raw analysis_summary</Text>
          <Text style={styles.rawJson}>
            {JSON.stringify(
              {
                ...result.analysis_summary,
                preview_frames: result.analysis_summary.preview_frames
                  ? `[${(result.analysis_summary.preview_frames as string[]).length} frames]`
                  : undefined,
              },
              null,
              2,
            )}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={onReset} style={styles.resetBtn}>
        <Text style={styles.resetBtnText}>Test another video</Text>
      </Pressable>
    </View>
  );
}

function ResultRow({
  label,
  value,
  warning = false,
  muted = false,
  mono = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text
        style={[
          styles.resultValue,
          warning && { color: theme.colors.error },
          muted && { color: theme.colors.textMuted },
          mono && styles.mono,
        ]}
        numberOfLines={0}
      >
        {value}
      </Text>
    </View>
  );
}

function ModuleRow({ module: m }: { module: ModuleOutput }) {
  const passed = m.passed;
  const color =
    passed === true
      ? theme.colors.success
      : passed === false
        ? theme.colors.error
        : theme.colors.textMuted;
  const icon = passed === true ? "PASS" : passed === false ? "FAIL" : "N/A";

  return (
    <View style={styles.moduleRow}>
      <View style={[styles.moduleIcon, { backgroundColor: color + "22" }]}>
        <Text style={[styles.moduleIconText, { color }]}>{icon}</Text>
      </View>
      <View style={styles.moduleBody}>
        <Text style={styles.moduleName}>{m.module_name}</Text>
        <Text style={styles.moduleDetail}>
          {m.implementation_status}
          {m.confidence !== null ? `  ·  ${(m.confidence * 100).toFixed(0)}%` : ""}
          {`  ·  ${m.latency_ms}ms`}
        </Text>
        {m.reason_codes.length > 0 ? (
          <Text style={styles.moduleReasons}>{m.reason_codes.join(", ")}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Setup hint
// ---------------------------------------------------------------------------

function SetupHint() {
  const baseUrl = env.isValid ? env.data.dogAiBaseUrl : null;

  return (
    <View style={styles.hintCard}>
      <Text style={styles.hintTitle}>Setup status</Text>
      <HintRow
        label="Backend URL"
        value={baseUrl ?? "Not set — add EXPO_PUBLIC_DOG_AI_BASE_URL"}
        ok={!!baseUrl}
      />
      <HintRow
        label="Real AI enabled"
        value={
          env.isValid && env.data.enableRealDogAi
            ? "Yes"
            : "No — set EXPO_PUBLIC_ENABLE_REAL_DOG_AI=true"
        }
        ok={env.isValid && env.data.enableRealDogAi}
      />
      <Text style={styles.hintNote}>
        VLM mode: add MISTRAL_API_KEY to paws-dog-ai/.env{"\n"}
        DLC mode: bash paws-dog-ai/start-real.sh{"\n"}
        Mock mode: bash paws-dog-ai/start-dev.sh
      </Text>
    </View>
  );
}

function HintRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.hintRow}>
      <Text style={[styles.hintDot, { color: ok ? theme.colors.success : theme.colors.error }]}>
        {ok ? "●" : "○"}
      </Text>
      <View style={styles.hintBody}>
        <Text style={styles.hintLabel}>{label}</Text>
        <Text style={[styles.hintValue, !ok && { color: theme.colors.warning }]}>{value}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusToColor(status: string): string {
  if (status === "passed") return theme.colors.success;
  if (status === "failed") return theme.colors.error;
  if (status.startsWith("retry")) return theme.colors.warning;
  if (status === "pending_manual_review") return theme.colors.secondary;
  if (status === "unsupported_data_collection_only") return theme.colors.textMuted;
  return theme.colors.textMuted;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.xl, gap: theme.spacing.xl, paddingBottom: 60 },

  header: { gap: theme.spacing.xs },
  backBtn: { alignSelf: "flex-start", marginBottom: theme.spacing.xs },
  backText: { color: theme.colors.primary, fontSize: theme.typography.md, fontWeight: "600" },
  title: { fontSize: theme.typography.xl, fontWeight: "900", color: theme.colors.primaryDark },
  subtitle: { fontSize: theme.typography.sm, color: theme.colors.textMuted },

  section: { gap: theme.spacing.sm },
  sectionLabel: {
    fontSize: theme.typography.sm,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  chipText: { fontSize: theme.typography.sm, color: theme.colors.textMuted, fontWeight: "600" },
  chipTextSelected: { color: theme.colors.primaryDark },

  modeNote: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginTop: theme.spacing.xs,
  },

  promptInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    minHeight: 80,
    textAlignVertical: "top",
  },
  promptHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },

  pickRow: { flexDirection: "row", gap: theme.spacing.md },
  actionBtn: {
    flex: 1,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontWeight: "600",
    textAlign: "center",
  },

  videoWrap: { gap: theme.spacing.sm },
  videoPlaceholder: {
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + "66",
    backgroundColor: theme.colors.primarySoft,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  videoFilename: {
    fontSize: theme.typography.sm,
    color: theme.colors.primaryDark,
    fontWeight: "600",
    textAlign: "center",
  },
  videoReady: { fontSize: theme.typography.xs, color: theme.colors.primary },
  clearBtn: { alignSelf: "flex-end" },
  clearText: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "600" },

  analyzeBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: "700" },
  busyRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "center" },

  errorCard: {
    backgroundColor: theme.colors.errorSoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.error + "44",
  },
  errorTitle: { fontSize: theme.typography.md, fontWeight: "800", color: theme.colors.error },
  errorBody: { fontSize: theme.typography.sm, color: theme.colors.error, lineHeight: 20 },
  retryBtn: { alignSelf: "flex-start", marginTop: theme.spacing.xs },
  retryText: { color: theme.colors.error, fontWeight: "700", fontSize: theme.typography.sm },

  resultCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
  },
  statusText: { fontSize: theme.typography.sm, fontWeight: "900", letterSpacing: 0.5 },

  reasoningBox: {
    backgroundColor: theme.colors.backgroundSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  reasoningLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasoningText: {
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },

  experimentalBadge: {
    backgroundColor: theme.colors.warning + "18",
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning + "44",
  },
  experimentalText: {
    fontSize: theme.typography.xs,
    color: theme.colors.warning,
    lineHeight: 18,
  },

  resultRow: { gap: 2 },
  resultLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultValue: { fontSize: theme.typography.sm, color: theme.colors.text, lineHeight: 20 },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: theme.typography.xs,
  },

  moduleSection: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  moduleSectionTitle: {
    fontSize: theme.typography.xs,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moduleRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" },
  moduleIcon: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: theme.radii.sm, minWidth: 38, alignItems: "center" },
  moduleIconText: { fontSize: 10, fontWeight: "900" },
  moduleBody: { flex: 1, gap: 2 },
  moduleName: { fontSize: theme.typography.sm, fontWeight: "700", color: theme.colors.text },
  moduleDetail: { fontSize: theme.typography.xs, color: theme.colors.textMuted },
  moduleReasons: { fontSize: theme.typography.xs, color: theme.colors.textSubtle, fontStyle: "italic" },

  previewSection: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  previewHint: { fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 16 },
  previewScroll: { marginHorizontal: -theme.spacing.sm },
  previewFrame: { alignItems: "center", gap: 4, marginHorizontal: theme.spacing.xs },
  previewImage: { width: 200, height: 300, borderRadius: theme.radii.md, backgroundColor: theme.colors.backgroundSoft },
  previewLabel: { fontSize: theme.typography.xs, color: theme.colors.textMuted },

  rawWrap: {
    backgroundColor: theme.colors.backgroundSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  rawLabel: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  rawJson: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    color: theme.colors.textMuted,
    lineHeight: 16,
  },

  resetBtn: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  resetBtnText: { color: theme.colors.primaryDark, fontWeight: "700", fontSize: theme.typography.sm },

  hintCard: {
    backgroundColor: theme.colors.backgroundSoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hintTitle: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.text },
  hintRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" },
  hintDot: { fontSize: 14, marginTop: 1 },
  hintBody: { flex: 1, gap: 2 },
  hintLabel: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  hintValue: { fontSize: theme.typography.xs, color: theme.colors.text, lineHeight: 18 },
  hintNote: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSubtle,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    lineHeight: 18,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
});
