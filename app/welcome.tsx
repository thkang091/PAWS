import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { PageDots } from "@/features/welcome/components/PageDots";
import { PawsMark } from "@/features/welcome/components/PawsMark";
import { SceneNote } from "@/features/welcome/components/SceneNote";
import { WelcomeBackdrop } from "@/features/welcome/components/WelcomeBackdrop";
import { WelcomeScene, sceneAspect } from "@/features/welcome/components/WelcomeScene";
import { PrimaryCta } from "@/features/onboarding/components/PrimaryCta";
import { welcomePanels, type WelcomePanel } from "@/constants/welcomePanels";
import { bg, layout, motion, radius, space, text, type } from "@/constants/design";

const SHEET_LIFT = 26;

const COPY_HEIGHT = space.section + 80 + space.lg + 69 + space.xxl;

const FOOTER_HEIGHT = space.lg + 8 + space.xl + layout.controlHeight + space.xl + 62;

const MIN_STAGE = 208;

const last = welcomePanels.length - 1;

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const reduceMotion = useReducedMotion();

  const available = height - insets.top - insets.bottom;
  const stageHeight = Math.max(
    MIN_STAGE,
    Math.round(available - FOOTER_HEIGHT - COPY_HEIGHT + SHEET_LIFT),
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const progress = useDerivedValue(() => (width > 0 ? scrollX.value / width : 0), [width]);

  const arrival = useDerivedValue(
    () => interpolate(progress.value, [last - 1, last], [0, 1], Extrapolation.CLAMP),
    [],
  );

  const continueStyle = useAnimatedStyle(() => ({ opacity: 1 - arrival.value }));
  const accountStyle = useAnimatedStyle(() => ({ opacity: arrival.value }));

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const startOnboarding = () => router.push("/onboarding");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.body}>
      <View style={[styles.stage, { height: stageHeight }]}>
        <WelcomeBackdrop progress={progress} span={width} />
        <View style={styles.mark} pointerEvents="none">
          <PawsMark />
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        style={styles.pager}
      >
        {welcomePanels.map((panel, index) => (
          <Panel
            key={panel.scene}
            panel={panel}
            index={index}
            active={index === page}
            width={width}
            stageHeight={stageHeight}
            progress={progress}
            reduceMotion={reduceMotion}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <PageDots count={welcomePanels.length} progress={progress} />

        <View style={styles.ctaSlot}>
          <Animated.View
            style={[styles.ctaLayer, continueStyle]}
            pointerEvents={page === last ? "none" : "auto"}
          >
            <PrimaryCta label="Continue" onPress={() => goTo(Math.min(page + 1, last))} />
          </Animated.View>
          <Animated.View
            style={[styles.ctaLayer, accountStyle]}
            pointerEvents={page === last ? "auto" : "none"}
          >
            <PrimaryCta label="Create an account" onPress={startOnboarding} />
          </Animated.View>
        </View>

        <View style={styles.tailSlot}>
          <Animated.View
            style={[styles.tailLayer, continueStyle]}
            pointerEvents={page === last ? "none" : "auto"}
          >
            <TextButton label="Skip for now" onPress={startOnboarding} />
          </Animated.View>
          <Animated.View
            style={[styles.tailLayer, accountStyle]}
            pointerEvents={page === last ? "auto" : "none"}
          >
            <View style={styles.signInRow}>
              <Text style={styles.quiet}>Have an account already?</Text>
              <TextButton label="Sign in" strong onPress={() => router.push("/account/link")} />
            </View>
            <TextButton label="Continue as a guest" strong onPress={startOnboarding} />
          </Animated.View>
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}

const Panel = ({
  panel,
  index,
  active,
  width,
  stageHeight,
  progress,
  reduceMotion,
}: {
  panel: WelcomePanel;
  index: number;
  active: boolean;
  width: number;
  stageHeight: number;
  progress: SharedValue<number>;
  reduceMotion: boolean;
}) => {
  const aspect = sceneAspect(panel.scene);
  const room = stageHeight - space.sectionLg - panel.sceneShift;
  const artWidth = Math.round(
    Math.min((width - layout.gutter * 2) * panel.sceneWidth, room * aspect),
  );
  const artHeight = artWidth / aspect;

  const sceneStyle = useAnimatedStyle(() => {
    const d = progress.value - index;
    if (reduceMotion) return { opacity: 1 - Math.min(Math.abs(d), 1) };
    return {
      opacity: interpolate(Math.abs(d), [0, 0.9], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: -d * width * 0.26 },
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.86], Extrapolation.CLAMP) },
      ],
    };
  }, [index, width, reduceMotion]);

  const copyStyle = useAnimatedStyle(() => {
    const d = progress.value - index;
    if (reduceMotion) return { opacity: 1 - Math.min(Math.abs(d), 1) };
    return {
      opacity: interpolate(Math.abs(d), [0, 0.55], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: d * width * 0.1 },
        { translateY: interpolate(Math.abs(d), [0, 1], [0, 18], Extrapolation.CLAMP) },
      ],
    };
  }, [index, width, reduceMotion]);

  return (
    <View
      style={{ width }}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={[styles.art, { height: stageHeight }]}>
        <Animated.View
          style={[
            styles.note,
            { left: width * panel.noteAt.x, top: stageHeight * panel.noteAt.y },
            sceneStyle,
          ]}
        >
          <SceneNote lines={panel.note} tilt={panel.noteTilt} delay={620 + index * 60} />
        </Animated.View>
        <Animated.View
          style={[
            { width: artWidth, height: artHeight, marginBottom: panel.sceneShift },
            sceneStyle,
          ]}
        >
          <WelcomeScene sceneKey={panel.scene} width={artWidth} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <Text style={styles.headline} accessibilityRole="header">
          {panel.headline.join("\n")}
        </Text>
        <Text style={styles.bodyCopy}>{panel.body}</Text>
      </Animated.View>
    </View>
  );
};

const TextButton = ({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={space.md}
  >
    {({ pressed }) => (
      <Text style={[styles.textButton, strong && styles.textButtonStrong, pressed && styles.pressed]}>
        {label}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bg.canvas,
  },
  body: {
    flex: 1,
  },
  stage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: bg.stage,
    overflow: "hidden",
  },
  mark: {
    position: "absolute",
    left: layout.gutter,
    top: space.sm,
  },
  pager: {
    flex: 1,
  },
  art: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: space.sectionLg,
  },
  note: {
    position: "absolute",
  },
  copy: {
    height: COPY_HEIGHT + SHEET_LIFT,
    backgroundColor: bg.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -SHEET_LIFT,
    paddingTop: space.section,
    paddingHorizontal: layout.gutter,
  },
  headline: {
    ...type.hero,
    lineHeight: 40,
    color: text.primary,
  },
  bodyCopy: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 330,
  },
  footer: {
    backgroundColor: bg.surface,
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
    gap: space.xl,
  },
  ctaSlot: {
    height: layout.controlHeight,
  },
  ctaLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tailSlot: {
    height: 62,
    alignItems: "center",
  },
  tailLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: space.md,
  },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  quiet: {
    ...type.supporting,
    color: text.secondary,
  },
  textButton: {
    ...type.supporting,
    color: text.secondary,
  },
  textButtonStrong: {
    color: text.primary,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.55,
  },
});
