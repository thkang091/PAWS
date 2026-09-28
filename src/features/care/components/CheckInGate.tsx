import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { HeartbeatIcon } from "phosphor-react-native";

import { APPETITE } from "@/features/care/components/DailyHealthCheckSheet";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import type { Appetite } from "@/features/care/state/dailyCheckIn";
import { PressScale } from "@/components/ui/PressScale";
import { accent, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

export const CheckInGate = ({
  dogName,
  time,
  onAnswer,
  onLater,
}: {
  dogName: string;
  time: string;
  onAnswer: (appetite: Appetite) => void;
  onLater: () => void;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.reveal).easing(motion.easing.out)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.exit)}
      style={styles.card}
      accessibilityRole="summary"
    >
      <View style={styles.top}>
        <View style={styles.mark}>
          <HeartbeatIcon size={iconSize.standard} color={text.primary} weight="fill" />
        </View>
        <Text style={styles.when}>{`Evening check-in, ${prettyTime(time)}`}</Text>
      </View>

      <Text style={styles.question} accessibilityRole="header">
        How did {dogName} eat today?
      </Text>
      <Text style={styles.note}>Four quick ones after this. It is how PAWS spots a change early.</Text>

      <View style={styles.answers}>
        {APPETITE.map((option) => (
          <PressScale
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            scaleTo={0.96}
            style={styles.answer}
            onPress={() => {
              void Haptics.selectionAsync();
              onAnswer(option.key);
            }}
          >
            <Text style={styles.answerText}>{option.label}</Text>
          </PressScale>
        ))}
      </View>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Answer later"
        hitSlop={8}
        scaleTo={0.95}
        style={styles.later}
        onPress={() => {
          void Haptics.selectionAsync();
          onLater();
        }}
      >
        <Text style={styles.laterText}>Later</Text>
      </PressScale>
    </Animated.View>
  );
};

const INK_SOFT = "rgba(255,255,255,0.68)";

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    padding: space.xl,
    borderRadius: radius.card + 8,
    backgroundColor: text.primary,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  mark: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  when: { ...type.supporting, fontWeight: "600", color: INK_SOFT },
  question: { ...type.pageTitle, color: text.inverse, marginTop: space.lg },
  note: { ...type.supporting, color: INK_SOFT, marginTop: space.sm, lineHeight: 21 },
  answers: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  answer: {
    flexBasis: "47%",
    flexGrow: 1,
    height: 52,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  answerText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  later: { alignSelf: "center", marginTop: space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm },
  laterText: { ...type.supporting, fontWeight: "600", color: INK_SOFT },
});
