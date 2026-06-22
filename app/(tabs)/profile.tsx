import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GoldBar } from "@/components/ui/GoldBar";

import { MascotFallback } from "@/components/mascot/MascotFallback";
import { AnonymousAccountWarningModal } from "@/components/account/AnonymousAccountWarningModal";
import { SaveProgressBanner } from "@/components/account/SaveProgressBanner";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useAuth } from "@/providers/AuthProvider";
import type { DogStatus } from "@/types/domain";

const fmt = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const SKILL_ICONS: Record<keyof DogStatus, keyof typeof Ionicons.glyphMap> = {
  focus: "eye-outline",
  discipline: "ribbon-outline",
  social: "people-outline",
  energy: "flash-outline",
  intelligence: "bulb-outline",
};

const SKILL_LABELS: Array<[keyof DogStatus, string]> = [
  ["focus", "Focus"],
  ["discipline", "Discipline"],
  ["social", "Social"],
  ["energy", "Energy"],
  ["intelligence", "Intelligence"],
];

export default function ProfileTabScreen() {
  const dog = useCurrentDog();
  const dashboard = useProfileDashboard(dog.data?.id);
  const auth = useAuth();
  const account = useAccountStatus();
  const [showAnonymousWarning, setShowAnonymousWarning] = useState(false);

  if (dog.isLoading || dashboard.isLoading)
    return <ScreenContainer centered><LoadingState message="Loading profile..." /></ScreenContainer>;
  if (!dog.data || dashboard.error)
    return <ScreenContainer centered><ErrorState message="Profile dashboard could not load." onRetry={() => void dashboard.refetch()} /></ScreenContainer>;

  const data = dashboard.data;
  const level = data?.level ?? 1;
  const bondXp = data?.bondXp ?? 0;
  const xpInLevel = bondXp % 1000;
  const xpProgress = xpInLevel / 1000;

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Dog</Text>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => router.push("/notifications-settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={19} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <SaveProgressBanner />

      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <MascotFallback size={76} />
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{level}</Text>
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{dog.data.name}</Text>
            <Text style={styles.heroBreed}>{dog.data.breed}</Text>
            <View style={styles.dogTagRow}>
              <Text style={styles.dogTag}>{dog.data.dogTag}</Text>
            </View>
          </View>
        </View>

        {/* XP progress */}
        <View style={styles.xpSection}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLabel}>Bond Level {level}</Text>
            <Text style={styles.xpValue}>{xpInLevel.toLocaleString()} / 1,000 XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.max(Math.round(xpProgress * 100), 2)}%` as `${number}%` }]} />
          </View>
          <Text style={styles.xpNext}>{(1000 - xpInLevel).toLocaleString()} XP to Level {level + 1}</Text>
        </View>

        {/* Currency */}
        {data ? (
          <View style={styles.currencyRow}>
            <View style={styles.currencyPill}>
              <Ionicons name="cash-outline" size={14} color={theme.colors.silver} />
              <Text style={[styles.currencyAmount, { color: theme.colors.silver }]}>
                {data.wallet.silverBalance.toLocaleString()}
              </Text>
              <Text style={styles.currencyLabel}>Silver</Text>
            </View>
            <View style={[styles.currencyPill, { backgroundColor: theme.colors.goldSoft }]}>
              <GoldBar size={14} />
              <Text style={[styles.currencyAmount, { color: theme.colors.gold }]}>
                {data.wallet.goldBalance.toLocaleString()}
              </Text>
              <Text style={styles.currencyLabel}>Gold</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Stat strip */}
      <View style={styles.statStrip}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: theme.colors.primaryDark }]}>
            {bondXp.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Bond XP</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: theme.colors.secondary }]}>
            {data?.streak ?? 0}
          </Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: theme.colors.primary }]}>
            {data?.trainingSummary?.completedSkills ?? 0}
          </Text>
          <Text style={styles.statLabel}>Skills Done</Text>
        </View>
      </View>

      {/* Skill Development */}
      {data ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Skill Development</Text>
          <View style={styles.skillList}>
            {SKILL_LABELS.map(([key, label]) => (
              <View key={key} style={styles.skillRow}>
                <View style={styles.skillIconWrap}>
                  <Ionicons name={SKILL_ICONS[key]} size={14} color={theme.colors.primaryDark} />
                </View>
                <Text style={styles.skillLabel}>{label}</Text>
                <View style={styles.skillTrack}>
                  <View style={[styles.skillFill, { width: `${data.status[key]}%` as `${number}%` }]} />
                </View>
                <Text style={styles.skillValue}>{data.status[key]}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* About dog */}
      <View style={styles.card}>
        <View style={styles.aboutHeader}>
          <Text style={styles.sectionLabel}>About {dog.data.name}</Text>
          <Pressable onPress={() => router.push("/profile/edit")} accessibilityRole="button">
            <Text style={styles.editLink}>Edit Profile</Text>
          </Pressable>
        </View>
        <View style={styles.aboutGrid}>
          <AboutCell label="Gender" value={fmt(dog.data.gender)} />
          <AboutCell label="Obedience" value={fmt(dog.data.obedienceLevel)} />
          <AboutCell label="Energy" value={fmt(dog.data.energyLevel)} />
        </View>
      </View>

      {/* Rewards */}
      <View style={styles.menuGroup}>
        <Text style={styles.menuGroupLabel}>Rewards</Text>
        <MenuRow
          icon="gift-outline"
          iconBg={theme.colors.goldSoft}
          iconColor={theme.colors.gold}
          label="Reward Center"
          onPress={() => router.push("/rewards")}
        />
      </View>

      {/* Account */}
      <View style={styles.menuGroup}>
        <Text style={styles.menuGroupLabel}>Account</Text>
        <MenuRow
          icon="notifications-outline"
          iconBg={theme.colors.secondarySoft}
          iconColor={theme.colors.secondary}
          label="Notifications"
          onPress={() => router.push("/notifications-settings")}
        />
        <View style={styles.menuRowDivider} />
        <MenuRow
          icon="cloud-upload-outline"
          iconBg={theme.colors.primarySoft}
          iconColor={theme.colors.primaryDark}
          label="Save Progress"
          onPress={() => router.push("/account/link")}
        />
        <View style={styles.menuRowDivider} />
        <MenuRow
          icon="log-out-outline"
          iconBg={theme.colors.errorSoft}
          iconColor={theme.colors.error}
          label="Sign Out"
          danger
          onPress={() =>
            account.data?.isAnonymous
              ? setShowAnonymousWarning(true)
              : void auth.signOut()
          }
        />
      </View>

      <AnonymousAccountWarningModal
        visible={showAnonymousWarning}
        onCancel={() => setShowAnonymousWarning(false)}
        onConfirm={() => {
          setShowAnonymousWarning(false);
          void auth.signOut();
        }}
      />
    </ScreenContainer>
  );
}

// Sub-components

const AboutCell = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.aboutCell}>
    <Text style={styles.aboutCellLabel}>{label}</Text>
    <Text style={styles.aboutCellValue}>{value}</Text>
  </View>
);

const MenuRow = ({
  icon,
  iconBg,
  iconColor,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable
    style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    onPress={onPress}
    accessibilityRole="button"
  >
    <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={17} color={iconColor} />
    </View>
    <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
    {!danger && (
      <Ionicons name="chevron-forward" size={16} color={theme.colors.borderStrong} />
    )}
  </Pressable>
);

// Styles

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.cardMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    gap: 14,
    ...theme.shadows.soft,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    position: "relative",
    width: 76,
    height: 76,
    flexShrink: 0,
  },
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.2,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroName: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  heroBreed: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  dogTagRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  dogTag: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textSubtle,
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  xpSection: { gap: 6 },
  xpLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  xpLabel: { fontSize: 12, fontWeight: "800", color: theme.colors.primaryDark },
  xpValue: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted },
  xpTrack: {
    height: 7,
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.pill,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
  },
  xpNext: { fontSize: 11, color: theme.colors.textSubtle, fontWeight: "600" },

  currencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.colors.silverSoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  currencyAmount: {
    fontSize: 14,
    fontWeight: "900",
  },
  currencyLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },

  statStrip: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    ...theme.shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 3,
  },
  statDiv: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  skillList: { gap: 10 },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  skillIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  skillLabel: {
    width: 78,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },
  skillTrack: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.pill,
    overflow: "hidden",
  },
  skillFill: {
    height: "100%",
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
    minWidth: 3,
  },
  skillValue: {
    width: 24,
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primaryDark,
    textAlign: "right",
  },

  aboutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editLink: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },
  aboutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aboutCell: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.md,
    padding: 12,
    gap: 3,
  },
  aboutCellLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  aboutCellValue: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },

  menuGroup: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    ...theme.shadows.soft,
  },
  menuGroupLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
    gap: 12,
  },
  menuRowPressed: {
    backgroundColor: theme.colors.cardMuted,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: theme.typography.sm,
    fontWeight: "700",
    color: theme.colors.text,
  },
  menuLabelDanger: {
    color: theme.colors.error,
  },
  menuRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginLeft: 56,
  },
});
