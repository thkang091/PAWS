import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ClockCounterClockwiseIcon, FireIcon, GraduationCapIcon } from "phosphor-react-native";

import { COIN_TINT, CoinGlyph } from "@/components/shop/ProductArt";
import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { SegmentedTabs } from "@/features/profile/components/SegmentedTabs";
import { areLessonVideosUnlocked } from "@/features/train/media/lessonVideoUnlock";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogStreak } from "@/hooks/useDogStreak";
import { useWallet } from "@/hooks/useWallet";
import { getDogTrainingOverview } from "@/services/trainingCurriculumService";
import { getWalletEntries, type WalletEntry } from "@/services/walletService";
import { accent, bg, border, icon as iconSize, motion, radius, scene, space, text, type } from "@/constants/design";

type Tab = "lessons" | "coins";
const TABS: readonly { key: Tab; label: string }[] = [
  { key: "lessons", label: "Lessons" },
  { key: "coins", label: "Coins" },
];

const REASON: Record<string, string> = {
  care_routine_completed: "Daily care done",
  challenge_game_passed: "Challenge passed",
  game_entry_fee: "Game entry",
  challenge_game_entry_fee: "Challenge entry",
  coupon_purchase: "Coupon",
  shop_item_purchase: "Shop",
  avatar_item_purchase: "Outfit",
  pet_reward_redemption: "Gift card",
  pet_reward_refund: "Gift card refund",
  arena_personal_best: "Personal best",
  arena_duel_won: "Duel won",
  arena_duel_played: "Duel played",
  arena_weekly_prize: "Weekly prize",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/**
 * Training history in two views. Lessons: what needs practice first, then what is in progress and what is done,
 * each with its level and when it was last practised. Coins: the two balances (gold for gift cards, silver for games)
 * and every coin earned or spent, day by day.
 */
export default function TrainingHistoryScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "coins" ? "coins" : "lessons");
  // Opened again from the coin pill while already on screen: follow the link.
  useEffect(() => {
    if (params.tab === "coins" || params.tab === "lessons") setTab(params.tab);
  }, [params.tab]);
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const name = dog.data?.name ?? "your dog";
  const streak = useDogStreak(dogId);
  const wallet = useWallet(dogId);

  const overview = useQuery({
    queryKey: dogId ? queryKeys.dogTrainingOverview(dogId) : ["dogTrainingOverview", "missing"],
    queryFn: () => getDogTrainingOverview(dogId ?? ""),
    enabled: Boolean(dogId),
  });
  const entries = useQuery({
    queryKey: dogId ? ["walletEntries", dogId] : ["walletEntries", "missing"],
    queryFn: () => getWalletEntries(dogId ?? ""),
    enabled: Boolean(dogId) && tab === "coins",
  });

  const groups = useMemo(() => {
    const rows = overview.data ?? [];
    const complete = (r: (typeof rows)[number]) => areLessonVideosUnlocked(r.progress);
    return [
      { key: "practice", title: "Practise again", rows: rows.filter((r) => !complete(r) && r.progress.needsReinforcement) },
      { key: "going", title: "In progress", rows: rows.filter((r) => !complete(r) && !r.progress.needsReinforcement) },
      { key: "done", title: "Learned", rows: rows.filter(complete) },
    ].filter((g) => g.rows.length);
  }, [overview.data]);
  const learned = (overview.data ?? []).filter((r) => areLessonVideosUnlocked(r.progress)).length;

  const days = useMemo(() => {
    const map = new Map<string, WalletEntry[]>();
    (entries.data ?? []).forEach((e) => map.set(dayLabel(e.at), [...(map.get(dayLabel(e.at)) ?? []), e]));
    return [...map.entries()];
  }, [entries.data]);

  const rise = (order: number) => (reduceMotion ? undefined : enter({ y: 10 }, { delay: order * 50, duration: motion.duration.enter }));

  return (
    <DetailShell title="History" glyph={<ClockCounterClockwiseIcon size={iconSize.standard} color={text.primary} weight="regular" />} back="/(tabs)/train">
      <View style={styles.tabs}>
        <SegmentedTabs
          options={TABS}
          value={tab}
          onChange={(next) => {
            void Haptics.selectionAsync();
            setTab(next);
          }}
        />
      </View>

      {tab === "lessons" ? (
        <Animated.View key="lessons" entering={rise(0)}>
          <View style={styles.stats}>
            <Stat Icon={GraduationCapIcon} value={learned} label="Learned" />
            <Stat Icon={ClockCounterClockwiseIcon} value={(overview.data ?? []).length - learned} label="In progress" />
            <Stat Icon={FireIcon} value={streak.data?.currentStreak ?? 0} label="Day streak" />
          </View>

          {overview.isLoading ? (
            <View style={styles.skeleton} />
          ) : groups.length === 0 ? (
            <Empty title="No lessons yet" body={`Start one on Train and ${name}'s progress shows up here.`} action="Go to Train" onAction={() => router.back()} />
          ) : (
            groups.map((g, gi) => (
              <Animated.View key={g.key} entering={rise(gi + 1)}>
                <Text style={styles.section}>{g.title}</Text>
                <View style={styles.list}>
                  {g.rows.map((r, i) => {
                    const done = g.key === "done";
                    const level = done ? 5 : Math.max(0, r.progress.currentLevelNumber - 1);
                    return (
                      <PressScale
                        key={r.skill.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.skill.title}, ${done ? "learned" : `level ${r.progress.currentLevelNumber} of 5`}`}
                        scaleTo={0.985}
                        style={[styles.row, i > 0 && styles.ruled]}
                        onPress={() => router.push(`/train/lesson/${r.skill.id}` as never)}
                      >
                        <View style={styles.flex}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {r.skill.title}
                          </Text>
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {[r.sectionTitle, ago(r.progress.lastPracticedAt), r.progress.reviewSoon ? "Review soon" : null].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        <View style={styles.levels} accessibilityElementsHidden>
                          {[0, 1, 2, 3, 4].map((n) => (
                            <View key={n} style={[styles.level, n < level && (g.key === "practice" ? styles.levelPractice : styles.levelOn)]} />
                          ))}
                        </View>
                      </PressScale>
                    );
                  })}
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>
      ) : (
        <Animated.View key="coins" entering={rise(0)}>
          <View style={styles.stats}>
            <Balance tone="gold" value={wallet.data?.goldBalance} label="Gold" from="From challenges" spend="Gift cards" onPress={() => router.push("/game/shop" as never)} />
            <Balance tone="silver" value={wallet.data?.silverBalance} label="Silver" from="From daily care" spend="Games" onPress={() => router.push("/(tabs)/game" as never)} />
          </View>

          {entries.isLoading ? (
            <View style={styles.skeleton} />
          ) : days.length === 0 ? (
            <Empty title="No coins yet" body="Tick off today's care to earn your first silver." action="Open Care" onAction={() => router.push("/(tabs)/care" as never)} />
          ) : (
            days.map(([label, list], gi) => (
              <Animated.View key={label} entering={rise(gi + 1)}>
                <Text style={styles.section}>{label}</Text>
                <View style={styles.list}>
                  {list.map((e, i) => (
                    <View key={e.id} style={[styles.row, i > 0 && styles.ruled]}>
                      <CoinGlyph size={20} tone={e.currency} />
                      <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
                        {REASON[e.reason] ?? e.reason.replace(/_/g, " ")}
                      </Text>
                      <Text style={[styles.amount, e.amount > 0 ? styles.plus : styles.minus]}>{`${e.amount > 0 ? "+" : "-"}${Math.abs(e.amount).toLocaleString()}`}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>
      )}
    </DetailShell>
  );
}

const Stat = ({ Icon, value, label }: { Icon: typeof FireIcon; value: number; label: string }) => (
  <View style={styles.stat} accessibilityLabel={`${value} ${label}`}>
    <Icon size={18} color={accent.band} weight="fill" />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/** A balance in the same tile as the lesson stats: the coin, the count, where it comes from, and where it goes. */
const Balance = ({ tone, value, label, from, spend, onPress }: { tone: "gold" | "silver"; value: number | undefined; label: string; from: string; spend: string; onPress: () => void }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={`${value ?? 0} ${label.toLowerCase()} coins. ${from}. Spend on ${spend.toLowerCase()}`} scaleTo={0.97} style={[styles.stat, styles.balance]} onPress={onPress}>
    <CoinGlyph size={24} tone={tone} />
    <Text style={styles.balanceValue}>{value != null ? value.toLocaleString() : "—"}</Text>
    <Text style={styles.statLabel}>{`${label} · ${from.toLowerCase()}`}</Text>
    <View style={[styles.spend, { borderColor: COIN_TINT[tone] }]}>
      <Text style={styles.spendText}>{spend}</Text>
    </View>
  </PressScale>
);

const Empty = ({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    <PressScale accessibilityRole="button" accessibilityLabel={action} scaleTo={0.96} style={styles.emptyAction} onPress={onAction}>
      <Text style={styles.emptyActionText}>{action}</Text>
    </PressScale>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { marginTop: space.md },
  stats: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  statValue: { ...type.sectionTitle, color: text.primary, fontVariant: ["tabular-nums"], marginTop: 4 },
  statLabel: { ...type.caption, color: text.tertiary },

  section: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginTop: space.xxl, marginBottom: space.md },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden", backgroundColor: bg.canvas },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowSub: { ...type.caption, color: text.tertiary, marginTop: 2 },
  levels: { flexDirection: "row", gap: 3 },
  level: { width: 6, height: 16, borderRadius: 3, backgroundColor: bg.subtle },
  levelOn: { backgroundColor: scene.sageDeep },
  levelPractice: { backgroundColor: accent.band },

  balance: { paddingVertical: space.xl },
  balanceValue: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.6, color: text.primary, fontVariant: ["tabular-nums"], marginTop: 4 },
  spend: { marginTop: space.md, paddingHorizontal: space.md, height: 26, borderRadius: radius.pill, borderWidth: 1.5, justifyContent: "center" },
  spendText: { ...type.caption, fontWeight: "700", color: text.primary },
  amount: { ...type.cardTitle, fontWeight: "700", fontVariant: ["tabular-nums"] },
  plus: { color: scene.sageDeep },
  minus: { color: text.secondary },

  skeleton: { height: 160, marginTop: space.xxl, borderRadius: radius.card, backgroundColor: bg.subtle },
  empty: { alignItems: "center", marginTop: space.section, gap: space.sm },
  emptyTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  emptyBody: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 280 },
  emptyAction: { marginTop: space.md, paddingHorizontal: space.xl, height: 44, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  emptyActionText: { ...type.supporting, fontWeight: "700", color: text.primary },
});
