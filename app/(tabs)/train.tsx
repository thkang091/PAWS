import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SaveProgressBanner } from "@/components/account/SaveProgressBanner";
import { ProfileIconButton } from "@/components/navigation/ProfileIconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogRoadmap } from "@/hooks/useDogRoadmap";
import { useDogStreak } from "@/hooks/useDogStreak";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useWallet } from "@/hooks/useWallet";
import { getErrorMessage } from "@/lib/errors";
import { generateRoadmap } from "@/services/curriculumService";
import type { PersonalizedRoadmapDay } from "@/types/domain";

// ── Layout constants ──────────────────────────────────────────────────────────

const H_PAD = 24;

const NODE_D = 56;          // all node diameters (uniform so connector math is consistent)
const NODE_R = NODE_D / 2;
const PATH_W = 4;           // connector stroke width
const SLOT_H = 130;         // vertical space per node
const LABEL_OFFSET = 8;     // gap between circle bottom and label

// ── Zigzag x positions (three columns) ───────────────────────────────────────

const zigzagX = (i: number, mapWidth: number) => {
  const xLeft = 36;
  const xCenter = Math.round((mapWidth - NODE_D) / 2);
  const xRight = mapWidth - NODE_D - 36;
  return [xLeft, xCenter, xRight, xCenter][i % 4];
};
const nCX = (i: number, mapWidth: number) => zigzagX(i, mapWidth) + NODE_R;    // center-x of node i
const nCY = (i: number) => i * SLOT_H + NODE_R; // center-y of node i (unused but kept for clarity)

// ── Reward constants ──────────────────────────────────────────────────────────

const DIFFICULTY_SILVER: Record<string, number> = {
  LEARN: 10,
  REPEAT: 15,
  ADD_DURATION: 20,
  ADD_DISTANCE: 20,
  ADD_DISTRACTION: 25,
  REAL_LIFE_PROOF: 30,
  MAINTENANCE: 15,
  REGRESSION: 15,
  BOSS_BATTLE: 50,
};

function activitySilver(day: PersonalizedRoadmapDay): number {
  return DIFFICULTY_SILVER[day.difficultyMode] ?? 20;
}

function canLevelUp(day: PersonalizedRoadmapDay): boolean {
  return day.difficultyMode === "REAL_LIFE_PROOF" || day.difficultyMode === "BOSS_BATTLE";
}

// ── Status helpers ────────────────────────────────────────────────────────────

type NodeStatus = "completed" | "current" | "locked";

function statusOf(day: PersonalizedRoadmapDay, today: PersonalizedRoadmapDay | null): NodeStatus {
  if (day.completedAt) return "completed";
  if (today?.id === day.id) return "current";
  return "locked";
}

// ── Path connectors ───────────────────────────────────────────────────────────
// All nodes share NODE_D, so arcTop/arcBot math is always consistent.
// We extend ±4 px past the circle edges so the connector dips slightly into
// the circles — nodes render on top and cover the overlap, making connections
// look perfectly solid regardless of sub-pixel rounding.

function Connector({ i, days, mapWidth }: { i: number; days: PersonalizedRoadmapDay[]; mapWidth: number }) {
  if (i >= days.length - 1) return null;

  const completed = !!days[i].completedAt;
  const lineColor = completed ? theme.colors.primary : "#D4CBBA";

  const cx1 = nCX(i, mapWidth);
  const cx2 = nCX(i + 1, mapWidth);

  // Extend 4 px into each circle so there's never a visible gap.
  const arcTop = i * SLOT_H + NODE_D - 4;
  const arcBot = (i + 1) * SLOT_H + 4;
  const arcH = arcBot - arcTop;

  if (cx1 === cx2) {
    // Straight vertical (same column — never triggered with current ZIGZAG but kept for safety)
    return (
      <View
        style={{
          position: "absolute",
          left: cx1 - PATH_W / 2,
          top: arcTop,
          width: PATH_W,
          height: arcH,
          backgroundColor: lineColor,
          borderRadius: 2,
        }}
      />
    );
  }

  const goingRight = cx2 > cx1;
  const span = Math.abs(cx2 - cx1);
  const radius = Math.min(span * 0.55, 32);

  if (goingRight) {
    // Left border goes down from cx1, curves right at bottom, bottom border reaches cx2
    return (
      <View
        style={{
          position: "absolute",
          left: cx1 - PATH_W / 2,
          top: arcTop,
          width: span + PATH_W / 2,
          height: arcH,
          borderLeftWidth: PATH_W,
          borderBottomWidth: PATH_W,
          borderBottomLeftRadius: radius,
          borderColor: lineColor,
        }}
      />
    );
  } else {
    // Right border goes down from cx1, curves left at bottom, bottom border reaches cx2
    return (
      <View
        style={{
          position: "absolute",
          left: cx2 - PATH_W / 2,
          top: arcTop,
          width: span + PATH_W / 2,
          height: arcH,
          borderRightWidth: PATH_W,
          borderBottomWidth: PATH_W,
          borderBottomRightRadius: radius,
          borderColor: lineColor,
        }}
      />
    );
  }
}

// ── Single journey node ───────────────────────────────────────────────────────

function JourneyNode({
  i,
  day,
  status,
  onPress,
  mapWidth,
}: {
  i: number;
  day: PersonalizedRoadmapDay;
  status: NodeStatus;
  onPress: () => void;
  mapWidth: number;
}) {
  const x = zigzagX(i, mapWidth);
  const y = i * SLOT_H;
  const label = (day.primaryActivity?.title ?? `Day ${day.dayNumber}`).replace(
    /(.{0,13}).*/,
    "$1",
  );
  const isLocked = status === "locked";

  return (
    <View style={{ position: "absolute", left: x, top: y, alignItems: "center", width: NODE_D }}>
      <Pressable
        disabled={isLocked}
        onPress={onPress}
        accessibilityRole={isLocked ? "text" : "button"}
        accessibilityLabel={day.primaryActivity?.title ?? `Day ${day.dayNumber}`}
        style={({ pressed }) => [
          {
            width: NODE_D,
            height: NODE_D,
            borderRadius: NODE_R,
            alignItems: "center",
            justifyContent: "center",
          },
          status === "completed" && {
            backgroundColor: theme.colors.primaryDark,
            ...nodeShadow,
          },
          status === "current" && {
            backgroundColor: "#DC2626",
            opacity: pressed ? 0.88 : 1,
            ...nodeShadow,
          },
          status === "locked" && {
            backgroundColor: "#EDE7DC",
            borderWidth: 2,
            borderColor: "#D4CBBA",
          },
        ]}
      >
        {status === "completed" && <Ionicons name="checkmark" size={26} color="#fff" />}
        {status === "current" && <Ionicons name="location" size={24} color="#fff" />}
        {status === "locked" && (
          <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textSubtle} />
        )}
      </Pressable>

      <Text
        numberOfLines={1}
        style={{
          marginTop: LABEL_OFFSET,
          fontSize: 11,
          fontWeight: isLocked ? "500" : "700",
          color: isLocked ? theme.colors.textSubtle : theme.colors.text,
          maxWidth: 84,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Journey map canvas ────────────────────────────────────────────────────────

function JourneyMap({
  days,
  todayDay,
  onNodePress,
  mapWidth,
}: {
  days: PersonalizedRoadmapDay[];
  todayDay: PersonalizedRoadmapDay | null;
  onNodePress: (day: PersonalizedRoadmapDay) => void;
  mapWidth: number;
}) {
  const mapH = days.length * SLOT_H + LABEL_OFFSET + 20;

  return (
    <View style={{ width: mapWidth, height: mapH }}>
      {/* Connectors first so nodes render on top */}
      {days.map((_, i) => (
        <Connector key={`c${i}`} i={i} days={days} mapWidth={mapWidth} />
      ))}
      {days.map((day, i) => (
        <JourneyNode
          key={day.id}
          i={i}
          day={day}
          status={statusOf(day, todayDay)}
          onPress={() => onNodePress(day)}
          mapWidth={mapWidth}
        />
      ))}
    </View>
  );
}

// ── Lesson popup card ─────────────────────────────────────────────────────────

function LessonCard({
  day,
  dogName,
  onClose,
  onContinue,
}: {
  day: PersonalizedRoadmapDay;
  dogName: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const isCompleted = !!day.completedAt;
  const title = day.primaryActivity?.title ?? `Day ${day.dayNumber}`;
  const goal = day.primaryActivity?.lessonGoal ?? `Continue ${dogName}'s training journey.`;
  const shortGoal = goal.length > 90 ? goal.slice(0, 89) + "…" : goal;
  const silver = activitySilver(day);
  const levelUpPossible = canLevelUp(day);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Pin */}
          <View style={styles.pinCircle}>
            <Ionicons name="location" size={20} color="#fff" />
          </View>

          {/* Label */}
          <Text style={styles.cardLabel}>
            {isCompleted ? "Completed Lesson" : "Current Lesson"}
          </Text>

          {/* Thumbnail + title */}
          <View style={styles.cardRow}>
            <View style={styles.thumb}>
              <MaterialCommunityIcons name="paw" size={30} color={theme.colors.primaryDark} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={3}>
              {title}
            </Text>
          </View>

          {/* Goal */}
          <Text style={styles.cardGoal}>{shortGoal}</Text>

          {/* Rewards row */}
          <View style={styles.rewardRow}>
            <View style={styles.rewardPill}>
              <MaterialCommunityIcons name="currency-usd" size={14} color={theme.colors.silver} />
              <Text style={styles.rewardText}>+{silver} silver</Text>
            </View>
            {levelUpPossible && (
              <View style={styles.levelPill}>
                <Ionicons name="arrow-up-circle" size={14} color={theme.colors.gold} />
                <Text style={styles.levelText}>Level up possible</Text>
              </View>
            )}
          </View>

          {/* Difficulty badge */}
          <Text style={styles.difficultyText}>
            Stage: <Text style={styles.difficultyValue}>{day.difficultyMode.replace(/_/g, " ")}</Text>
          </Text>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.continueBtn, { opacity: pressed ? 0.88 : 1 }]}
            onPress={onContinue}
            accessibilityRole="button"
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.continueBtnText}>{isCompleted ? "Review" : "Continue"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Generate plan card ────────────────────────────────────────────────────────

function GenerateCard({
  dogName,
  loading,
  error,
  onGenerate,
}: {
  dogName: string;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <View style={styles.generateCard}>
      <MaterialCommunityIcons
        name="map-marker-path"
        size={52}
        color={theme.colors.primary}
      />
      <Text style={styles.generateTitle}>No journey yet</Text>
      <Text style={styles.generateDesc}>
        PAWS will build a personalized training journey for {dogName} based on your goals.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable
        style={[styles.generateBtn, loading && styles.disabledBtn]}
        onPress={onGenerate}
        disabled={loading}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>Generate Journey</Text>
        )}
      </Pressable>
    </View>
  );
}

// ── Shared node shadow ────────────────────────────────────────────────────────

const nodeShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.16,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
} as const;

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TrainTabScreen() {
  const { width } = useWindowDimensions();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;

  const {
    roadmap,
    todayDay,
    days,
    isLoading: roadmapLoading,
    error: roadmapError,
    refetch,
  } = useDogRoadmap(dogId);
  const { data: streak } = useDogStreak(dogId);
  const wallet = useWallet(dogId ?? "");
  useProfileDashboard(dogId);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonalizedRoadmapDay | null>(null);

  const isLoading = dog.isLoading || roadmapLoading;
  const error = dog.error || roadmapError;
  const currentStreak = streak?.currentStreak ?? 0;
  const completedCount = days.filter((d) => d.completedAt).length;
  const mapWidth = Math.max(280, Math.min(width - H_PAD * 2, 560));

  const handleGenerate = async (force = false) => {
    if (!dogId) return;
    try {
      setGenerating(true);
      setGenerateError(null);
      await generateRoadmap(dogId, force);
      void refetch();
    } catch (e) {
      setGenerateError(getErrorMessage(e, "Plan generation failed. Please retry."));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState message="Loading your journey…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          message="Training journey could not load."
          onRetry={() => {
            void dog.refetch();
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!dog.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          title="Your journey starts here"
          description="Create a dog profile to begin training together."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <ProfileIconButton label={dog.data.name} />
        <Text style={styles.headerTitle} numberOfLines={1}>Current Journey</Text>
        <View style={styles.headerRight}>
          {wallet.data ? (
            <View style={styles.silverPill}>
              <MaterialCommunityIcons name="currency-usd" size={13} color={theme.colors.silver} />
              <Text style={styles.silverNum}>{wallet.data.silverBalance.toLocaleString()}</Text>
            </View>
          ) : null}
          <Pressable
            style={styles.viewAllBtn}
            onPress={() => router.push("/training/history")}
            accessibilityRole="button"
          >
            <Text style={styles.viewAllText}>All Lessons</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primaryDark} />
          </Pressable>
        </View>
      </View>

      <SaveProgressBanner />

      {/* Progress strip */}
      {roadmap && days.length > 0 && (
        <View style={styles.progressStrip}>
          {currentStreak > 0 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNum}>{currentStreak}</Text>
            </View>
          )}
          <Text style={styles.progressText}>
            {completedCount} / {days.length} completed
          </Text>
          <View style={styles.rewardHint}>
            <MaterialCommunityIcons name="currency-usd" size={12} color={theme.colors.silver} />
            <Text style={styles.rewardHintText}>Earn silver · spend in Game</Text>
          </View>
        </View>
      )}

      {/* Map or generate */}
      {!roadmap ? (
        <ScrollView contentContainerStyle={styles.padded}>
          <GenerateCard
            dogName={dog.data.name}
            loading={generating}
            error={generateError}
            onGenerate={() => void handleGenerate()}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.mapScroll}
          showsVerticalScrollIndicator={false}
        >
          <JourneyMap
            days={days}
            todayDay={todayDay}
            onNodePress={setSelected}
            mapWidth={mapWidth}
          />
        </ScrollView>
      )}

      {/* Lesson card popup */}
      {selected && (
        <LessonCard
          day={selected}
          dogName={dog.data.name}
          onClose={() => setSelected(null)}
          onContinue={() => {
            setSelected(null);
            router.push(`/train/activity/${selected.id}?totalDays=${days.length}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.3,
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  silverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.silverSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  silverNum: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.silver,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },

  // Progress strip
  progressStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.secondarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakEmoji: { fontSize: 13 },
  streakNum: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.secondary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  rewardHint: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rewardHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSubtle,
  },

  // Map scroll
  mapScroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 100,
    alignItems: "center",
  },

  padded: {
    padding: H_PAD,
    gap: 16,
  },

  // Generate card
  generateCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  generateTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
  },
  generateDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: "700",
    textAlign: "center",
  },
  generateBtn: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: "center",
    marginTop: 8,
  },
  disabledBtn: { opacity: 0.55 },
  generateBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  // Lesson card overlay
  overlay: {
    flex: 1,
    backgroundColor: "rgba(36,50,38,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: H_PAD,
  },
  card: {
    width: "100%",
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 22,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  pinCircle: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#DC2626",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 24,
  },
  cardGoal: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.silverSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.silver,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.gold,
  },
  difficultyText: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    fontWeight: "600",
  },
  difficultyValue: {
    color: theme.colors.text,
    fontWeight: "800",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 2,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
