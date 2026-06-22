import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GoldBar } from "@/components/ui/GoldBar";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useCouponPurchases, useCoupons, usePurchaseCoupon } from "@/hooks/useCoupons";
import { useWallet } from "@/hooks/useWallet";
import type { Coupon } from "@/types/domain";

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Food", "Treats", "Toys", "Grooming"] as const;
type Category = (typeof CATEGORIES)[number];

type CatIconName = keyof typeof Ionicons.glyphMap;
const CAT_ICONS: Record<Category, CatIconName> = {
  All:      "grid-outline",
  Food:     "nutrition-outline",
  Treats:   "gift-outline",
  Toys:     "happy-outline",
  Grooming: "cut-outline",
};

// ── Placeholder catalog ───────────────────────────────────────────────────────
// Shown when no live coupons are in the database yet, so the shop always
// has items to browse and motivate users to earn Gold Coins.

type PlaceholderCoupon = {
  id: string;
  category: Exclude<Category, "All">;
  title: string;
  description: string;
  goldCoinCost: number;
  icon: CatIconName;
};

const PLACEHOLDER_COUPONS: PlaceholderCoupon[] = [
  // ── Food ──────────────────────────────────────────────────────────────────
  { id: "ph_food_1", category: "Food", title: "10% Off Premium Kibble", description: "Discount on any bag of premium dry dog food over 5 kg.", goldCoinCost: 5, icon: "nutrition-outline" },
  { id: "ph_food_2", category: "Food", title: "Free Wet Food Sample Pack", description: "Try 4 flavors of grain-free wet food, no purchase required.", goldCoinCost: 8, icon: "nutrition-outline" },
  { id: "ph_food_3", category: "Food", title: "Buy 2 Get 1 Free — Raw Patties", description: "Valid on any frozen raw patty 3-pack from participating stores.", goldCoinCost: 12, icon: "nutrition-outline" },
  { id: "ph_food_4", category: "Food", title: "20% Off Subscription Box", description: "First month discount on any monthly dog food subscription.", goldCoinCost: 15, icon: "nutrition-outline" },
  { id: "ph_food_5", category: "Food", title: "Free Delivery — Food Order", description: "Free shipping on your next online dog food order, any size.", goldCoinCost: 6, icon: "nutrition-outline" },
  // ── Treats ────────────────────────────────────────────────────────────────
  { id: "ph_treat_1", category: "Treats", title: "Free Training Treat Bag", description: "Complimentary 150 g bag of soft training treats.", goldCoinCost: 4, icon: "gift-outline" },
  { id: "ph_treat_2", category: "Treats", title: "15% Off Dental Chews", description: "Discount on any dental chew pack for dogs over 5 kg.", goldCoinCost: 6, icon: "gift-outline" },
  { id: "ph_treat_3", category: "Treats", title: "Buy 1 Get 1 — Freeze-Dried Treats", description: "BOGO deal on all freeze-dried meat treat varieties.", goldCoinCost: 10, icon: "gift-outline" },
  { id: "ph_treat_4", category: "Treats", title: "Puppy Starter Treat Bundle", description: "Curated bundle of 3 beginner-friendly treat bags.", goldCoinCost: 14, icon: "gift-outline" },
  { id: "ph_treat_5", category: "Treats", title: "25% Off Jerky Strips", description: "Single-ingredient chicken or beef jerky, no fillers.", goldCoinCost: 7, icon: "gift-outline" },
  // ── Toys ──────────────────────────────────────────────────────────────────
  { id: "ph_toy_1", category: "Toys", title: "Free Rope Tug Toy", description: "Heavy-duty braided rope toy suitable for medium and large dogs.", goldCoinCost: 5, icon: "happy-outline" },
  { id: "ph_toy_2", category: "Toys", title: "10% Off Puzzle Feeder", description: "Level 2 snuffle mat or slow-feeder bowl, your choice.", goldCoinCost: 9, icon: "happy-outline" },
  { id: "ph_toy_3", category: "Toys", title: "Interactive Ball Launcher", description: "Automatic fetch launcher, 3 size settings, 1 free ball included.", goldCoinCost: 20, icon: "happy-outline" },
  { id: "ph_toy_4", category: "Toys", title: "Squeaky Plush 3-Pack", description: "Set of 3 soft squeaky toys in assorted animal shapes.", goldCoinCost: 8, icon: "happy-outline" },
  { id: "ph_toy_5", category: "Toys", title: "Chew-Resistant Tug Ring", description: "Durable rubber tug ring rated for aggressive chewers.", goldCoinCost: 11, icon: "happy-outline" },
  // ── Grooming ──────────────────────────────────────────────────────────────
  { id: "ph_groom_1", category: "Grooming", title: "Free Bath & Blowout Session", description: "One complimentary bath and blowout at participating salons.", goldCoinCost: 15, icon: "cut-outline" },
  { id: "ph_groom_2", category: "Grooming", title: "20% Off Full Groom", description: "Discount on bath, haircut, nail trim, and ear clean.", goldCoinCost: 18, icon: "cut-outline" },
  { id: "ph_groom_3", category: "Grooming", title: "Nail Trim — On the House", description: "Free nail trim on your next grooming visit, no minimum spend.", goldCoinCost: 6, icon: "cut-outline" },
  { id: "ph_groom_4", category: "Grooming", title: "Deshedding Treatment Discount", description: "30% off de-shedding treatment for medium or large breeds.", goldCoinCost: 12, icon: "cut-outline" },
  { id: "ph_groom_5", category: "Grooming", title: "Spa Add-On Pack", description: "Teeth brushing, blueberry facial, and paw balm massage.", goldCoinCost: 10, icon: "cut-outline" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { kind: "purchase"; coupon: Coupon }
  | { kind: "locked"; coupon: Coupon; need: number }
  | { kind: "preview"; item: PlaceholderCoupon };

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const wallet = useWallet(dogId);
  const coupons = useCoupons();
  const purchases = useCouponPurchases(dogId);
  const purchase = usePurchaseCoupon(dogId);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [activeTab, setActiveTab] = useState<"shop" | "owned">("shop");

  if (coupons.isLoading || wallet.isLoading || purchases.isLoading) {
    return <ScreenContainer centered><LoadingState message="Loading Coupon Shop..." /></ScreenContainer>;
  }
  if (coupons.error || wallet.error) {
    return <ScreenContainer centered><ErrorState message="Coupon shop could not load." onRetry={() => { void coupons.refetch(); void wallet.refetch(); }} /></ScreenContainer>;
  }

  const gold = wallet.data?.goldBalance ?? 0;
  const catalog = coupons.data ?? [];
  const purchasedIds = new Set((purchases.data ?? []).map((p) => p.couponId));
  const ownedCoupons = purchases.data ?? [];

  // Filter live coupons by category
  const liveCatalog = catalog.filter((c) =>
    activeCategory === "All" || c.title.toLowerCase().includes(activeCategory.toLowerCase()),
  );

  // Placeholder coupons for the selected category (fill in the shop when DB is empty)
  const placeholders = PLACEHOLDER_COUPONS.filter(
    (p) => activeCategory === "All" || p.category === activeCategory,
  );

  // Use live coupons when available, otherwise fall back to placeholders
  const showLive = liveCatalog.length > 0;

  const handleCouponPress = (c: Coupon) => {
    if (purchasedIds.has(c.id)) return;
    if (gold < c.goldCoinCost) {
      setModal({ kind: "locked", coupon: c, need: c.goldCoinCost - gold });
    } else {
      setModal({ kind: "purchase", coupon: c });
    }
  };

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={theme.colors.primaryDark} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Coupon Shop</Text>
          <Text style={styles.subtitle}>Use Gold Coins to unlock coupons</Text>
        </View>
        <View style={styles.goldBadge}>
          <GoldBar size={14} />
          <Text style={styles.goldAmount}>{gold.toLocaleString()}</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.segment}>
        <Pressable style={[styles.segBtn, activeTab === "shop" && styles.segBtnActive]} onPress={() => setActiveTab("shop")}>
          <Text style={[styles.segText, activeTab === "shop" && styles.segTextActive]}>Shop</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, activeTab === "owned" && styles.segBtnActive]} onPress={() => setActiveTab("owned")}>
          <Text style={[styles.segText, activeTab === "owned" && styles.segTextActive]}>My Coupons</Text>
          {ownedCoupons.length > 0 && (
            <View style={styles.segBadge}><Text style={styles.segBadgeText}>{ownedCoupons.length}</Text></View>
          )}
        </Pressable>
      </View>

      {/* ── Shop tab ── */}
      {activeTab === "shop" && (
        <>
          {/* Gold balance hint */}
          {gold === 0 ? (
            <Pressable style={styles.earnBanner} onPress={() => router.push("/(tabs)/game")} accessibilityRole="button">
              <View style={styles.earnBannerIcon}>
                <Ionicons name="game-controller-outline" size={18} color={theme.colors.primaryDark} />
              </View>
              <View style={styles.earnBannerCopy}>
                <Text style={styles.earnBannerTitle}>Start earning Gold Coins</Text>
                <Text style={styles.earnBannerSub}>Win gold in Challenge Games, then unlock the coupons below</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={theme.colors.primaryDark} />
            </Pressable>
          ) : (
            <View style={styles.goldReadyBanner}>
              <GoldBar size={15} />
              <Text style={styles.goldReadyText}>You have {gold.toLocaleString()} gold — tap a coupon to unlock it</Text>
            </View>
          )}

          {/* Category filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map((cat) => (
              <Pressable key={cat} style={[styles.catChip, activeCategory === cat && styles.catChipActive]} onPress={() => setActiveCategory(cat)}>
                <Ionicons name={CAT_ICONS[cat]} size={13} color={activeCategory === cat ? "#fff" : theme.colors.textMuted} />
                <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Live coupons (from DB) */}
          {showLive && (
            <>
              {liveCatalog.slice(0, 1).map((c) => (
                <FeaturedCoupon key={c.id} coupon={c} gold={gold} purchased={purchasedIds.has(c.id)} onPress={() => handleCouponPress(c)} />
              ))}
              <View style={styles.list}>
                {liveCatalog.slice(1).map((c) => (
                  <CouponRow key={c.id} coupon={c} gold={gold} purchased={purchasedIds.has(c.id)} onPress={() => handleCouponPress(c)} />
                ))}
              </View>
            </>
          )}

          {/* Placeholder coupons — always visible */}
          {placeholders.length > 0 && (
            <>
              {showLive && (
                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerLabel}>More coming soon</Text>
                  <View style={styles.divider} />
                </View>
              )}
              <View style={styles.list}>
                {placeholders.map((p) => (
                  <PlaceholderRow key={p.id} item={p} gold={gold} onPress={() => setModal({ kind: "preview", item: p })} />
                ))}
              </View>
            </>
          )}
        </>
      )}

      {/* ── Owned tab ── */}
      {activeTab === "owned" && (
        <View style={styles.ownedSection}>
          {ownedCoupons.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={theme.colors.borderStrong} />
              <Text style={styles.emptyTitle}>No coupons yet</Text>
              <Text style={styles.emptyBody}>Browse the shop and unlock coupons with Gold Coins.</Text>
              <Pressable style={styles.browseBtn} onPress={() => setActiveTab("shop")}>
                <Text style={styles.browseBtnText}>Browse Shop</Text>
              </Pressable>
            </View>
          ) : (
            ownedCoupons.map((item) => (
              <View key={item.id} style={styles.ownedRow}>
                <View style={styles.ownedIcon}>
                  <Ionicons name="ticket-outline" size={20} color={theme.colors.primaryDark} />
                </View>
                <View style={styles.ownedCopy}>
                  <Text style={styles.ownedTitle}>Coupon</Text>
                  <Text style={styles.ownedDate}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text>
                </View>
                <View style={[styles.statusChip, item.status === "redeemed" ? styles.statusRedeemed : styles.statusPurchased]}>
                  <Text style={[styles.statusText, item.status === "redeemed" ? styles.statusTextRedeemed : styles.statusTextPurchased]}>
                    {item.status === "redeemed" ? "Redeemed" : "Purchased"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {purchase.error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
          <Text style={styles.errorText}>{purchase.error.message}</Text>
        </View>
      )}

      {/* Purchase confirm */}
      <PurchaseModal
        visible={modal?.kind === "purchase"}
        coupon={modal?.kind === "purchase" ? modal.coupon : null}
        gold={gold}
        loading={purchase.isPending}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          if (modal?.kind === "purchase") {
            purchase.mutate(modal.coupon.id, { onSuccess: () => { setModal(null); setActiveTab("owned"); } });
          }
        }}
      />

      {/* Locked — earn more */}
      <EarnModal
        visible={modal?.kind === "locked"}
        coupon={modal?.kind === "locked" ? modal.coupon : null}
        need={modal?.kind === "locked" ? modal.need : 0}
        onClose={() => setModal(null)}
        onGoToGames={() => { setModal(null); router.push("/(tabs)/game"); }}
      />

      {/* Placeholder preview */}
      <PreviewModal
        visible={modal?.kind === "preview"}
        item={modal?.kind === "preview" ? modal.item : null}
        gold={gold}
        onClose={() => setModal(null)}
        onGoToGames={() => { setModal(null); router.push("/(tabs)/game"); }}
      />
    </ScreenContainer>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const FeaturedCoupon = ({ coupon, gold, purchased, onPress }: { coupon: Coupon; gold: number; purchased: boolean; onPress: () => void }) => {
  const canAfford = gold >= coupon.goldCoinCost;
  const state: "owned" | "ready" | "locked" = purchased ? "owned" : canAfford ? "ready" : "locked";
  const need = Math.max(0, coupon.goldCoinCost - gold);
  return (
    <Pressable style={styles.featured} onPress={onPress} accessibilityRole="button">
      <View style={styles.featuredTop}>
        <View style={styles.featuredImg}>
          <Ionicons name="pricetag-outline" size={36} color={theme.colors.primaryDark} />
        </View>
        <View style={styles.featuredBadges}>
          <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View>
          {state === "owned" && (
            <View style={[styles.featuredBadge, styles.ownedBadge]}>
              <Ionicons name="checkmark" size={10} color={theme.colors.primary} />
              <Text style={[styles.featuredBadgeText, styles.ownedBadgeText]}>OWNED</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.featuredTitle}>{coupon.title}</Text>
      <Text style={styles.featuredDesc} numberOfLines={2}>{coupon.description}</Text>
      <View style={styles.featuredFooter}>
        <View style={styles.goldPriceRow}>
          <GoldBar size={14} />
          <Text style={styles.goldPriceText}>{coupon.goldCoinCost.toLocaleString()} gold</Text>
        </View>
        {state === "locked" && <Text style={styles.needText}>Need {need} more</Text>}
        <View style={[styles.featuredCta, state === "owned" && styles.ctaOwned, state === "locked" && styles.ctaLocked]}>
          <Text style={[styles.featuredCtaText, state === "locked" && styles.ctaLockedText, state === "owned" && styles.ctaOwnedText]}>
            {state === "owned" ? "Owned" : state === "locked" ? "Earn to Unlock" : "Unlock"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const CouponRow = ({ coupon, gold, purchased, onPress }: { coupon: Coupon; gold: number; purchased: boolean; onPress: () => void }) => {
  const canAfford = gold >= coupon.goldCoinCost;
  const state: "owned" | "ready" | "locked" = purchased ? "owned" : canAfford ? "ready" : "locked";
  const need = Math.max(0, coupon.goldCoinCost - gold);
  return (
    <Pressable style={styles.couponRow} onPress={onPress} accessibilityRole="button">
      <View style={[styles.couponThumb, state === "locked" && styles.couponThumbLocked]}>
        <Ionicons name="ticket-outline" size={22} color={state === "locked" ? theme.colors.textMuted : theme.colors.primaryDark} />
      </View>
      <View style={styles.couponCopy}>
        <Text style={styles.couponTitle}>{coupon.title}</Text>
        <Text style={styles.couponDesc} numberOfLines={1}>{coupon.description}</Text>
        <View style={styles.goldPriceRow}>
          <GoldBar size={11} />
          <Text style={styles.couponPriceText}>{coupon.goldCoinCost.toLocaleString()} gold</Text>
          {state === "locked" && <Text style={styles.needInline}> · {need} more needed</Text>}
        </View>
      </View>
      <View style={[styles.rowAction, state === "owned" && styles.rowActionOwned, state === "locked" && styles.rowActionLocked]}>
        {state === "locked" && <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />}
        {state === "owned" && <Ionicons name="checkmark" size={13} color={theme.colors.primary} />}
        <Text style={[styles.rowActionText, state === "locked" && styles.rowActionTextLocked, state === "owned" && styles.rowActionTextOwned]}>
          {state === "owned" ? "Owned" : state === "locked" ? "Locked" : "Unlock"}
        </Text>
      </View>
    </Pressable>
  );
};

const PlaceholderRow = ({ item, gold, onPress }: { item: PlaceholderCoupon; gold: number; onPress: () => void }) => {
  const canAfford = gold >= item.goldCoinCost;
  return (
    <Pressable style={[styles.couponRow, styles.placeholderRow]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.couponThumb, styles.placeholderThumb]}>
        <Ionicons name={item.icon} size={22} color={theme.colors.textMuted} />
      </View>
      <View style={styles.couponCopy}>
        <View style={styles.placeholderTitleRow}>
          <Text style={[styles.couponTitle, styles.placeholderTitle]} numberOfLines={1}>{item.title}</Text>
          <View style={styles.comingSoonChip}><Text style={styles.comingSoonText}>SOON</Text></View>
        </View>
        <Text style={styles.couponDesc} numberOfLines={1}>{item.description}</Text>
        <View style={styles.goldPriceRow}>
          <GoldBar size={11} />
          <Text style={styles.couponPriceText}>{item.goldCoinCost} gold</Text>
          {canAfford && <View style={styles.affordableChip}><Text style={styles.affordableText}>You can afford this</Text></View>}
        </View>
      </View>
      <View style={[styles.rowAction, styles.rowActionLocked]}>
        <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />
        <Text style={[styles.rowActionText, styles.rowActionTextLocked]}>Soon</Text>
      </View>
    </Pressable>
  );
};

// ── Modals ────────────────────────────────────────────────────────────────────

const PurchaseModal = ({ visible, coupon, gold, loading, onCancel, onConfirm }: { visible: boolean; coupon: Coupon | null; gold: number; loading: boolean; onCancel: () => void; onConfirm: () => void }) => {
  const remaining = coupon ? gold - coupon.goldCoinCost : gold;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <Ionicons name="ticket-outline" size={26} color={theme.colors.primaryDark} />
          </View>
          <Text style={styles.sheetTitle}>Unlock this coupon?</Text>
          <Text style={styles.sheetCopy}>
            You will spend <Text style={{ fontWeight: "900" }}>{coupon?.goldCoinCost.toLocaleString() ?? 0} Gold</Text> for{" "}
            <Text style={{ fontWeight: "900" }}>{coupon?.title ?? "this coupon"}</Text>.
          </Text>
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Your Gold</Text>
              <View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costValue}>{gold.toLocaleString()}</Text></View>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Coupon Cost</Text>
              <Text style={styles.costNeg}>-{coupon?.goldCoinCost.toLocaleString() ?? 0}</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costRow}>
              <Text style={styles.costRemLabel}>Remaining</Text>
              <View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costRemValue}>{remaining.toLocaleString()}</Text></View>
            </View>
          </View>
          <Pressable disabled={loading || remaining < 0} style={[styles.confirmBtn, (loading || remaining < 0) && styles.btnDisabled]} onPress={onConfirm}>
            <Text style={styles.confirmText}>{loading ? "Processing..." : "Purchase Coupon"}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
};

const EarnModal = ({ visible, coupon, need, onClose, onGoToGames }: { visible: boolean; coupon: Coupon | null; need: number; onClose: () => void; onGoToGames: () => void }) => (
  <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={[styles.sheetIcon, { backgroundColor: theme.colors.goldSoft }]}>
          <GoldBar size={26} />
        </View>
        <Text style={styles.sheetTitle}>{coupon?.title ?? "Coupon"}</Text>
        <Text style={styles.sheetCopy}>{coupon?.description ?? ""}</Text>
        <View style={styles.costCard}>
          <View style={styles.costRow}><Text style={styles.costLabel}>Cost</Text><View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costValue}>{coupon?.goldCoinCost.toLocaleString() ?? 0}</Text></View></View>
          <View style={styles.costRow}><Text style={styles.costLabel}>You have</Text><View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costValue}>{(coupon ? coupon.goldCoinCost - need : 0).toLocaleString()}</Text></View></View>
          <View style={styles.costDivider} />
          <View style={styles.costRow}><Text style={styles.costRemLabel}>Still need</Text><View style={[styles.goldValueRow, styles.needHighlight]}><GoldBar size={12} /><Text style={[styles.costRemValue, { color: theme.colors.gold }]}>{need.toLocaleString()}</Text></View></View>
        </View>
        <Pressable style={styles.confirmBtn} onPress={onGoToGames}>
          <Ionicons name="game-controller-outline" size={18} color="#fff" />
          <Text style={styles.confirmText}>Earn Gold in Challenge Games</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Close</Text></Pressable>
      </View>
    </View>
  </Modal>
);

const PreviewModal = ({ visible, item, gold, onClose, onGoToGames }: { visible: boolean; item: PlaceholderCoupon | null; gold: number; onClose: () => void; onGoToGames: () => void }) => {
  const need = item ? Math.max(0, item.goldCoinCost - gold) : 0;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetIcon, { backgroundColor: theme.colors.cardMuted }]}>
            <Ionicons name={item?.icon ?? "ticket-outline"} size={26} color={theme.colors.textMuted} />
          </View>
          <View style={styles.comingSoonBanner}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
            <Text style={styles.comingSoonBannerText}>This coupon is coming soon</Text>
          </View>
          <Text style={styles.sheetTitle}>{item?.title ?? ""}</Text>
          <Text style={styles.sheetCopy}>{item?.description ?? ""}</Text>
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Coupon will cost</Text>
              <View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costValue}>{item?.goldCoinCost.toLocaleString() ?? 0} gold</Text></View>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Your Gold</Text>
              <View style={styles.goldValueRow}><GoldBar size={12} /><Text style={styles.costValue}>{gold.toLocaleString()}</Text></View>
            </View>
            {need > 0 && (
              <>
                <View style={styles.costDivider} />
                <View style={styles.costRow}><Text style={styles.costRemLabel}>Still need</Text><View style={[styles.goldValueRow, styles.needHighlight]}><GoldBar size={12} /><Text style={[styles.costRemValue, { color: theme.colors.gold }]}>{need.toLocaleString()}</Text></View></View>
              </>
            )}
          </View>
          <Pressable style={styles.confirmBtn} onPress={onGoToGames}>
            <Ionicons name="game-controller-outline" size={18} color="#fff" />
            <Text style={styles.confirmText}>Earn Gold in Challenge Games</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingBottom: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  headerCenter: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: theme.typography.xs, color: theme.colors.textMuted, marginTop: 2 },
  goldBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.goldSoft, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  goldAmount: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.gold },

  segment: { flexDirection: "row", backgroundColor: theme.colors.cardMuted, borderRadius: 999, padding: 3, gap: 3 },
  segBtn: { flex: 1, minHeight: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  segBtnActive: { backgroundColor: theme.colors.card, ...theme.shadows.soft },
  segText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },
  segTextActive: { color: theme.colors.text, fontWeight: "900" },
  segBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center" },
  segBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  earnBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.lg, padding: theme.spacing.md, borderWidth: 1.5, borderColor: theme.colors.accent + "88" },
  earnBannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center", flexShrink: 0, ...theme.shadows.soft },
  earnBannerCopy: { flex: 1, gap: 2 },
  earnBannerTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.primaryDark },
  earnBannerSub: { fontSize: theme.typography.xs, color: theme.colors.primaryDark, lineHeight: 16, opacity: 0.75 },
  goldReadyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.goldSoft, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, paddingVertical: 10 },
  goldReadyText: { fontSize: theme.typography.xs, fontWeight: "700", color: "#9A6200", flex: 1 },

  catRow: { gap: theme.spacing.sm, paddingBottom: 2 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingHorizontal: 14, paddingVertical: 7 },
  catChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  catText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },
  catTextActive: { color: "#fff" },

  list: { gap: theme.spacing.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  dividerLabel: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.5 },

  emptyCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm, ...theme.shadows.soft },
  emptyTitle: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text },
  emptyBody: { fontSize: theme.typography.xs, color: theme.colors.textMuted, textAlign: "center", lineHeight: 18 },
  browseBtn: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 20, paddingVertical: 10, marginTop: theme.spacing.xs },
  browseBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },

  featured: { backgroundColor: theme.colors.card, borderRadius: theme.radii.xl, padding: theme.spacing.lg, gap: 10, ...theme.shadows.raised },
  featuredTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  featuredImg: { width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  featuredBadges: { gap: 6, alignItems: "flex-end" },
  featuredBadge: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 10, paddingVertical: 4 },
  featuredBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  ownedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.primarySoft },
  ownedBadgeText: { color: theme.colors.primaryDark },
  featuredTitle: { fontSize: theme.typography.lg, fontWeight: "900", color: theme.colors.text },
  featuredDesc: { fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 17 },
  featuredFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
  goldPriceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  goldPriceText: { fontSize: theme.typography.sm, fontWeight: "800", color: theme.colors.gold },
  needText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700", flex: 1 },
  featuredCta: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 16, paddingVertical: 8 },
  ctaOwned: { backgroundColor: theme.colors.primarySoft },
  ctaLocked: { backgroundColor: theme.colors.cardMuted, borderWidth: 1.5, borderColor: theme.colors.border },
  featuredCtaText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },
  ctaLockedText: { color: theme.colors.textMuted },
  ctaOwnedText: { color: theme.colors.primaryDark },

  couponRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.md, ...theme.shadows.soft },
  placeholderRow: { opacity: 0.8 },
  couponThumb: { width: 52, height: 52, borderRadius: theme.radii.md, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  couponThumbLocked: { backgroundColor: theme.colors.cardMuted },
  placeholderThumb: { backgroundColor: theme.colors.cardMuted },
  couponCopy: { flex: 1, gap: 2, minWidth: 0 },
  placeholderTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  couponTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  placeholderTitle: { flex: 1 },
  couponDesc: { fontSize: theme.typography.xs, color: theme.colors.textMuted },
  couponPriceText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.gold },
  needInline: { fontSize: theme.typography.xs, color: theme.colors.textMuted },
  comingSoonChip: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.cardMuted, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
  comingSoonText: { fontSize: 9, fontWeight: "900", color: theme.colors.textSubtle, letterSpacing: 0.3 },
  affordableChip: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 7, paddingVertical: 2 },
  affordableText: { fontSize: 9, fontWeight: "900", color: theme.colors.primaryDark },
  rowAction: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  rowActionOwned: { backgroundColor: theme.colors.primarySoft },
  rowActionLocked: { backgroundColor: theme.colors.cardMuted, borderWidth: 1.5, borderColor: theme.colors.border },
  rowActionText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },
  rowActionTextLocked: { color: theme.colors.textMuted },
  rowActionTextOwned: { color: theme.colors.primaryDark },

  ownedSection: { gap: theme.spacing.md },
  ownedRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.md, ...theme.shadows.soft },
  ownedIcon: { width: 44, height: 44, borderRadius: theme.radii.md, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ownedCopy: { flex: 1, gap: 3 },
  ownedTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  ownedDate: { fontSize: theme.typography.xs, color: theme.colors.textMuted },
  statusChip: { borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusPurchased: { backgroundColor: theme.colors.primarySoft },
  statusRedeemed: { backgroundColor: theme.colors.accentSoft },
  statusText: { fontSize: theme.typography.xs, fontWeight: "900" },
  statusTextPurchased: { color: theme.colors.primaryDark },
  statusTextRedeemed: { color: "#6B6B00" },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, padding: theme.spacing.md },
  errorText: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.error, fontWeight: "700" },

  overlay: { flex: 1, backgroundColor: "rgba(20,28,22,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: theme.spacing.xl, gap: theme.spacing.lg, ...theme.shadows.raised },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: theme.colors.border, alignSelf: "center" },
  sheetIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primarySoft, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: theme.typography.lg, fontWeight: "900", color: theme.colors.text, textAlign: "center" },
  sheetCopy: { fontSize: theme.typography.sm, color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 },
  comingSoonBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.colors.cardMuted, borderRadius: theme.radii.pill, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "center" },
  comingSoonBannerText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },
  costCard: { borderRadius: theme.radii.lg, backgroundColor: theme.colors.backgroundSoft, padding: theme.spacing.lg, gap: theme.spacing.md },
  costRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  costLabel: { fontSize: theme.typography.sm, color: theme.colors.textMuted, fontWeight: "700" },
  costValue: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  costNeg: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.error },
  costDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  costRemLabel: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  costRemValue: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.gold },
  goldValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  needHighlight: { borderRadius: theme.radii.pill, backgroundColor: theme.colors.goldSoft, paddingHorizontal: 10, paddingVertical: 3 },
  confirmBtn: { minHeight: 52, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  btnDisabled: { opacity: 0.5 },
  confirmText: { fontSize: theme.typography.sm, fontWeight: "900", color: "#fff" },
  cancelBtn: { minHeight: 44, borderRadius: theme.radii.pill, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.textMuted },
});
