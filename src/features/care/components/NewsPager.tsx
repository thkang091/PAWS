import { useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { CareDog } from "@/features/care/components/CareDog";
import { MISSED } from "@/features/care/components/WeekMarks";
import { layout, motion, space, text } from "@/constants/design";

export type NewsPage = { key: string; label: string; alert?: boolean; node: ReactNode };

const ART = 96;

/**
 * The top of Care home, as it always looked, only now it turns: the news slides page by page beside the dog, who
 * stays where he is. Every page is the same shape and the row keeps one height (the tallest page), so nothing below
 * moves while you swipe. Dots under the text say there is more; a light tick marks each new page.
 */
export const NewsPager = ({ pages }: { pages: readonly NewsPage[] }) => {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  const measured = useRef<number[]>([]);
  const pageWidth = width - ART - layout.gutter;
  const single = pages.length < 2;

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / pageWidth)));
    if (next !== index) {
      void Haptics.selectionAsync();
      setIndex(next);
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!single}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={settle}
          style={[styles.scroller, { width: pageWidth }, height != null && { height }]}
          contentContainerStyle={styles.track}
        >
          {pages.map((page, i) => (
            <View
              key={page.key}
              style={[styles.page, { width: pageWidth }]}
              accessibilityLabel={single ? page.label : `${i + 1} of ${pages.length}. ${page.label}`}
              onLayout={(e) => {
                measured.current[i] = e.nativeEvent.layout.height;
                const all = measured.current.slice(0, pages.length);
                if (all.length === pages.length && all.every(Boolean)) setHeight(Math.max(...all));
              }}
            >
              {page.node}
            </View>
          ))}
        </ScrollView>
        <View style={styles.art} pointerEvents="none">
          <CareDog art="walk" width={92} />
        </View>
      </View>
      {single ? null : (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {pages.map((page, i) => (
            <Dot key={page.key} on={i === index} alert={Boolean(page.alert)} />
          ))}
        </View>
      )}
    </View>
  );
};

const Dot = ({ on, alert }: { on: boolean; alert: boolean }) => {
  const reduceMotion = useReducedMotion();
  const grow = useDerivedValue(() => (reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out })), [on]);
  const style = useAnimatedStyle(() => ({ width: 6 + grow.value * 10, opacity: 0.25 + grow.value * 0.75 }));
  return <Animated.View style={[styles.dot, alert && styles.dotAlert, style]} />;
};

const styles = StyleSheet.create({
  // The text runs out to the left edge as it slides away, and stops short of the dog on the right.
  row: { flexDirection: "row", alignItems: "flex-end", marginLeft: -layout.gutter, marginRight: -layout.gutter },
  scroller: { flexGrow: 0 },
  track: { alignItems: "flex-start" },
  page: { paddingLeft: layout.gutter, paddingRight: space.sm },
  art: { width: ART, alignItems: "flex-end", paddingRight: space.sm },
  dots: { flexDirection: "row", gap: 5, marginTop: space.md },
  dot: { height: 6, borderRadius: 3, backgroundColor: text.primary },
  dotAlert: { backgroundColor: MISSED },
});
