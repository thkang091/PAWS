import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, CaretRightIcon, CheckIcon, GraduationCapIcon, HeartIcon, type Icon as PhosphorIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { tailoring } from "@/features/profile/intel/getToKnow";
import { type SetKey } from "@/features/profile/intel/profileSets";
import { useProfileSets } from "@/features/profile/intel/useProfileSets";
import { SET_GLYPH } from "@/features/profile/components/setGlyphs";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useMedications } from "@/hooks/useCareHealth";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 76;
const STROKE = 7;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * One profile set: how much of it is answered, a single way to continue, what the answers produce (life stage, the
 * training plan, what is tailored), and the answers themselves, each tappable to change.
 */
export const ProfileSetScreen = ({ setKey }: { setKey: SetKey }) => {
  const reduceMotion = useReducedMotion();
  const profile = useProfileSets();
  const state = profile.get(setKey);
  const left = state.total - state.answered;
  const complete = left === 0;
  const Glyph = SET_GLYPH[setKey];

  const fill = useSharedValue(0);
  useEffect(() => {
    const to = state.total ? state.answered / state.total : 0;
    fill.value = reduceMotion ? to : withTiming(to, { duration: motion.duration.flourish, easing: motion.easing.out });
  }, [fill, state.answered, state.total, reduceMotion]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - fill.value) }));

  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/profile/get-to-know?set=${setKey}` as never);
  };
  const lines = useMemo(() => (setKey === "personality" ? tailoring(state.answers, profile.name) : []), [setKey, state.answers, profile.name]);

  return (
    <DetailShell title={state.title} glyph={<Glyph size={iconSize.standard} color={accent.band} weight="fill" />} back="/(tabs)/profile">
      <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 }, { duration: motion.duration.enter })} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.ring}>
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={bg.canvas} strokeWidth={STROKE} fill="none" />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={accent.band}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${C} ${C}`}
                animatedProps={ring}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            {complete ? (
              <CheckIcon size={26} color={text.primary} weight="bold" />
            ) : (
              <Text style={styles.ringText}>{`${state.answered}/${state.total}`}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.headline}>
              {complete
                ? "All answered"
                : state.answered
                  ? `${left} ${left === 1 ? "question" : "questions"} left`
                  : `${state.total} quick questions`}
            </Text>
            <Text style={styles.heroSub}>{state.why}.</Text>
          </View>
        </View>
        {!complete ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={state.answered ? "Continue" : "Start"}
            scaleTo={0.97}
            style={styles.cta}
            onPress={start}
          >
            <Text style={styles.ctaText}>{state.answered ? "Continue" : "Start"}</Text>
            <ArrowRightIcon size={18} color={text.primary} weight="bold" />
          </PressScale>
        ) : null}
      </Animated.View>

      {setKey === "basics" && profile.stage && profile.focus ? (
        <Section title={`${profile.stage}${profile.breed ? `, ${profile.breed}` : ""}`}>
          <View style={styles.list}>
            <Fact Glyph={HeartIcon} label="Care focus" value={profile.focus.care} />
            <Fact Glyph={GraduationCapIcon} label="Training focus" value={profile.focus.train} ruled />
          </View>
        </Section>
      ) : null}

      {setKey === "safety" ? <FromRecord /> : null}

      {setKey === "baseline" && profile.plan.length ? (
        <Section title={`${profile.name}'s training plan`}>
          <View style={styles.list}>
            {profile.plan.map((module, i) => (
              <View key={module} style={[styles.planRow, i > 0 && styles.ruled]}>
                <View style={[styles.planNum, i === 0 && styles.planNumOn]}>
                  <Text style={styles.planNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.planText}>{module}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {lines.length ? (
        <Section title={`Tailored for ${profile.name}`}>
          <View style={styles.lines}>
            {lines.map((line) => (
              <View key={line} style={styles.line}>
                <View style={styles.lineCheck}>
                  <CheckIcon size={11} color={text.primary} weight="bold" />
                </View>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Only what is answered; upcoming questions stay out of sight so the page never reads like homework. */}
      {state.answered ? (
        <Section title="Answers">
          <View style={styles.list}>
            {state.questions
              .filter((q) => state.answers[q.id])
              .map((q, i) => {
                const answer = state.answers[q.id];
                const AreaGlyph = q.area === "care" ? HeartIcon : GraduationCapIcon;
                return (
                  <PressScale
                    key={q.id}
                    accessibilityRole="button"
                    accessibilityLabel={answer ? `${q.short}, ${answer}. Change` : `${q.short}. Answer`}
                    scaleTo={0.985}
                    style={[styles.row, i > 0 && styles.ruled]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push(`/profile/get-to-know?set=${setKey}&q=${q.id}&only=1` as never);
                    }}
                  >
                    <View style={[styles.disc, answer && styles.discOn]}>
                      {answer ? (
                        <CheckIcon size={13} color={text.primary} weight="bold" />
                      ) : (
                        <AreaGlyph size={14} color={text.secondary} weight="fill" />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{q.short}</Text>
                      <Text style={[styles.rowSub, answer && styles.rowAnswer]} numberOfLines={2}>
                        {answer ?? q.why}
                      </Text>
                    </View>
                    <CaretRightIcon size={13} color={text.tertiary} weight="bold" />
                  </PressScale>
                );
              })}
          </View>
        </Section>
      ) : null}
    </DetailShell>
  );
};

/** Conditions, allergies and medicines already live in the medical record; shown here so the picture is whole. */
const FromRecord = () => {
  const dog = useCurrentDog();
  const record = useHealthRecord();
  const meds = useMedications(dog.data?.id);
  const conditions = record.items.filter((i) => i.kind === "condition").map((i) => i.insight?.name ?? i.name);
  const allergies = record.items.filter((i) => i.kind === "allergy").map((i) => i.name);
  const active = (meds.data ?? []).filter((m) => m.isActive).map((m) => m.medicationName);
  const summary = [...conditions, ...allergies.map((a) => `${a} allergy`), ...active].join(" · ") || "Nothing on file";
  return (
    <View style={styles.section}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Medical record. ${summary}. Open`}
        scaleTo={0.985}
        style={[styles.list, styles.row]}
        onPress={() => router.push("/profile/health" as never)}
      >
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Medical record</Text>
          <Text style={[styles.rowSub, styles.rowAnswer]} numberOfLines={2}>
            {summary}
          </Text>
        </View>
        <CaretRightIcon size={13} color={text.tertiary} weight="bold" />
      </PressScale>
    </View>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Fact = ({ Glyph, label, value, ruled = false }: { Glyph: PhosphorIcon; label: string; value: string; ruled?: boolean }) => (
  <View style={[styles.row, ruled && styles.ruled]}>
    <View style={[styles.disc, styles.discOn]}>
      <Glyph size={14} color={text.primary} weight="fill" />
    </View>
    <View style={styles.flex}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={[styles.rowSub, styles.rowAnswer]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { marginTop: space.lg, padding: space.xxl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.lg },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringText: { fontSize: 17, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  headline: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary },
  heroSub: { ...type.supporting, color: text.secondary, marginTop: 4 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 52,
    marginTop: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  ctaText: { ...type.cardTitle, fontWeight: "700", color: text.primary },

  section: { marginTop: space.section },
  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginBottom: space.lg },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: bg.canvas,
  },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 30, height: 30, borderRadius: 15, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowSub: { ...type.caption, color: text.tertiary, marginTop: 2 },
  rowAnswer: { ...type.supporting, color: text.secondary },

  planRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 54, paddingHorizontal: space.lg, backgroundColor: bg.canvas },
  planNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  planNumOn: { backgroundColor: accent.deep },
  planNumText: { ...type.caption, fontWeight: "700", color: text.primary },
  planText: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },

  lines: { gap: space.md },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  lineCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: 1,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  lineText: { ...type.body, color: text.primary, flex: 1 },
});
