import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRightIcon,
  BandaidsIcon,
  BoneIcon,
  BugIcon,
  DropIcon,
  HeartIcon,
  PawPrintIcon,
  PillIcon,
  ShowerIcon,
  StorefrontIcon,
  ToothIcon,
  BagSimpleIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { PharmacyGlyph } from "@/features/care/components/PharmacyGlyph";
import { Stepper } from "@/features/care/food/FoodPlanParts";
import { CARE_LABEL, dueFor, entriesFor, type CareKind } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { PREVENTIVES } from "@/features/care/intel/preventives";
import { useCareLocations } from "@/features/care/state/careLocations";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { setSupply, supplyOf, useSupply } from "@/features/care/state/medSupply";
import { PressScale } from "@/components/ui/PressScale";
import { useMedications } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { openLink } from "@/lib/openLink";
import { mapsSearchUrl } from "@/services/placeSearch";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const shop = (query: string) => `https://www.chewy.com/s?query=${encodeURIComponent(query)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

/** Prevention products a vet has to approve before a pharmacy can fill them. */
const RX = new Set(["nexgard", "simparica", "credelio", "bravecto", "simparica-trio", "nexgard-plus", "credelio-quattro", "heartgard-plus", "interceptor-plus", "proheart-6", "proheart-12", "drontal-plus"]);
const PREVENTION: readonly CareKind[] = ["flea_tick", "heartworm_prev", "deworm"];

type Supply = { key: string; label: string; Glyph: PhosphorIcon; query: string };

/**
 * The pet pharmacy, from what PAWS knows about the dog: medicines with how many are left and when they run out,
 * the prevention products in use and when the next dose is due, and supplies picked for this dog's age, allergies
 * and habits. Refills go to the vet or an online pharmacy; prescription items say so.
 */
export default function PharmacyScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";
  const medications = useMedications(dogId);
  const intel = useCareIntel();
  const record = useHealthRecord();
  const supply = useSupply();
  const { home, clinics } = useCareLocations();
  const clinic = clinics.find((c) => c.phone) ?? null;
  const [counting, setCounting] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const tileSize = gridWidth ? Math.floor((gridWidth - space.sm * 2) / 3) : 0;

  const meds = useMemo(() => (medications.data ?? []).filter((m) => m.isActive), [medications.data]);

  // The prevention in use: the last product logged for each kind, and when the next dose is due.
  const prevention = useMemo(
    () =>
      PREVENTION.flatMap((kind) => {
        const last = entriesFor(kind, intel.log)[0];
        if (!last?.product) return [];
        const due = dueFor(kind, intel.log, intel.stage, intel.today);
        const product = PREVENTIVES.find((p) => p.name.toLowerCase() === last.product!.toLowerCase());
        return [{ kind, product: last.product, rx: product ? RX.has(product.id) : false, next: due.next, due: due.status === "due" || due.status === "soon", covers: last.covers ?? [kind] }];
      }).filter((p, i, all) => all.findIndex((x) => x.product === p.product) === i),
    [intel.log, intel.stage, intel.today],
  );

  // Supplies that fit this dog, then the basics every home keeps.
  const supplies = useMemo<Supply[]>(() => {
    const allergic = record.items.some((i) => i.kind === "allergy");
    const list: Supply[] = [];
    if (intel.stage === "senior") list.push({ key: "joints", label: "Joint support", Glyph: HeartIcon, query: "dog joint supplement glucosamine" });
    if (intel.stage === "puppy") list.push({ key: "teething", label: "Teething chews", Glyph: BoneIcon, query: "puppy teething chew" });
    if (allergic) list.push({ key: "shampoo-hypo", label: "Gentle shampoo", Glyph: ShowerIcon, query: "hypoallergenic dog shampoo" });
    if (entriesFor("brushing", intel.log).length === 0) list.push({ key: "teeth", label: "Teeth kit", Glyph: ToothIcon, query: "dog toothbrush toothpaste kit" });
    list.push(
      { key: "first-aid", label: "First-aid kit", Glyph: BandaidsIcon, query: "dog first aid kit" },
      { key: "bags", label: "Poop bags", Glyph: BagSimpleIcon, query: "dog poop bags" },
      { key: "ear", label: "Ear cleaner", Glyph: DropIcon, query: "dog ear cleaner" },
    );
    if (!prevention.length) list.push({ key: "flea", label: "Flea & tick", Glyph: BugIcon, query: "dog flea and tick prevention" });
    return list.slice(0, 6);
  }, [intel.stage, intel.log, record.items, prevention.length]);

  const refill = (product: string, rx: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(`Refill ${product}`, rx ? "A vet needs to approve it. Online pharmacies ask your vet for you." : undefined, [
      { text: "Order online", onPress: () => void openLink(shop(product)) },
      ...(clinic?.phone ? [{ text: `Call ${clinic.name}`, onPress: () => void openLink(`tel:${clinic.phone}`) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const enter = (order: number) => (reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger));

  return (
    <DetailShell title="Pet pharmacy" glyph={<PharmacyGlyph size={iconSize.standard} color={text.primary} backdrop={bg.canvas} />}>
      <Animated.View entering={enter(0)}>
        <Text style={styles.section}>Medicines</Text>
        {meds.length === 0 ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Add a medicine" scaleTo={0.98} style={styles.emptyRow} onPress={() => router.push("/care/medications" as never)}>
            <View style={styles.disc}>
              <PillIcon size={iconSize.standard} color={text.primary} />
            </View>
            <Text style={[styles.rowTitle, styles.flex]}>{`Nothing on ${name}'s list`}</Text>
            <Text style={styles.link}>Add</Text>
          </PressScale>
        ) : (
          <View style={styles.list}>
            {meds.map((med, i) => {
              const s = supplyOf(supply[med.id], med.frequency, intel.today);
              const low = s != null && s.days <= 7;
              const open = counting === med.id;
              return (
                <View key={med.id} style={[styles.rowWrap, i > 0 && styles.ruled]}>
                  <View style={styles.row}>
                    <View style={[styles.disc, low && styles.discLow]}>
                      <PillIcon size={iconSize.standard} color={text.primary} weight={low ? "fill" : "regular"} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {med.medicationName}
                      </Text>
                      <PressScale accessibilityRole="button" accessibilityLabel="Count what is left" hitSlop={6} scaleTo={0.97} onPress={() => setCounting(open ? null : med.id)}>
                        <Text style={[styles.rowSub, low && styles.rowSubLow]} numberOfLines={1}>
                          {s ? (s.left === 0 ? "Ran out" : `${s.left} left · until ${shortDate(s.runsOut)}`) : med.frequency === "as_needed" ? "As needed" : "Count what is left"}
                        </Text>
                      </PressScale>
                    </View>
                    <PressScale accessibilityRole="button" accessibilityLabel={`Refill ${med.medicationName}`} scaleTo={0.95} style={[styles.pill, low && styles.pillLow]} onPress={() => refill(med.medicationName, true)}>
                      <Text style={styles.pillText}>Refill</Text>
                    </PressScale>
                  </View>
                  {open ? (
                    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.count}>
                      <Text style={styles.countLabel}>Doses left today</Text>
                      <Stepper value={s?.left ?? 0} step={1} label={`doses of ${med.medicationName} left`} onChange={(v) => setSupply(med.id, v)} />
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Text style={styles.section}>Prevention</Text>
        {prevention.length === 0 ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Log a preventive" scaleTo={0.98} style={styles.emptyRow} onPress={() => router.push("/care/preventive?area=parasites" as never)}>
            <View style={styles.disc}>
              <BugIcon size={iconSize.standard} color={text.primary} />
            </View>
            <Text style={[styles.rowTitle, styles.flex]}>No preventive logged</Text>
            <Text style={styles.link}>Log</Text>
          </PressScale>
        ) : (
          <View style={styles.list}>
            {prevention.map((p, i) => (
              <View key={p.product} style={[styles.row, i > 0 && styles.ruled]}>
                <View style={[styles.disc, p.due && styles.discLow]}>
                  <BugIcon size={iconSize.standard} color={text.primary} weight={p.due ? "fill" : "regular"} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.titleLine}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {p.product}
                    </Text>
                    {p.rx ? <Text style={styles.rx}>Rx</Text> : null}
                  </View>
                  <Text style={[styles.rowSub, p.due && styles.rowSubLow]} numberOfLines={1}>
                    {p.next ? `${p.due ? "Due" : "Next"} ${shortDate(p.next)} · ${p.covers.map((k) => CARE_LABEL[k].toLowerCase()).join(", ")}` : p.covers.map((k) => CARE_LABEL[k]).join(", ")}
                  </Text>
                </View>
                <PressScale accessibilityRole="button" accessibilityLabel={`Reorder ${p.product}`} scaleTo={0.95} style={[styles.pill, p.due && styles.pillLow]} onPress={() => refill(p.product, p.rx)}>
                  <Text style={styles.pillText}>Reorder</Text>
                </PressScale>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <Text style={styles.section}>{`For ${name}`}</Text>
        <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {supplies.map(({ key, label, Glyph, query }) => (
            <PressScale
              key={key}
              accessibilityRole="link"
              accessibilityLabel={`Shop ${label}`}
              scaleTo={0.96}
              style={[styles.tile, tileSize ? { width: tileSize, height: tileSize * 0.86 } : null]}
              onPress={() => {
                void Haptics.selectionAsync();
                void openLink(shop(query));
              }}
            >
              <Glyph size={22} color={text.primary} />
              <Text style={styles.tileLabel} numberOfLines={1}>
                {label}
              </Text>
            </PressScale>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <PressScale
          accessibilityRole="link"
          accessibilityLabel="Find a pet pharmacy nearby"
          scaleTo={0.985}
          style={styles.finder}
          onPress={() => {
            void Haptics.selectionAsync();
            void openLink(mapsSearchUrl("pet pharmacy", home));
          }}
        >
          <View style={styles.finderDisc}>
            <StorefrontIcon size={iconSize.standard} color={text.primary} />
          </View>
          <Text style={[styles.rowTitle, styles.flex]}>{home ? `Pet pharmacies near ${home.label}` : "Pet pharmacies nearby"}</Text>
          <ArrowUpRightIcon size={iconSize.inline} color={text.primary} weight="bold" />
        </PressScale>
        <View style={styles.footRow}>
          <PawPrintIcon size={12} color={text.tertiary} weight="fill" />
          <Text style={styles.foot}>Prices and stock are on the pharmacy's site.</Text>
        </View>
      </Animated.View>
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { ...type.sectionTitle, color: text.primary, marginTop: space.section, marginBottom: space.md },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden", backgroundColor: bg.canvas },
  rowWrap: {},
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discLow: { backgroundColor: accent.primary },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, flexShrink: 1 },
  rowSub: { ...type.caption, color: text.tertiary, marginTop: 2 },
  rowSubLow: { color: accent.band, fontWeight: "700" },
  rx: { ...type.caption, fontSize: 10, fontWeight: "800", color: text.secondary, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: border.default, overflow: "hidden" },
  pill: { paddingHorizontal: space.md, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center" },
  pillLow: { backgroundColor: accent.deep, borderColor: accent.deep },
  pillText: { ...type.caption, fontWeight: "700", color: text.primary },
  count: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.lg },
  countLabel: { ...type.supporting, color: text.secondary },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  link: { ...type.supporting, fontWeight: "700", color: text.primary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "30%", height: 92, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xs },
  tileLabel: { ...type.caption, fontWeight: "600", color: text.primary, textAlign: "center" },

  finder: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.section, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  finderDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  footRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: space.lg },
  foot: { ...type.caption, color: text.tertiary },
});
