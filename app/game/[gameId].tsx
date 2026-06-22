import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GoldBar } from "@/components/ui/GoldBar";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useChallengeGamesForDog } from "@/hooks/useGameCatalog";
import { useReferenceAssets } from "@/hooks/useReferenceAssets";
import { useWallet } from "@/hooks/useWallet";
import { submitChallengeGameVideo, type ChallengeGameVerdict } from "@/services/gameService";

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  easy:     { bg: theme.colors.primarySoft,  text: theme.colors.primaryDark },
  medium:   { bg: theme.colors.accentSoft,   text: "#6B6B00" },
  hard:     { bg: "#FFE8D6",                  text: "#B85C00" },
  featured: { bg: theme.colors.goldSoft,      text: "#9A6200" },
};

export default function ChallengeGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const wallet = useWallet(dogId);
  const games = useChallengeGamesForDog(dogId);
  const refAssets = useReferenceAssets(dogId);

  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"idle" | "reading" | "uploading" | "charging" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChallengeGameVerdict | null>(null);

  // Refresh reference assets every time this screen comes into focus
  // (user may have just come back from the reference-setup screen)
  useFocusEffect(
    useCallback(() => {
      void refAssets.refetch();
    }, [refAssets.refetch]),
  );

  const game = (games.data ?? []).find((g) => g.id === gameId);

  if (dog.isLoading || games.isLoading || wallet.isLoading || refAssets.isLoading) {
    return <ScreenContainer centered><LoadingState message="Loading challenge..." /></ScreenContainer>;
  }

  if (!game) {
    return (
      <ScreenContainer centered>
        <ErrorState message="Challenge not found." onRetry={() => router.back()} />
      </ScreenContainer>
    );
  }

  const silver = wallet.data?.silverBalance ?? 0;
  const gold   = wallet.data?.goldBalance ?? 0;
  const canAfford = silver >= game.economy.silverCoinEntryCost;
  const hasDogProfile = refAssets.hasAsset("DOG_PROFILE");
  const readyToSubmit = canAfford && hasDogProfile;
  const diff = DIFF_COLORS[game.difficulty] ?? DIFF_COLORS.easy;

  const stageLabel: Record<typeof submitStage, string> = {
    idle:      "",
    reading:   "Reading video file…",
    uploading: "Uploading video…",
    charging:  "Charging entry fee…",
    verifying: "Gemini is reviewing your clip…",
  };

  const handlePickAndSubmit = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Media library access is required to submit a video.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });

    const asset = picked.assets?.[0];
    if (picked.canceled || !asset?.uri) return;

    try {
      setSubmitting(true);
      setSubmitStage("reading");
      // Small delay so the label shows before blocking on fetch
      await new Promise((r) => setTimeout(r, 80));
      setSubmitStage("uploading");
      // The service reads, uploads, then charges silver, then verifies
      // We show stage labels by hooking into the timing
      const verdict = await submitChallengeGameVideo(dogId, game.id, asset.uri, {
        onUploaded: () => setSubmitStage("charging"),
        onCharged: () => setSubmitStage("verifying"),
      });
      setResult(verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
      setSubmitStage("idle");
    }
  };

  // ── Result screen ─────────────────────────────────────────────────────────

  if (result) {
    const isPass = result.verdict === "PASS";
    const isNeedsReview = result.verdict === "NEEDS_REVIEW";
    return (
      <ScreenContainer scroll>
        {/* Verdict hero */}
        <View style={[styles.verdictHero, isPass && styles.verdictHeroPass, isNeedsReview && styles.verdictHeroReview]}>
          <View style={styles.verdictIconCircle}>
            <Ionicons
              name={isPass ? "checkmark-circle" : isNeedsReview ? "time-outline" : "close-circle"}
              size={44}
              color={isPass ? theme.colors.primary : isNeedsReview ? theme.colors.gold : theme.colors.error}
            />
          </View>
          <Text style={styles.verdictTitle}>
            {isPass ? "Challenge Passed!" : isNeedsReview ? "Needs Clearer Video" : "Not Quite"}
          </Text>
          <Text style={styles.verdictSub}>
            {isPass
              ? `${dog.data?.name} nailed it.`
              : isNeedsReview
                ? "Gemini couldn't confirm the behavior clearly enough. No extra silver charged for this resubmission."
                : "Review the criteria below and try again."}
          </Text>
        </View>

        {/* Rewards (PASS only) */}
        {isPass && (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardCardTitle}>Rewards Earned</Text>
            <View style={styles.rewardRow}>
              <View style={styles.rewardPill}>
                <GoldBar size={18} />
                <Text style={styles.rewardPillAmount}>+{result.goldEarned}</Text>
                <Text style={styles.rewardPillLabel}>Gold</Text>
              </View>
              {result.bonusXp > 0 && (
                <View style={styles.rewardPill}>
                  <Ionicons name="flash-outline" size={18} color={theme.colors.primaryDark} />
                  <Text style={[styles.rewardPillAmount, { color: theme.colors.primaryDark }]}>+{result.bonusXp}</Text>
                  <Text style={styles.rewardPillLabel}>XP</Text>
                </View>
              )}
            </View>
            <Pressable style={styles.shopBtn} onPress={() => router.push("/rewards")}>
              <Ionicons name="ticket-outline" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.shopBtnText}>Spend Gold in Shop</Text>
            </Pressable>
          </View>
        )}

        {/* Retry guidance */}
        {result.retryInstruction && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.infoText}>{result.retryInstruction}</Text>
          </View>
        )}

        {/* Observations */}
        {result.observations.length > 0 && (
          <View style={styles.observationsCard}>
            <Text style={styles.observationsTitle}>AI Observations</Text>
            {result.observations.map((obs, i) => (
              <View key={i} style={styles.observationRow}>
                <Ionicons name="ellipse" size={6} color={theme.colors.textMuted} style={styles.obsBullet} />
                <Text style={styles.observationText}>{obs}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dog profile missing — show in result too */}
        {!hasDogProfile && (
          <View style={styles.refMissingCard}>
            <Ionicons name="camera-outline" size={20} color="#B85C00" />
            <View style={styles.refMissingBody}>
              <Text style={styles.refMissingTitle}>Dog profile photo needed</Text>
              <Text style={styles.refMissingDesc}>
                Upload a clear photo of {dog.data?.name ?? "your dog"} so Gemini can confirm the right dog is in your video. This is a one-time setup.
              </Text>
            </View>
            <Pressable
              style={styles.refMissingBtn}
              onPress={() => router.push("/train/reference-setup/DOG_PROFILE")}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/game")}>
            <Text style={styles.secondaryBtnText}>Back to Games</Text>
          </Pressable>
          {!isPass && (
            <Pressable style={styles.primaryBtn} onPress={() => setResult(null)}>
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </View>
      </ScreenContainer>
    );
  }

  // ── Instruction screen ────────────────────────────────────────────────────

  return (
    <ScreenContainer scroll>
      {/* Header card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.diffChip, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffChipText, { color: diff.text }]}>
              {game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}
            </Text>
          </View>
          <View style={styles.costChip}>
            <Ionicons name="cash-outline" size={13} color={theme.colors.silver} />
            <Text style={styles.costChipText}>{game.economy.silverCoinEntryCost} silver</Text>
          </View>
          <View style={styles.goldChip}>
            <GoldBar size={13} />
            <Text style={styles.goldChipText}>+{game.economy.goldCoinPassReward} gold on PASS</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{game.title}</Text>
        <Text style={styles.heroSub}>{game.subtitle}</Text>
        {game.description ? <Text style={styles.heroDesc}>{game.description}</Text> : null}

        <View style={styles.heroMeta}>
          <View style={styles.metaPill}>
            <Ionicons name="videocam-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaPillText}>{game.clipDurationSeconds.min}–{game.clipDurationSeconds.max}s clip</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="eye-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaPillText}>Reviewed by Gemini AI</Text>
          </View>
        </View>
      </View>

      {/* ── Pre-flight checklist ── */}
      <View style={styles.preflightCard}>
        <Text style={styles.preflightTitle}>Before you submit</Text>
        <Text style={styles.preflightSub}>Both must be ready before silver is charged.</Text>

        {/* Check 1: Dog profile photo */}
        <View style={[styles.preflightRow, !hasDogProfile && styles.preflightRowMissing]}>
          <View style={[styles.preflightCheck, hasDogProfile ? styles.preflightCheckOk : styles.preflightCheckFail]}>
            <Ionicons
              name={hasDogProfile ? "checkmark" : "close"}
              size={14}
              color="#fff"
            />
          </View>
          <View style={styles.preflightBody}>
            <Text style={[styles.preflightItemTitle, !hasDogProfile && styles.preflightItemTitleMissing]}>
              Dog profile photo
            </Text>
            <Text style={styles.preflightItemSub}>
              {hasDogProfile
                ? `Gemini has a photo of ${dog.data?.name ?? "your dog"} on file`
                : "Gemini needs a photo of your dog to verify your video"}
            </Text>
          </View>
          {!hasDogProfile && (
            <Pressable
              style={styles.preflightFixBtn}
              onPress={() => router.push("/train/reference-setup/DOG_PROFILE")}
              accessibilityRole="button"
              accessibilityLabel="Upload dog profile photo"
            >
              <Text style={styles.preflightFixBtnText}>Fix</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </Pressable>
          )}
        </View>

        {/* Check 2: Silver balance */}
        <View style={[styles.preflightRow, !canAfford && styles.preflightRowMissing]}>
          <View style={[styles.preflightCheck, canAfford ? styles.preflightCheckOk : styles.preflightCheckFail]}>
            <Ionicons
              name={canAfford ? "checkmark" : "close"}
              size={14}
              color="#fff"
            />
          </View>
          <View style={styles.preflightBody}>
            <Text style={[styles.preflightItemTitle, !canAfford && styles.preflightItemTitleMissing]}>
              Entry fee: {game.economy.silverCoinEntryCost} silver
            </Text>
            <Text style={styles.preflightItemSub}>
              {canAfford
                ? `You have ${silver} silver — ready`
                : `You have ${silver} silver, need ${game.economy.silverCoinEntryCost - silver} more`}
            </Text>
          </View>
          {!canAfford && (
            <Pressable
              style={styles.preflightFixBtn}
              onPress={() => router.replace("/(tabs)/train")}
              accessibilityRole="button"
              accessibilityLabel="Earn more silver"
            >
              <Text style={styles.preflightFixBtnText}>Earn</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Dog profile photo setup banner (if missing) */}
      {!hasDogProfile && (
        <View style={styles.setupBanner}>
          <View style={styles.setupBannerTop}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.primaryDark} />
            <Text style={styles.setupBannerTitle}>Set up your dog's profile photo first</Text>
          </View>
          <Text style={styles.setupBannerDesc}>
            Gemini AI uses a photo of {dog.data?.name ?? "your dog"} to confirm the right dog
            is in every video you submit. This one-time setup takes about 30 seconds.
          </Text>
          <Text style={styles.setupBannerNote}>
            Your silver won't be charged until after your video is uploaded.
          </Text>
          <Pressable
            style={styles.setupBannerBtn}
            onPress={() => router.push("/train/reference-setup/DOG_PROFILE")}
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.setupBannerBtnText}>Upload {dog.data?.name ?? "Dog"}'s Profile Photo</Text>
          </Pressable>
          <Text style={styles.setupBannerReturn}>
            Once uploaded, come back here to submit your video.
          </Text>
        </View>
      )}

      {/* Setup steps */}
      {game.recordingSetup.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recording Setup</Text>
          {game.recordingSetup.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Instructions */}
      {game.userInstructions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {game.userInstructions.map((inst, i) => (
            <View key={i} style={styles.stepRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.stepText}>{inst}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Safety notes */}
      {(game.safetyNotes ?? []).length > 0 && (
        <View style={[styles.section, styles.safetySection]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#B85C00" />
            <Text style={[styles.sectionTitle, { color: "#B85C00", marginBottom: 0 }]}>Safety</Text>
          </View>
          {(game.safetyNotes ?? []).map((note, i) => (
            <View key={i} style={styles.stepRow}>
              <Ionicons name="alert-circle-outline" size={16} color="#B85C00" />
              <Text style={[styles.stepText, { color: "#7A3D00" }]}>{note}</Text>
            </View>
          ))}
        </View>
      )}

      {/* How the submission works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How submission works</Text>
        <View style={styles.howRow}>
          <View style={styles.howStep}><Text style={styles.howStepNum}>1</Text></View>
          <Text style={styles.howStepText}>Pick a video from your library</Text>
        </View>
        <View style={styles.howRow}>
          <View style={styles.howStep}><Text style={styles.howStepNum}>2</Text></View>
          <Text style={styles.howStepText}>Video uploads to PAWS securely</Text>
        </View>
        <View style={styles.howRow}>
          <View style={[styles.howStep, styles.howStepCharge]}><Text style={styles.howStepNum}>3</Text></View>
          <View style={styles.howStepBody}>
            <Text style={[styles.howStepText, styles.howStepTextCharge]}>
              {game.economy.silverCoinEntryCost} silver is charged here
            </Text>
            <Text style={styles.howStepSub}>Only after a successful upload</Text>
          </View>
        </View>
        <View style={styles.howRow}>
          <View style={styles.howStep}><Text style={styles.howStepNum}>4</Text></View>
          <Text style={styles.howStepText}>Gemini AI reviews and issues verdict</Text>
        </View>
        <View style={styles.howRow}>
          <View style={[styles.howStep, styles.howStepPass]}><Text style={styles.howStepNum}>5</Text></View>
          <Text style={[styles.howStepText, { color: theme.colors.primaryDark }]}>
            PASS → {game.economy.goldCoinPassReward} gold coins added to your wallet
          </Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Submit CTA */}
      {submitting ? (
        <View style={styles.submittingCard}>
          <ActivityIndicator size="small" color={theme.colors.primaryDark} />
          <View style={styles.submittingBody}>
            <Text style={styles.submittingText}>{stageLabel[submitStage]}</Text>
            {submitStage === "uploading" && (
              <Text style={styles.submittingNote}>Silver not charged yet — uploading first</Text>
            )}
            {submitStage === "verifying" && (
              <Text style={styles.submittingNote}>Silver charged · Gemini is reviewing your clip</Text>
            )}
          </View>
        </View>
      ) : !hasDogProfile ? (
        // Can't submit without dog profile photo — show clear CTA to fix
        <Pressable
          style={styles.blockedBtn}
          onPress={() => router.push("/train/reference-setup/DOG_PROFILE")}
          accessibilityRole="button"
        >
          <Ionicons name="camera-outline" size={18} color={theme.colors.primaryDark} />
          <Text style={styles.blockedBtnText}>Upload Dog Photo to Unlock Submission</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primaryDark} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.submitBtn, !canAfford && styles.submitBtnDisabled]}
          disabled={!canAfford}
          onPress={() => void handlePickAndSubmit()}
          accessibilityRole="button"
        >
          <Ionicons name="videocam-outline" size={18} color={canAfford ? "#fff" : theme.colors.textMuted} />
          <Text style={[styles.submitBtnText, !canAfford && styles.submitBtnTextDisabled]}>
            {canAfford
              ? `Pick Video & Submit · ${game.economy.silverCoinEntryCost} silver`
              : `Need ${game.economy.silverCoinEntryCost} silver to enter`}
          </Text>
        </Pressable>
      )}

      {readyToSubmit && !submitting && (
        <Text style={styles.disclaimer}>
          Silver is only charged after your video uploads successfully.
        </Text>
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.sm, ...theme.shadows.soft },
  heroTop: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  diffChip: { borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  diffChipText: { fontSize: theme.typography.xs, fontWeight: "900" },
  costChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.silverSoft, paddingHorizontal: 10, paddingVertical: 4 },
  costChipText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.silver },
  goldChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.goldSoft, paddingHorizontal: 10, paddingVertical: 4 },
  goldChipText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.gold },
  heroTitle: { fontSize: 20, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.3 },
  heroSub: { fontSize: theme.typography.sm, color: theme.colors.textMuted, lineHeight: 19 },
  heroDesc: { fontSize: theme.typography.xs, color: theme.colors.textSubtle, lineHeight: 18 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 4 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.colors.cardMuted, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  metaPillText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },

  // Pre-flight checklist
  preflightCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: 12, ...theme.shadows.soft },
  preflightTitle: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text },
  preflightSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: -4 },
  preflightRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: theme.radii.md },
  preflightRowMissing: { backgroundColor: "#FEF2F2" },
  preflightCheck: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  preflightCheckOk: { backgroundColor: theme.colors.primary },
  preflightCheckFail: { backgroundColor: theme.colors.error },
  preflightBody: { flex: 1, minWidth: 0 },
  preflightItemTitle: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.text },
  preflightItemTitleMissing: { color: theme.colors.error },
  preflightItemSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 1 },
  preflightFixBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.error, borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  preflightFixBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },

  // Dog profile setup banner
  setupBanner: { backgroundColor: "#FFF5EC", borderWidth: 1.5, borderColor: "#FFD6A0", borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: 10 },
  setupBannerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  setupBannerTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.primaryDark, flex: 1 },
  setupBannerDesc: { fontSize: theme.typography.xs, color: theme.colors.text, lineHeight: 18 },
  setupBannerNote: { fontSize: theme.typography.xs, color: "#8B6800", fontWeight: "700" },
  setupBannerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primaryDark, borderRadius: theme.radii.pill, paddingVertical: 14, minHeight: 50 },
  setupBannerBtnText: { fontSize: theme.typography.sm, fontWeight: "900", color: "#fff" },
  setupBannerReturn: { fontSize: theme.typography.xs, color: theme.colors.textMuted, textAlign: "center" },

  // Reference missing in result
  refMissingCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#FFF5EC", borderWidth: 1.5, borderColor: "#FFD6A0", borderRadius: theme.radii.lg, padding: theme.spacing.md },
  refMissingBody: { flex: 1 },
  refMissingTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: "#B85C00" },
  refMissingDesc: { fontSize: theme.typography.xs, color: "#7A3D00", lineHeight: 17, marginTop: 3 },
  refMissingBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  section: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.sm, ...theme.shadows.soft },
  safetySection: { backgroundColor: "#FFF5EC", borderWidth: 1, borderColor: "#FFD6A0" },
  sectionTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text, marginBottom: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumText: { fontSize: 11, fontWeight: "900", color: theme.colors.primaryDark },
  stepText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.text, lineHeight: 18 },

  // How it works
  howCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: 10, ...theme.shadows.soft },
  howTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text, marginBottom: 2 },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  howStep: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  howStepCharge: { backgroundColor: theme.colors.silverSoft },
  howStepPass: { backgroundColor: theme.colors.primarySoft },
  howStepNum: { fontSize: 12, fontWeight: "900", color: theme.colors.primaryDark },
  howStepBody: { flex: 1 },
  howStepText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.text, lineHeight: 18 },
  howStepTextCharge: { color: theme.colors.silver, fontWeight: "800" },
  howStepSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, padding: theme.spacing.md },
  errorText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.error, fontWeight: "700" },

  submittingCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, ...theme.shadows.soft },
  submittingBody: { flex: 1 },
  submittingText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  submittingNote: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },

  blockedBtn: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primarySoft, paddingHorizontal: theme.spacing.lg, justifyContent: "center" },
  blockedBtnText: { flex: 1, textAlign: "center", fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark },
  submitBtnDisabled: { backgroundColor: theme.colors.cardMuted },
  submitBtnText: { fontSize: theme.typography.sm, fontWeight: "900", color: "#fff" },
  submitBtnTextDisabled: { color: theme.colors.textMuted },

  disclaimer: { fontSize: theme.typography.xs, color: theme.colors.textSubtle, textAlign: "center", lineHeight: 16 },

  // Result screen
  verdictHero: { backgroundColor: theme.colors.cardMuted, borderRadius: theme.radii.lg, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm, ...theme.shadows.soft },
  verdictHeroPass: { backgroundColor: theme.colors.primarySoft },
  verdictHeroReview: { backgroundColor: theme.colors.goldSoft },
  verdictIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center", ...theme.shadows.soft },
  verdictTitle: { fontSize: 22, fontWeight: "900", color: theme.colors.text },
  verdictSub: { fontSize: theme.typography.sm, color: theme.colors.textMuted, textAlign: "center", lineHeight: 19 },

  rewardCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.soft },
  rewardCardTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  rewardRow: { flexDirection: "row", gap: theme.spacing.md },
  rewardPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.colors.goldSoft, borderRadius: theme.radii.md, paddingVertical: theme.spacing.md },
  rewardPillAmount: { fontSize: theme.typography.lg, fontWeight: "900", color: theme.colors.gold },
  rewardPillLabel: { fontSize: theme.typography.xs, fontWeight: "700", color: theme.colors.textMuted },
  shopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft },
  shopBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md, padding: theme.spacing.md },
  infoText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.primaryDark, lineHeight: 17, fontWeight: "700" },

  observationsCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: 8, ...theme.shadows.soft },
  observationsTitle: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  observationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  obsBullet: { marginTop: 6, flexShrink: 0 },
  observationText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 17 },

  actionsRow: { flexDirection: "row", gap: theme.spacing.md },
  secondaryBtn: { flex: 1, minHeight: 48, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.textMuted },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark },
  primaryBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },
});
