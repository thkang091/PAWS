import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowSquareOutIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, GiftIcon, HourglassMediumIcon, XIcon } from "phosphor-react-native";

import { Coin } from "@/components/shop/ProductArt";
import { CountUp } from "@/features/profile/components/CountUp";
import { enter } from "@/features/care/food/enter";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useClaimLink, usePetCatalog, usePrefetchPetCatalog, useRedeemPetReward, useRedemptions, useResumeRedemption } from "@/hooks/usePetRewards";
import { useWallet } from "@/hooks/useWallet";
import { browsable } from "@/services/storeBrowse";
import { PetRewardError, newRedeemKey, type PetReward, type PetRewardErrorCode, type Redemption } from "@/services/petRewardsService";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

const CARD_RATIO = 1.586;

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
const coins = (n: number) => n.toLocaleString();

/** Every server answer in plain words. Nothing fails silently. */
const SAY: Record<PetRewardErrorCode, string> = {
  unauthorized: "Your session ended. Sign in again to use the Pet Shop.",
  account_required: "Gift cards need a saved account. Add your email to redeem.",
  reward_unavailable: "This card is not available right now. Try another store.",
  invalid_denomination: "That amount is no longer offered. Pick another one.",
  insufficient_balance: "Not enough coins for this amount yet.",
  redemption_in_progress: "Another gift card is still being prepared. Check Your gift cards below.",
  issue_failed: "The gift card could not be issued, so your coins were returned.",
  claim_unavailable: "This card cannot be opened right now. It may already be redeemed.",
  provider_unavailable: "Gift cards are not reachable right now. Try again in a moment.",
  unconfigured: "Gift cards are not set up yet.",
  not_found: "That gift card could not be found.",
  network: "No connection. Check your internet and try again.",
};
const say = (error: unknown) => SAY[error instanceof PetRewardError ? error.code : "network"] ?? SAY.network;

/**
 * Pet Shop: gold coins become real gift cards at pet stores. The stores, amounts and prices all come from the server,
 * which reads them from Tremendous; this screen only shows them and asks for one.
 */
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const dogName = dog.data?.name ?? "your dog";

  usePrefetchPetCatalog(dogId);
  const catalog = usePetCatalog(dogId);
  const wallet = useWallet(dogId);
  const history = useRedemptions();
  const [open, setOpen] = useState<PetReward | null>(null);
  // A card someone wanted before securing their account: reopen it once they come back eligible.
  const [resumeId, setResumeId] = useState<string | null>(null);
  const params = useLocalSearchParams<{ redeem?: string }>();
  // Coming back from a store with "Gift card": open that store's card.
  useEffect(() => {
    if (!params.redeem || !catalog.data) return;
    const reward = catalog.data.rewards.find((r) => r.productId === params.redeem);
    router.setParams({ redeem: undefined } as never);
    if (reward) setOpen(reward);
  }, [params.redeem, catalog.data]);
  useEffect(() => {
    if (!resumeId || !catalog.data?.eligible) return;
    const reward = catalog.data.rewards.find((r) => r.productId === resumeId);
    setResumeId(null);
    if (reward) setOpen(reward);
  }, [resumeId, catalog.data]);

  const balance = wallet.data?.goldBalance ?? catalog.data?.goldBalance ?? 0;
  const perUsd = catalog.data?.goldPerUsd ?? 100;
  const cardWidth = Math.floor((width - layout.gutter * 2 - space.md) / 2);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => router.back()}>
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
        <View style={styles.balancePill} accessibilityLabel={`${balance} gold coins`}>
          <Coin size={18} />
          <CountUp value={balance} grouped style={styles.balanceValue} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.section }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 })}>
          <Text style={styles.title} accessibilityRole="header">
            Pet Shop
          </Text>
          <Text style={styles.lede}>{`Turn the coins ${dogName} earns into real gift cards at pet stores.`}</Text>

          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Your coins are worth</Text>
            <Text style={styles.heroValue}>{usd(Math.floor((balance / perUsd) * 100))}</Text>
            <Text style={styles.heroSub}>{`in gift cards  ·  ${coins(perUsd)} coins is $1`}</Text>
            {catalog.data && !catalog.data.eligible ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Save your account to redeem" scaleTo={0.97} style={styles.heroNote} onPress={() => router.push("/account/link?reason=redeem" as never)}>
                <Text style={styles.heroNoteText}>Earn freely. To redeem a gift card, add a way to sign in.</Text>
                <CaretRightIcon size={iconSize.inline} color={text.primary} weight="bold" />
              </PressScale>
            ) : null}
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Gift cards</Text>
        <Text style={styles.sectionLede}>From stores that stock what {dogName} needs.</Text>

        {!catalog.data && (catalog.isLoading || !dogId) ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: cardWidth }}>
                <View style={[styles.skeleton, { height: cardWidth / CARD_RATIO }]} />
                <View style={[styles.skeletonLine, { width: "60%" }]} />
                <View style={[styles.skeletonLine, { width: "40%" }]} />
              </View>
            ))}
          </View>
        ) : catalog.error && !catalog.data ? (
          <Notice title="The Pet Shop could not load" body={say(catalog.error)} action="Try again" onAction={() => void catalog.refetch()} />
        ) : !catalog.data?.rewards.length ? (
          <Notice title="No pet gift cards right now" body="Check back soon. Cards appear here as pet stores become available." />
        ) : (
          <View style={styles.grid}>
            {catalog.data.rewards.map((reward, i) => (
              <RewardCard key={reward.productId} reward={reward} balance={balance} width={cardWidth} order={i} onPress={() => setOpen(reward)} />
            ))}
          </View>
        )}

        {catalog.data?.rewards.some((r) => browsable(r.merchant)) ? (
          <>
            <Text style={styles.sectionTitle}>Browse the stores</Text>
            <Text style={styles.sectionLede}>See what a gift card buys before you redeem.</Text>
            <View style={styles.list}>
              {catalog.data.rewards
                .filter((r) => browsable(r.merchant))
                .map((r, i) => (
                  <PressScale
                    key={r.productId}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${r.merchant}`}
                    scaleTo={0.98}
                    style={[styles.listRow, i > 0 && styles.ruled]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push(`/game/store?merchant=${encodeURIComponent(r.merchant)}&productId=${encodeURIComponent(r.productId)}` as never);
                    }}
                  >
                    <View style={styles.logo}>
                      {r.logoUrl ? <Image source={{ uri: r.logoUrl }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors /> : <GiftIcon size={iconSize.standard} color={text.primary} />}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.listTitle}>{r.merchant}</Text>
                      <Text style={styles.listSub}>Food, treats, toys, beds and grooming</Text>
                    </View>
                    <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
                  </PressScale>
                ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Your gift cards</Text>
        <Text style={styles.sectionLede}>Every card you have redeemed. Open one to use it.</Text>
        <History dogId={dogId} history={history.data ?? null} loading={history.isLoading} failed={Boolean(history.error)} onRetry={() => void history.refetch()} />
      </ScrollView>

      {open && dogId ? (
        <RedeemSheet
          reward={open}
          dogId={dogId}
          balance={balance}
          eligible={catalog.data?.eligible ?? false}
          onClose={() => setOpen(null)}
          onSecure={() => {
            setResumeId(open.productId);
            setOpen(null);
            router.push("/account/link?reason=redeem" as never);
          }}
        />
      ) : null}
    </View>
  );
}

// ---------- The shelf ----------

const RewardCard = ({ reward, balance, width, order, onPress }: { reward: PetReward; balance: number; width: number; order: number; onPress: () => void }) => {
  const reduceMotion = useReducedMotion();
  const cheapest = reward.goldCosts[0];
  const short = Math.max(0, cheapest - balance);
  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ y: 14 }, { delay: 60 + order * 60 })} style={{ width }}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${reward.merchant} gift card. From ${usd(reward.minCents)} for ${coins(cheapest)} coins.${short ? ` ${coins(short)} more coins needed.` : ""}`}
        scaleTo={0.96}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
      >
        <View style={[styles.cardArt, { height: width / CARD_RATIO }]}>
          {reward.imageUrl ? (
            <Image source={{ uri: reward.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
          ) : (
            <GiftIcon size={28} color={text.primary} weight="duotone" />
          )}
        </View>
        <Text style={styles.cardMerchant} numberOfLines={1}>
          {reward.merchant}
        </Text>
        <View style={styles.cardPrice}>
          <Text style={styles.cardFrom}>{reward.minCents === reward.maxCents ? usd(reward.minCents) : `From ${usd(reward.minCents)}`}</Text>
          <Coin size={13} />
          <Text style={styles.cardCoins}>{coins(cheapest)}</Text>
        </View>
        {short ? (
          <View style={styles.saving}>
            <View style={styles.savingTrack}>
              <View style={[styles.savingFill, { width: `${Math.min(100, (balance / cheapest) * 100)}%` }]} />
            </View>
            <Text style={styles.savingText}>{`${coins(short)} more`}</Text>
          </View>
        ) : null}
      </PressScale>
    </Animated.View>
  );
};

// ---------- Redeeming ----------

type Phase = { kind: "choose" } | { kind: "busy" } | { kind: "issued"; redemptionId: string; link: string | null } | { kind: "pending"; redemptionId: string };

const RedeemSheet = ({
  reward,
  dogId,
  balance,
  eligible,
  onClose,
  onSecure,
}: {
  reward: PetReward;
  dogId: string;
  balance: number;
  eligible: boolean;
  onClose: () => void;
  onSecure: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const redeem = useRedeemPetReward(dogId);
  const resume = useResumeRedemption(dogId);
  const claim = useClaimLink();

  // Start on the largest amount you can afford, or the smallest if none.
  const affordable = reward.goldCosts.map((cost) => cost <= balance);
  const [index, setIndex] = useState(() => Math.max(0, affordable.lastIndexOf(true)));
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);
  // One key per decision to redeem: retries reuse it, so a double tap or a dropped connection cannot issue twice.
  const [requestKey, setRequestKey] = useState<string | null>(null);

  const value = reward.valuesCents[index];
  const cost = reward.goldCosts[index];
  const canAfford = cost <= balance;

  const submit = () => {
    if (!eligible) return onSecure();
    if (phase.kind === "busy" || !canAfford) return;
    const key = requestKey ?? newRedeemKey();
    setRequestKey(key);
    setError(null);
    setPhase({ kind: "busy" });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    redeem.mutate(
      { dogId, productId: reward.productId, valueCents: value, requestKey: key },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPhase(result.status === "issued" ? { kind: "issued", redemptionId: result.redemptionId, link: result.link } : { kind: "pending", redemptionId: result.redemptionId });
        },
        onError: (e) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const code = e instanceof PetRewardError ? e.code : "network";
          // A settled answer ends this attempt; a lost connection keeps the key so trying again is safe.
          if (code !== "network" && code !== "provider_unavailable") setRequestKey(null);
          setError(say(e));
          setPhase({ kind: "choose" });
        },
      },
    );
  };

  const openCard = (redemptionId: string, link: string | null) => {
    if (link) return void Linking.openURL(link);
    claim.mutate(redemptionId, {
      onSuccess: (fresh) => void Linking.openURL(fresh),
      onError: (e) => setError(say(e)),
    });
  };

  const checkAgain = (redemptionId: string) =>
    resume.mutate(redemptionId, {
      onSuccess: (result) => setPhase(result.status === "issued" ? { kind: "issued", redemptionId, link: result.link } : { kind: "pending", redemptionId }),
      onError: (e) => setError(say(e)),
    });

  return (
    <Modal visible transparent animationType="none" onRequestClose={phase.kind === "busy" ? () => undefined : onClose}>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.scrim}>
        <Pressable style={styles.flex} onPress={phase.kind === "busy" ? undefined : onClose} accessibilityLabel="Close" />
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{reward.merchant}</Text>
            {phase.kind !== "busy" ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Close" scaleTo={0.92} style={styles.close} onPress={onClose}>
                <XIcon size={iconSize.standard} color={text.primary} weight="bold" />
              </PressScale>
            ) : null}
          </View>

          <Animated.View
            key={phase.kind === "issued" ? "issued" : "card"}
            entering={reduceMotion ? undefined : enter({ y: 12, rotate: phase.kind === "issued" ? -4 : 0, scale: 0.96 }, { duration: 360 })}
            style={styles.bigArt}
          >
            {reward.imageUrl ? <Image source={{ uri: reward.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
            {phase.kind === "issued" ? (
              <View style={styles.issuedBadge}>
                <CheckIcon size={14} color={text.primary} weight="bold" />
                <Text style={styles.issuedBadgeText}>{usd(value)}</Text>
              </View>
            ) : null}
          </Animated.View>

          {phase.kind === "issued" ? (
            <>
              <Text style={styles.resultTitle}>{`Your ${usd(value)} ${reward.merchant} card is ready`}</Text>
              <Text style={styles.resultBody}>Open it to see the code. You can open it again any time from Your gift cards.</Text>
              <PressScale accessibilityRole="button" accessibilityLabel="Open gift card" scaleTo={0.97} style={styles.primary} onPress={() => openCard(phase.redemptionId, phase.link)}>
                <ArrowSquareOutIcon size={18} color={text.primary} weight="bold" />
                <Text style={styles.primaryText}>{claim.isPending ? "Opening..." : "Open gift card"}</Text>
              </PressScale>
            </>
          ) : phase.kind === "pending" ? (
            <>
              <Text style={styles.resultTitle}>Your card is on its way</Text>
              <Text style={styles.resultBody}>The store has not confirmed it yet. Your coins are held, not lost: if it does not go through, they come back.</Text>
              <PressScale accessibilityRole="button" accessibilityLabel="Check again" scaleTo={0.97} style={styles.primary} onPress={() => checkAgain(phase.redemptionId)}>
                <Text style={styles.primaryText}>{resume.isPending ? "Checking..." : "Check again"}</Text>
              </PressScale>
            </>
          ) : (
            <>
              <Text style={styles.label}>Amount</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.values} style={styles.valuesBleed}>
                {reward.valuesCents.map((cents, i) => {
                  const on = i === index;
                  return (
                    <PressScale
                      key={cents}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: phase.kind === "busy" }}
                      accessibilityLabel={`${usd(cents)} for ${coins(reward.goldCosts[i])} coins${affordable[i] ? "" : ", not enough coins"}`}
                      scaleTo={0.95}
                      disabled={phase.kind === "busy"}
                      style={[styles.value, on && styles.valueOn, !affordable[i] && !on && styles.valueShort]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setIndex(i);
                        setRequestKey(null);
                        setError(null);
                      }}
                    >
                      <Text style={[styles.valueText, on && styles.valueTextOn]}>{usd(cents)}</Text>
                      <Text style={[styles.valueCost, on && styles.valueCostOn]}>{coins(reward.goldCosts[i])}</Text>
                    </PressScale>
                  );
                })}
              </ScrollView>

              <View style={styles.summary}>
                <Row label="Costs" value={`${coins(cost)} coins`} />
                <Row label={canAfford ? "Left after" : "You need"} value={`${coins(canAfford ? balance - cost : cost - balance)} ${canAfford ? "coins" : "more coins"}`} strong={!canAfford} />
              </View>

              {error ? (
                <Animated.Text entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.error} accessibilityRole="alert">
                  {error}
                </Animated.Text>
              ) : null}

              <PressScale
                accessibilityRole="button"
                accessibilityState={{ disabled: (eligible && !canAfford) || phase.kind === "busy", busy: phase.kind === "busy" }}
                accessibilityLabel={eligible ? `Redeem ${usd(value)} for ${coins(cost)} coins` : "Add a way to sign in to redeem"}
                disabled={(eligible && !canAfford) || phase.kind === "busy"}
                scaleTo={0.97}
                style={[styles.primary, eligible && !canAfford && styles.primaryOff, phase.kind === "busy" && styles.primaryBusy]}
                onPress={submit}
              >
                <Text style={[styles.primaryText, eligible && !canAfford && styles.primaryTextOff]}>
                  {phase.kind === "busy" ? "Getting your card..." : !eligible ? "Add a way to sign in to redeem" : canAfford ? `Redeem ${usd(value)}` : "Not enough coins yet"}
                </Text>
              </PressScale>
              {browsable(reward.merchant) ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Browse ${reward.merchant} first`}
                  scaleTo={0.96}
                  style={styles.browse}
                  onPress={() => {
                    onClose();
                    router.push(`/game/store?merchant=${encodeURIComponent(reward.merchant)}&productId=${encodeURIComponent(reward.productId)}` as never);
                  }}
                >
                  <Text style={styles.browseText}>{`See what ${reward.merchant} sells`}</Text>
                </PressScale>
              ) : null}
              <Text style={styles.fine}>Gift cards are delivered by Tremendous and cannot be exchanged back for coins.</Text>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const Row = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
  </View>
);

// ---------- History ----------

const STATUS: Record<Redemption["status"], string> = {
  issued: "Ready to use",
  pending: "Being prepared",
  failed: "Did not go through, coins returned",
  cancelled: "Cancelled",
};

const History = ({ dogId, history, loading, failed, onRetry }: { dogId?: string; history: readonly Redemption[] | null; loading: boolean; failed: boolean; onRetry: () => void }) => {
  const claim = useClaimLink();
  const resume = useResumeRedemption(dogId);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading) return <View style={[styles.skeleton, { height: 72 }]} />;
  if (failed) return <Notice title="Your gift cards could not load" body="Check your connection." action="Try again" onAction={onRetry} />;
  if (!history?.length) return <Notice title="No gift cards yet" body="Cards you redeem show up here, ready to open again." />;

  const act = (r: Redemption) => {
    setMessage(null);
    setBusyId(r.id);
    if (r.status === "issued") {
      claim.mutate(r.id, {
        onSuccess: (link) => void Linking.openURL(link),
        onError: (e) => setMessage(say(e)),
        onSettled: () => setBusyId(null),
      });
    } else if (r.status === "pending") {
      resume.mutate(r.id, { onError: (e) => setMessage(say(e)), onSettled: () => setBusyId(null) });
    } else setBusyId(null);
  };

  return (
    <View>
      {message ? (
        <Text style={styles.error} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      <View style={styles.list}>
        {history.map((r, i) => {
          const actionable = r.status === "issued" || r.status === "pending";
          return (
            <PressScale
              key={r.id}
              accessibilityRole={actionable ? "button" : "text"}
              accessibilityLabel={`${usd(r.valueCents)} ${r.merchant}. ${STATUS[r.status]}. ${coins(r.goldCost)} coins.`}
              scaleTo={0.98}
              disabled={!actionable || busyId === r.id}
              style={[styles.listRow, i > 0 && styles.ruled]}
              onPress={() => act(r)}
            >
              <View style={[styles.disc, r.status === "pending" && styles.discOn]}>
                {r.status === "pending" ? (
                  <HourglassMediumIcon size={iconSize.standard} color={text.primary} weight="regular" />
                ) : (
                  <GiftIcon size={iconSize.standard} color={text.primary} weight="regular" />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.listTitle}>{`${usd(r.valueCents)} ${r.merchant}`}</Text>
                <View style={styles.statusRow}>
                  {r.status === "pending" ? <View style={styles.flag} /> : null}
                  <Text style={styles.listSub} numberOfLines={1}>
                    {`${STATUS[r.status]}  ·  ${new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}  ·  ${coins(r.goldCost)} coins`}
                  </Text>
                </View>
              </View>
              {actionable ? (
                <Text style={styles.listAction}>{busyId === r.id ? "..." : r.status === "issued" ? "Open" : "Check"}</Text>
              ) : null}
            </PressScale>
          );
        })}
      </View>
    </View>
  );
};

const Notice = ({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) => (
  <View style={styles.notice}>
    <Text style={styles.noticeTitle}>{title}</Text>
    <Text style={styles.noticeBody}>{body}</Text>
    {action && onAction ? (
      <PressScale accessibilityRole="button" accessibilityLabel={action} scaleTo={0.96} style={styles.noticeAction} onPress={onAction}>
        <Text style={styles.noticeActionText}>{action}</Text>
      </PressScale>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  round: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  balancePill: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  balanceValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },

  content: { paddingHorizontal: layout.gutter, paddingTop: space.md },
  title: { ...type.pageTitle, color: text.primary },
  lede: { ...type.supporting, color: text.secondary, marginTop: 4 },

  hero: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroLabel: { ...type.supporting, color: text.secondary },
  heroValue: { fontSize: 48, lineHeight: 52, letterSpacing: -1.6, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"], marginTop: 2 },
  heroSub: { ...type.supporting, color: text.secondary },
  heroNote: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.control, backgroundColor: bg.canvas },
  heroNoteText: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },

  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.section },
  sectionLede: { ...type.supporting, color: text.secondary, marginTop: 2, marginBottom: space.lg },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, rowGap: space.xl },
  cardArt: { borderRadius: 14, backgroundColor: bg.subtle, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border.soft },
  cardMerchant: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.sm },
  cardPrice: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardFrom: { ...type.caption, fontSize: 13, color: text.secondary, marginRight: 4 },
  cardCoins: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  saving: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  savingTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: bg.subtle, overflow: "hidden" },
  savingFill: { height: 4, borderRadius: 2, backgroundColor: accent.band },
  savingText: { ...type.caption, fontSize: 11, color: text.tertiary, fontVariant: ["tabular-nums"] },
  skeleton: { borderRadius: 14, backgroundColor: bg.subtle },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: bg.subtle, marginTop: space.sm },

  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: bg.canvas, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter, paddingTop: space.md },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: border.default, alignSelf: "center" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg },
  sheetTitle: { ...type.pageTitle, fontSize: 24, color: text.primary },
  close: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  bigArt: { marginTop: space.lg, aspectRatio: CARD_RATIO, borderRadius: 18, backgroundColor: bg.subtle, overflow: "hidden", borderWidth: 1, borderColor: border.soft },
  issuedBadge: { position: "absolute", right: space.md, bottom: space.md, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, height: 30, borderRadius: radius.pill, backgroundColor: accent.deep },
  issuedBadgeText: { ...type.supporting, fontWeight: "600", color: text.primary },

  label: { ...type.supporting, fontWeight: "600", color: text.primary, marginTop: space.xl },
  valuesBleed: { marginHorizontal: -layout.gutter, marginTop: space.md },
  values: { gap: space.sm, paddingHorizontal: layout.gutter },
  value: { minWidth: 76, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.control + 2, borderWidth: 1, borderColor: border.soft, alignItems: "center" },
  valueOn: { backgroundColor: text.primary, borderColor: text.primary },
  valueShort: { opacity: 0.45 },
  valueText: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  valueTextOn: { color: text.inverse },
  valueCost: { ...type.caption, color: text.tertiary, marginTop: 2, fontVariant: ["tabular-nums"] },
  valueCostOn: { color: "rgba(255,255,255,0.7)" },

  summary: { marginTop: space.lg, paddingTop: space.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.sm },
  rowLabel: { ...type.supporting, color: text.secondary },
  rowValue: { ...type.supporting, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  rowValueStrong: { color: accent.band },

  error: { ...type.supporting, color: text.primary, marginTop: space.md, padding: space.md, borderRadius: radius.control, backgroundColor: accent.soft },
  primary: { flexDirection: "row", gap: space.sm, height: layout.controlHeight + 4, marginTop: space.lg, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  primaryOff: { backgroundColor: bg.subtle },
  primaryBusy: { opacity: 0.7 },
  primaryText: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },
  primaryTextOff: { color: text.disabled },
  browse: { alignSelf: "center", paddingVertical: space.sm, marginTop: space.sm },
  browseText: { ...type.supporting, fontWeight: "600", color: text.primary, textDecorationLine: "underline" },
  logo: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fine: { ...type.caption, color: text.tertiary, textAlign: "center", marginTop: space.md },
  resultTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.xl },
  resultBody: { ...type.supporting, color: text.secondary, marginTop: 4 },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  listTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  listSub: { ...type.caption, color: text.tertiary, flexShrink: 1 },
  listAction: { ...type.supporting, fontWeight: "600", color: text.primary },

  notice: { padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  noticeTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  noticeBody: { ...type.supporting, color: text.secondary, marginTop: 4 },
  noticeAction: { alignSelf: "flex-start", marginTop: space.md, height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  noticeActionText: { ...type.supporting, fontWeight: "600", color: text.primary },
});
