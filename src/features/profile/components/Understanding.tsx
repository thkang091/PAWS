import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, CheckIcon, SparkleIcon } from "phosphor-react-native";

import { enter } from "@/features/care/food/enter";
import { useProfileSets } from "@/features/profile/intel/useProfileSets";
import { SET_GLYPH } from "@/features/profile/components/setGlyphs";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const SHORT: Record<string, string> = { basics: "Basics", safety: "Health", home: "Home", baseline: "Training", personality: "Behavior" };

/**
 * The top of the About tab: the paragraph Care and Train both read, and one next step. The five sets sit underneath
 * as a quiet row of marks, so the profile never reads like a to-do list.
 */
export const Understanding = () => {
  const reduceMotion = useReducedMotion();
  const profile = useProfileSets();
  const next = profile.sets.find((s) => s.answered < s.total) ?? null;
  const left = next ? next.total - next.answered : 0;

  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.card}>
      <View style={styles.head}>
        <SparkleIcon size={14} color={accent.band} weight="fill" />
        <Text style={styles.eyebrow}>{`How PAWS understands ${profile.name}`}</Text>
      </View>
      <Text style={styles.paragraph}>{profile.understanding}</Text>

      {next ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${next.title}, ${left} ${left === 1 ? "question" : "questions"}`}
          scaleTo={0.97}
          style={styles.cta}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/profile/get-to-know?set=${next.key}` as never);
          }}
        >
          <View style={styles.flex}>
            <Text style={styles.ctaTitle}>{next.title}</Text>
            <Text style={styles.ctaSub}>{`${left} quick ${left === 1 ? "question" : "questions"}`}</Text>
          </View>
          <View style={styles.ctaArrow}>
            <ArrowRightIcon size={18} color={text.primary} weight="bold" />
          </View>
        </PressScale>
      ) : null}

      <View style={styles.marks}>
        {profile.sets.map((set) => {
          const Glyph = SET_GLYPH[set.key];
          const done = set.answered === set.total;
          const isNext = set.key === next?.key;
          return (
            <PressScale
              key={set.key}
              accessibilityRole="button"
              accessibilityLabel={`${set.title}. ${done ? "Done" : `${set.answered} of ${set.total}`}`}
              hitSlop={4}
              scaleTo={0.92}
              style={styles.mark}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push(`/profile/${set.key}` as never);
              }}
            >
              <View style={[styles.markDisc, done && styles.markDone, isNext && styles.markNext]}>
                {done ? <CheckIcon size={14} color={text.primary} weight="bold" /> : <Glyph size={16} color={text.primary} weight={isNext ? "fill" : "regular"} />}
              </View>
              <Text style={[styles.markLabel, (done || isNext) && styles.markLabelOn]} numberOfLines={1}>
                {SHORT[set.key]}
              </Text>
            </PressScale>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { ...type.caption, fontWeight: "700", color: text.primary },
  paragraph: { ...type.body, fontSize: 17, lineHeight: 25, color: text.primary, marginTop: space.md },
  cta: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, paddingLeft: space.lg, paddingRight: 6, height: 60, borderRadius: radius.pill, backgroundColor: bg.canvas },
  ctaTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  ctaSub: { ...type.caption, color: text.secondary, marginTop: 1 },
  ctaArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  marks: { flexDirection: "row", justifyContent: "space-between", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: border.soft },
  mark: { alignItems: "center", gap: 4, width: 58 },
  markDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  markDone: { backgroundColor: accent.primary },
  markNext: { backgroundColor: accent.deep },
  markLabel: { ...type.caption, fontSize: 11, color: text.tertiary },
  markLabelOn: { color: text.primary, fontWeight: "600" },
});
