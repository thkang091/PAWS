import { StyleSheet, Text, View } from "react-native";

import { MascotFallback } from "@/components/mascot/MascotFallback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";

type DogProgressMiniCardProps = {
  dogName: string;
  breed?: string;
  level: number;
  bondXp: number;
  todayXpAvailable?: number;
};

const XP_PER_LEVEL = 1000;

export const DogProgressMiniCard = ({
  dogName,
  breed,
  level,
  bondXp,
  todayXpAvailable = 0,
}: DogProgressMiniCardProps) => {
  const xpInLevel = bondXp % XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL - xpInLevel;
  const progress = xpInLevel / XP_PER_LEVEL;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <MascotFallback size={54} />
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{level}</Text>
          </View>
        </View>

        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {dogName}
            </Text>
            <Text style={styles.levelText}>Bond Lv. {level}</Text>
          </View>

          {breed ? (
            <Text style={styles.breed} numberOfLines={1}>
              {breed}
            </Text>
          ) : null}

          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>
              {xpInLevel.toLocaleString()} / {XP_PER_LEVEL.toLocaleString()} XP
            </Text>
            <Text style={styles.nextLabel}>
              {xpToNext.toLocaleString()} XP to Lv. {level + 1}
            </Text>
          </View>

          <ProgressBar
            progress={progress}
            accessibilityLabel={`${dogName} bond level progress`}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {todayXpAvailable > 0
            ? `Complete today's training to earn +${todayXpAvailable} XP`
            : "Complete training to grow your bond"}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  levelBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderColor: theme.colors.card,
    borderWidth: 2,
  },
  levelBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "900",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.lg,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  levelText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.xs,
    fontWeight: "900",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    overflow: "hidden",
  },
  breed: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sm,
    fontWeight: "600",
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  xpLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.xs,
    fontWeight: "800",
  },
  nextLabel: {
    color: theme.colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  footerText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.xs,
    fontWeight: "800",
    textAlign: "center",
  },
});