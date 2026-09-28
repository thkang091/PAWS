import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import { CheckIcon } from "phosphor-react-native";

import type { ScriptStep } from "@/features/train/components/lessonScript";
import { accent, bg, border, motion, space, text, type } from "@/constants/design";

const DISC = 30;

export type LessonStepsProps = {
  steps: readonly ScriptStep[];
  activeStep?: number;
  activeCue?: number;
};

export const LessonSteps = ({
  steps,
  activeStep = -1,
  activeCue = -1,
}: LessonStepsProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <View>
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = activeStep > index;

        return (
          <Animated.View
            key={step.title}
            entering={
              reduceMotion
                ? undefined
                : FadeInDown.duration(motion.duration.enter).delay(index * motion.stagger)
            }
            style={styles.row}
          >
            <View style={styles.rail}>
              <View style={[styles.disc, isActive && styles.discActive, isDone && styles.discDone]}>
                {isDone ? (
                  <CheckIcon size={14} color={text.primary} weight="bold" />
                ) : (
                  <Text style={styles.discText}>{index + 1}</Text>
                )}
              </View>
              {index < steps.length - 1 ? <View style={styles.line} /> : null}
            </View>

            <View style={[styles.copy, index < steps.length - 1 && styles.copyGap]}>
              <Text style={[styles.title, isDone && styles.titleDone]}>{step.title}</Text>
              <View style={styles.cues}>
                {step.cues.map((cue, cueIndex) => (
                  <Cue
                    key={cue.at}
                    text={cue.text}
                    spoken={isActive && cueIndex === activeCue}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
};

const Cue = ({
  text: body,
  spoken,
  reduceMotion,
}: {
  text: string;
  spoken: boolean;
  reduceMotion: boolean;
}) => {
  const lit = useDerivedValue(
    () =>
      reduceMotion
        ? (spoken ? 1 : 0)
        : withTiming(spoken ? 1 : 0, {
            duration: motion.duration.select,
            easing: motion.easing.out,
          }),
    [reduceMotion, spoken],
  );

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.value, [0, 1], ["rgba(244,242,192,0)", accent.primary]),
  }));

  const tone = useAnimatedStyle(() => ({
    color: interpolateColor(lit.value, [0, 1], [text.secondary, text.primary]),
  }));

  return (
    <Animated.View style={[styles.cue, surface]}>
      <Animated.Text style={[styles.cueText, tone]}>{body}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  rail: { width: DISC, alignItems: "center" },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  discActive: { backgroundColor: accent.deep },
  discDone: { backgroundColor: accent.primary },
  discText: { ...type.caption, fontWeight: "700", color: text.primary },
  line: { flex: 1, width: 1, backgroundColor: border.soft, marginVertical: space.sm },

  copy: { flex: 1, marginLeft: space.lg },
  copyGap: { paddingBottom: space.xl },
  title: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: 4 },
  titleDone: { color: text.secondary },

  cues: { marginTop: space.xs, marginLeft: -space.sm },
  cue: { borderRadius: 8, paddingHorizontal: space.sm, paddingVertical: 3 },
  cueText: { ...type.supporting },
});
