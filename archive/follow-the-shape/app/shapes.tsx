import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckIcon, StarIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { DIFFICULTY_LABEL, shapeChoices, type ShapeKey } from "@/features/tournament/shapeFlow";
import { useTournamentOverview } from "@/hooks/useTournaments";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const LEVEL = { easy: 1, medium: 2, hard: 3 } as const;

/** Choose your shape: six targets, what each needs from the paths around you, and how hard it is to walk. */
export default function ChooseShapeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const overview = useTournamentOverview();
  const featured = overview.data?.tournaments.find((t) => t.id === id)?.shape?.key ?? null;
  const choices = shapeChoices();
  const [picked, setPicked] = useState<ShapeKey | null>(null);
  const cardW = (width - layout.gutter * 2 - space.md) / 2;

  return (
    <View style={styles.flex}>
      <DetailShell title="Choose a shape" glyph={<StarIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/follow-shape">
        <Text style={styles.lead}>Each shape is matched to real paths near your start. Not every shape fits every neighbourhood.</Text>
        <View style={styles.grid}>
          {choices.map((c, i) => {
            const on = picked === c.key;
            return (
              <Animated.View key={c.key} entering={reduceMotion ? undefined : FadeIn.delay(i * 40).duration(motion.duration.enter)} style={{ width: cardW }}>
                <PressScale
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c.name}. ${DIFFICULTY_LABEL[c.difficulty]}. ${c.note}`}
                  scaleTo={0.97}
                  style={[styles.card, on && styles.cardOn]}
                  onPress={() => {
                    setPicked(c.key);
                    void Haptics.selectionAsync();
                  }}
                >
                  <View style={[styles.art, on && styles.artOn]}>
                    <ShapeGlyph points={c.points} closed={c.closed} size={Math.min(96, cardW - 40)} strokeWidth={5} />
                    {featured === c.key ? (
                      <View style={styles.featured}>
                        <Text style={styles.featuredText}>This week</Text>
                      </View>
                    ) : null}
                    {on ? (
                      <View style={styles.check}>
                        <CheckIcon size={14} color={text.primary} weight="bold" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.name}>{c.name}</Text>
                  <View style={styles.level} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {[1, 2, 3].map((n) => (
                      <View key={n} style={[styles.pip, n <= LEVEL[c.difficulty] && styles.pipOn]} />
                    ))}
                    <Text style={styles.levelText}>{DIFFICULTY_LABEL[c.difficulty]}</Text>
                  </View>
                  <Text style={styles.note}>{c.note}</Text>
                </PressScale>
              </Animated.View>
            );
          })}
        </View>
        <Text style={styles.tier}>You're ranked against players walking shapes of the same difficulty.</Text>
        <View style={{ height: 110 + insets.bottom }} />
      </DetailShell>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton
          label="Next"
          sub={picked ? "Choose where and how long" : "Pick a shape"}
          disabled={!picked}
          onPress={() => picked && router.push({ pathname: "/game/tournament/shape-setup", params: { id: id ?? "", shape: picked } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  lead: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.lg },
  card: { flex: 1, padding: space.sm, paddingBottom: space.md, borderRadius: radius.card + 4, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface },
  cardOn: { borderColor: accent.band },
  art: { height: 124, borderRadius: radius.card, backgroundColor: bg.stage, alignItems: "center", justifyContent: "center" },
  artOn: { backgroundColor: accent.soft },
  featured: { position: "absolute", left: 8, top: 8, height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  featuredText: { fontSize: 11, fontWeight: "800", color: text.primary },
  check: { position: "absolute", right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  name: { ...type.cardTitle, fontWeight: "800", color: text.primary, marginTop: space.md, marginHorizontal: space.xs },
  level: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6, marginHorizontal: space.xs },
  pip: { width: 12, height: 5, borderRadius: 3, backgroundColor: border.default },
  pipOn: { backgroundColor: accent.band },
  levelText: { ...type.caption, fontWeight: "700", color: text.secondary, marginLeft: 4 },
  note: { ...type.caption, color: text.secondary, marginTop: 6, marginHorizontal: space.xs },
  tier: { ...type.caption, color: text.tertiary, marginTop: space.xl, textAlign: "center" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
