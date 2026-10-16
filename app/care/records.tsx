import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CaretRightIcon, FilePdfIcon, FolderOpenIcon, PlusIcon, ShareFatIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { KIND_GLYPH, shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { CARE_LABEL, type CareKind } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { PressScale } from "@/components/ui/PressScale";
import { useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useVetRecord } from "@/features/profile/state/useVetRecord";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

type Line = { id: string; kind: CareKind; date: string; sub: string | null; flag: boolean; fromVaccines?: boolean; title?: string };

/** Health records: what happened before. Care plan says what is needed; this keeps the history. Tap a record to edit it. */
export default function RecordsScreen() {
  const reduceMotion = useReducedMotion();
  const intel = useCareIntel();
  const dog = useCurrentDog();
  const vaccinations = useVaccinations(dog.data?.id);
  const vet = useVetRecord();

  const lines = useMemo<Line[]>(() => {
    const logged = intel.log
      .filter((e) => e.kind !== "brushing")
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        date: e.date,
        sub: [e.product, e.result, e.note].filter(Boolean).join(", ") || null,
        flag: e.result === "Needs a follow-up",
      }));
    const shots = (vaccinations.data ?? []).map((v) => ({
      id: `vax-${v.id}`,
      kind: "vaccine_cert" as CareKind,
      date: v.dateGiven.slice(0, 10),
      sub: null,
      flag: false,
      title: `${v.vaccineName} vaccine`,
      fromVaccines: true,
    }));
    return [...logged, ...shots].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [intel.log, vaccinations.data]);

  const byYear = useMemo(() => {
    const groups = new Map<string, Line[]>();
    for (const line of lines) groups.set(line.date.slice(0, 4), [...(groups.get(line.date.slice(0, 4)) ?? []), line]);
    return [...groups.entries()];
  }, [lines]);

  const open = (line: Line) => router.push((line.fromVaccines ? "/care/vaccinations" : `/care/record?id=${encodeURIComponent(line.id)}`) as never);

  return (
    <DetailShell
      title="Health records"
      glyph={<FolderOpenIcon size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/(tabs)/care"
      action={{ label: "Add a record", icon: <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: () => router.push("/care/log-care?pick=1" as never) }}
    >
      <Text style={styles.lede}>{`Visits, tests and doses for ${intel.name}. Tap one to change it.`}</Text>

      {/* Everything here and in the medical record, as the one PDF a vet wants before a visit. */}
      <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 }, { duration: motion.duration.enter })} style={styles.vet}>
        <View style={styles.vetHead}>
          <View style={styles.vetTile}>
            <FilePdfIcon size={24} color={text.primary} weight="regular" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.vetTitle}>For your vet</Text>
            <Text style={styles.vetSub} numberOfLines={1}>
              {vet.reviewed ? `Reviewed by ${vet.reviewed.vet}` : "One PDF to send or print"}
            </Text>
          </View>
        </View>
        <View style={styles.vetActions}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Share the record as a PDF"
            accessibilityState={{ busy: vet.exporting }}
            scaleTo={0.97}
            style={styles.vetShare}
            onPress={() => void vet.share()}
          >
            {vet.exporting ? <ActivityIndicator size="small" color={text.primary} /> : <ShareFatIcon size={16} color={text.primary} weight="fill" />}
            <Text style={styles.vetShareText}>{vet.exporting ? "Making it" : "Share PDF"}</Text>
          </PressScale>
          <PressScale
            accessibilityRole="link"
            accessibilityLabel="Check the medical record first"
            scaleTo={0.97}
            style={styles.vetCheck}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/profile/health" as never);
            }}
          >
            <Text style={styles.vetCheckText}>Check it first</Text>
          </PressScale>
        </View>
      </Animated.View>

      {byYear.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyDisc}>
            <FolderOpenIcon size={28} color={text.primary} weight="regular" />
          </View>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyBody}>Add a vet visit, a test or a dose.</Text>
        </View>
      ) : (
        byYear.map(([year, items], g) => (
          <Animated.View key={year} entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: g * 60, duration: motion.duration.enter })}>
            <Text style={styles.year}>{year}</Text>
            <View style={styles.list}>
              {items.map((line, i) => {
                const Glyph = KIND_GLYPH[line.kind];
                const title = line.title ?? CARE_LABEL[line.kind];
                return (
                  <PressScale
                    key={line.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}, ${shortDay(line.date)}${line.sub ? `, ${line.sub}` : ""}`}
                    accessibilityHint={line.fromVaccines ? "Opens vaccinations" : "Opens the record to edit"}
                    scaleTo={0.985}
                    style={[styles.row, i > 0 && styles.ruled]}
                    onPress={() => open(line)}
                  >
                    <View style={styles.date}>
                      <Text style={styles.dateMonth}>{shortDay(line.date).split(" ")[0].toUpperCase()}</Text>
                      <Text style={styles.dateDay}>{Number(line.date.slice(8, 10))}</Text>
                    </View>
                    <View style={styles.disc}>
                      <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      {line.sub ? (
                        <View style={styles.subRow}>
                          {line.flag ? <View style={styles.flag} /> : null}
                          <Text style={[styles.rowSub, line.flag && styles.rowSubFlag]} numberOfLines={1}>
                            {line.sub}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <CaretRightIcon size={14} color={text.tertiary} weight="bold" />
                  </PressScale>
                );
              })}
            </View>
          </Animated.View>
        ))
      )}
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  vet: { marginTop: space.xl, padding: space.lg, borderRadius: radius.card + 4, backgroundColor: accent.soft },
  vetHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  vetTile: { width: 48, height: 48, borderRadius: 24, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  vetTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  vetSub: { ...type.caption, color: text.secondary, marginTop: 2 },
  vetActions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  vetShare: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.pill, backgroundColor: accent.deep },
  vetShareText: { ...type.supporting, fontWeight: "700", color: text.primary },
  vetCheck: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  vetCheckText: { ...type.supporting, fontWeight: "600", color: text.primary },
  flex: { flex: 1 },
  lede: { ...type.supporting, color: text.secondary, marginTop: space.lg },
  year: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.section, marginBottom: space.lg },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 68, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  date: { width: 34, alignItems: "center" },
  dateMonth: { ...type.caption, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: accent.band },
  dateDay: { fontSize: 18, lineHeight: 22, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  disc: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  rowSub: { ...type.caption, color: text.tertiary, flexShrink: 1 },
  rowSubFlag: { color: text.primary, fontWeight: "600" },

  empty: { alignItems: "center", marginTop: space.sectionLg, paddingHorizontal: space.xl },
  emptyDisc: { width: 72, height: 72, borderRadius: 36, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { ...type.sectionTitle, color: text.primary, marginTop: space.lg },
  emptyBody: { ...type.supporting, color: text.secondary, marginTop: 4, textAlign: "center" },
});
