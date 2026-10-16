import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { accent, border, radius, text, type } from "@/constants/design";

export const Ruler = ({
  count,
  index,
  minIndex = 0,
  step = 12,
  majorEvery = 6,
  label,
  markIndex,
  onChange,
  accessibilityLabel,
  valueText,
}: {
  count: number;
  index: number;
  minIndex?: number;
  step?: number;
  majorEvery?: number;
  label: (i: number) => string | null;
  /** A suggested value, shown as a small butter dot above its tick. */
  markIndex?: number;
  onChange: (index: number) => void;
  accessibilityLabel: string;
  valueText: string;
}) => {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const live = useRef(index);
  const dragging = useRef(false);

  useEffect(() => {
    if (!width || dragging.current) return;
    live.current = index;
    ref.current?.scrollTo({ x: index * step, animated: false });
  }, [index, step, width]);

  const settle = (x: number) => {
    const raw = Math.max(0, Math.min(count - 1, Math.round(x / step)));
    const next = Math.max(minIndex, raw);
    dragging.current = false;
    if (raw < minIndex) ref.current?.scrollTo({ x: minIndex * step, animated: true });
    if (next !== index) onChange(next);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(count - 1, Math.round(event.nativeEvent.contentOffset.x / step)));
    if (next !== live.current) {
      live.current = next;
      void Haptics.selectionAsync();
      if (dragging.current) onChange(Math.max(minIndex, next));
    }
  };

  return (
    <View
      style={styles.root}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const next = event.nativeEvent.actionName === "increment" ? Math.min(count - 1, index + 1) : Math.max(0, index - 1);
        onChange(next);
      }}
    >
      {width ? (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: width / 2 - step / 2 }}
          contentOffset={{ x: index * step, y: 0 }}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onScroll={onScroll}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
          onScrollEndDrag={(event) => {
            if ((event.nativeEvent.velocity?.x ?? 0) === 0) settle(event.nativeEvent.contentOffset.x);
          }}
        >
          {Array.from({ length: count }, (_, i) => {
            const major = i % majorEvery === 0;
            const tag = major ? label(i) : null;
            return (
              <View key={i} style={[styles.cell, { width: step }]}>
                {i === markIndex ? <View style={styles.mark} /> : null}
                <View style={[styles.tick, major && styles.tickMajor]} />
                {tag ? (
                  <Text style={styles.tag} numberOfLines={1}>
                    {tag}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
      <View pointerEvents="none" style={styles.needleWrap}>
        <View style={styles.needle} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { height: 64, justifyContent: "center" },
  cell: { height: 64, alignItems: "center", paddingTop: 10, overflow: "visible" },
  mark: { position: "absolute", top: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: accent.band },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: border.default },
  tickMajor: { height: 22, backgroundColor: border.strong },
  tag: { ...type.caption, color: text.tertiary, marginTop: 6, width: 72, textAlign: "center", fontVariant: ["tabular-nums"] },
  needleWrap: { position: "absolute", top: 2, bottom: 26, left: 0, right: 0, alignItems: "center" },
  needle: { width: 4, flex: 1, borderRadius: radius.pill, backgroundColor: accent.deep },
});
