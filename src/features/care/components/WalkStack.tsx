import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import type { Walk } from "@/features/care/components/activityData";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const PEEK = 7;
const SHOULDER = 10;

export const WalkStack = memo(({ walks, emptyText }: { walks: readonly Walk[]; emptyText: string }) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  if (walks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  const stacked = walks.length > 1 && !open;
  const behind = Math.min(walks.length - 1, 2);

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          stacked
            ? `${walks.length} walks. First at ${prettyTime(walks[0].startedAt)}: ${walks[0].duration}, ${walks[0].distance}. Show all.`
            : "Collapse walks"
        }
        scaleTo={0.985}
        disabled={walks.length < 2}
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((value) => !value);
        }}
      >
        <View>
          {stacked
            ? Array.from({ length: behind }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.shoulder,
                    {
                      top: (i + 1) * PEEK,
                      left: (i + 1) * SHOULDER,
                      right: (i + 1) * SHOULDER,
                      zIndex: -i - 1,
                    },
                  ]}
                />
              ))
            : null}

          <WalkRow walk={walks[0]} />

          {!stacked
            ? walks.slice(1).map((walk, index) => (
                <Animated.View
                  key={walk.key}
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeIn.duration(motion.duration.select)
                          .delay(index * 40)
                          .withInitialValues({ opacity: 0, transform: [{ translateY: -8 }] })
                  }
                  style={styles.stacked}
                >
                  <WalkRow walk={walk} />
                </Animated.View>
              ))
            : null}
        </View>
      </PressScale>

      {stacked ? (
        <Text style={styles.more}>
          {walks.length - 1} more {walks.length - 1 === 1 ? "walk" : "walks"}
        </Text>
      ) : null}
    </Animated.View>
  );
});

WalkStack.displayName = "WalkStack";

const WalkRow = ({ walk }: { walk: Walk }) => (
  <View style={styles.card}>
    <View style={styles.badge}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {walk.label}
      </Text>
    </View>
    <View style={styles.cell}>
      <Text style={styles.value}>{prettyTime(walk.startedAt)}</Text>
      <Text style={styles.caption}>Started</Text>
    </View>
    <View style={styles.rule} />
    <View style={styles.cell}>
      <Text style={styles.value}>{walk.duration}</Text>
      <Text style={styles.caption}>Time</Text>
    </View>
    <View style={styles.rule} />
    <View style={styles.cell}>
      <Text style={[styles.value, walk.distance === "No distance" && styles.valueQuiet]}>
        {walk.distance === "No distance" ? "Not logged" : walk.distance}
      </Text>
      <Text style={styles.caption}>Distance</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    paddingLeft: 6,
    paddingRight: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },
  stacked: { marginTop: space.sm },
  shoulder: {
    position: "absolute",
    height: 64,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },

  badge: {
    paddingHorizontal: space.md,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  badgeText: { ...type.supporting, fontWeight: "600", color: text.primary },

  cell: { flex: 1, alignItems: "center" },
  value: { ...type.supporting, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  valueQuiet: { color: text.tertiary },
  caption: { ...type.caption, fontSize: 11, color: text.tertiary, marginTop: 1 },
  rule: { width: 1, height: 26, backgroundColor: border.soft },

  more: { ...type.caption, color: text.tertiary, marginTop: space.md, marginLeft: space.xs },

  empty: {
    paddingVertical: space.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
  },
  emptyText: { ...type.supporting, color: text.tertiary },
});
