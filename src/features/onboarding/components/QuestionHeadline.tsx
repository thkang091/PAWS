import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { accent, radius, space, text, type } from "@/constants/design";

export type QuestionPart =
  | { kind: "text"; value: string }
  | { kind: "accent"; value: string; suffix?: string }
  | { kind: "slot"; render: () => ReactNode; suffix?: string };

type QuestionHeadlineProps = {
  parts: QuestionPart[];
  scale?: "hero" | "title";
  trailing?: ReactNode;
};

export const QuestionHeadline = ({ parts, scale = "hero", trailing }: QuestionHeadlineProps) => {
  const textStyle = scale === "hero" ? styles.hero : styles.title;
  const barStyle = scale === "hero" ? styles.bar : styles.barTitle;

  return (
  <View
    accessibilityRole="header"
    style={styles.row}
    accessibilityLiveRegion="none"
  >
    {parts.map((part, index) => {
      const isLast = index === parts.length - 1;
      const tail = isLast && trailing ? <View style={styles.trailing}>{trailing}</View> : null;

      if (part.kind === "slot") {
        return (
          <View key={index} style={styles.item}>
            {part.render()}
            {part.suffix ? <Text style={textStyle}>{part.suffix}</Text> : null}
            {tail}
          </View>
        );
      }

      return (
        <View key={index} style={styles.item}>
          <View>
            <Text style={textStyle}>{part.value}</Text>
            {part.kind === "accent" ? <View style={barStyle} /> : null}
          </View>
          {part.kind === "accent" && part.suffix ? (
            <Text style={textStyle}>{part.suffix}</Text>
          ) : null}
          {tail}
        </View>
      );
    })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 10,
  },
  hero: {
    ...type.hero,
    color: text.primary,
  },
  title: {
    ...type.pageTitle,
    color: text.primary,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -4,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  barTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -3,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  trailing: {
    marginLeft: space.sm,
    marginBottom: space.md,
  },
});
