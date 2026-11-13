import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";

import { PressScale } from "@/components/ui/PressScale";
import { layout, text } from "@/constants/design";

export type PagerHandle = { goTo: (page: number) => void };

/**
 * Full-width pages side by side: swipe between them with the platform's own paging and momentum (interruptible, follows
 * the finger). The dots below follow the scroll position itself, not a timer.
 */
export const Pager = forwardRef<PagerHandle, { pages: readonly React.ReactNode[]; labels: readonly string[]; onPage?: (page: number) => void; dotsBottom?: number; tabs?: boolean }>(({ pages, labels, onPage, dotsBottom = 0, tabs = false }, ref) => {
  const { width } = useWindowDimensions();
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const last = useRef(0);
  const report = (page: number) => {
    if (page === last.current) return;
    last.current = page;
    onPage?.(page);
  };
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      runOnJS(report)(Math.round(e.contentOffset.x / width));
    },
  });
  useImperativeHandle(ref, () => ({ goTo: (page: number) => scroll.current?.scrollTo({ x: page * width, animated: true }) }));
  return (
    <View style={styles.flex}>
      {tabs ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {labels.map((label, i) => (
            <PressScale key={label} accessibilityRole="tab" accessibilityLabel={label} hitSlop={8} scaleTo={0.96} style={styles.tab} onPress={() => scroll.current?.scrollTo({ x: i * width, animated: true })}>
              <Tab index={i} label={label} x={x} width={width} />
            </PressScale>
          ))}
        </View>
      ) : null}
      <Animated.ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} style={styles.flex}>
        {pages.map((p, i) => (
          <View key={labels[i]} style={{ width }} accessibilityLabel={labels[i]}>
            {p}
          </View>
        ))}
      </Animated.ScrollView>
      {tabs ? null : (
      <View style={[styles.dots, { bottom: dotsBottom }]} pointerEvents="box-none">
        {labels.map((label, i) => (
          <PressScale key={label} accessibilityRole="button" accessibilityLabel={`Show ${label}`} hitSlop={10} style={styles.dotHit} onPress={() => scroll.current?.scrollTo({ x: i * width, animated: true })}>
            <Dot index={i} x={x} width={width} />
          </PressScale>
        ))}
      </View>
      )}
    </View>
  );
});
Pager.displayName = "Pager";

/** A dot that grows and darkens as its page comes into view (uniform scale keeps it round). */
const Dot = ({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) => {
  const style = useAnimatedStyle(() => {
    const t = interpolate(x.value / width, [index - 1, index, index + 1], [0, 1, 0], "clamp");
    return { transform: [{ scale: 1 + t * 0.4 }], opacity: 0.3 + t * 0.7 };
  });
  return <Animated.View style={[styles.dot, style]} />;
};

/** A page name that brightens, and grows a short bar under it, as its page comes into view. */
const Tab = ({ index, label, x, width }: { index: number; label: string; x: SharedValue<number>; width: number }) => {
  const textStyle = useAnimatedStyle(() => ({ opacity: 0.38 + interpolate(x.value / width, [index - 1, index, index + 1], [0, 1, 0], "clamp") * 0.62 }));
  const barStyle = useAnimatedStyle(() => {
    const t = interpolate(x.value / width, [index - 1, index, index + 1], [0, 1, 0], "clamp");
    return { opacity: t, transform: [{ scaleX: 0.4 + t * 0.6 }] };
  });
  return (
    <View style={styles.tabInner}>
      <Animated.Text style={[styles.tabText, textStyle]}>{label}</Animated.Text>
      <Animated.View style={[styles.tabBar, barStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 22, paddingHorizontal: layout.gutter, paddingBottom: 6 },
  tab: { paddingVertical: 4 },
  tabInner: { alignItems: "center", gap: 4 },
  tabText: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2, color: text.primary },
  tabBar: { height: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: text.primary },
  flex: { flex: 1 },
  // A small floating capsule, so the dots stay readable over a scrolled list.
  dots: { position: "absolute", alignSelf: "center", flexDirection: "row", justifyContent: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.94)", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  dotHit: { paddingVertical: 6, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: text.primary },
});
