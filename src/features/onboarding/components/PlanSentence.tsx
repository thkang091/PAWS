import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, motion, radius, text, type } from "@/constants/design";

export type SentencePart =
  | { kind: "plain"; text: string; suffix?: string }
  | { kind: "value"; text: string; suffix?: string; onPress: () => void };

const explode = (parts: SentencePart[]): SentencePart[] =>
  parts.flatMap((part) => {
    if (part.kind !== "plain") return [part];
    const words = part.text.split(" ").filter(Boolean);
    return words.map(
      (word, i): SentencePart => ({
        kind: "plain",
        text: word,
        suffix: i === words.length - 1 ? part.suffix : undefined,
      }),
    );
  });

export const PlanSentence = ({
  parts,
  reduceMotion,
}: {
  parts: SentencePart[];
  reduceMotion: boolean;
}) => (
  <View
    style={styles.row}
    accessibilityRole="summary"
    accessibilityLabel={parts.map((p) => p.text).join(" ")}
  >
    {explode(parts).map((part, index) =>
      part.kind === "plain" ? (
        <Text key={`p${index}`} style={[styles.text, styles.item]}>
          {part.text}
          {part.suffix ?? ""}
        </Text>
      ) : (
        <Animated.View
          key={`v${index}-${part.text}`}
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
          style={styles.item}
        >
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${part.text}. Tap to change.`}
            scaleTo={0.98}
            onPress={() => {
              void Haptics.selectionAsync();
              part.onPress();
            }}
          >
            <View style={styles.valueRow}>
              <View>
                <Text style={styles.text}>{part.text}</Text>
                <View style={styles.bar} />
              </View>
              {part.suffix ? <Text style={styles.text}>{part.suffix}</Text> : null}
            </View>
          </PressScale>
        </Animated.View>
      ),
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    rowGap: 8,
  },
  item: {
    marginRight: 5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  text: {
    ...type.body,
    fontSize: 17,
    lineHeight: 27,
    color: text.primary,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -3,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
});
