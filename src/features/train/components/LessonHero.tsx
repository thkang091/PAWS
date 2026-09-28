import type { ReactNode } from "react";
import {
  type ImageSourcePropType,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeftIcon, PawPrintIcon, PlayIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, icon as iconSize, radius, space, text, type } from "@/constants/design";

export type LessonHeroProps = {
  lessonNumber?: number;
  title: string;
  chapter?: string;
  badge?: string;
  poster?: ImageSourcePropType;
  collapse: SharedValue<number>;
  topInset: number;
  onBack?: () => void;
  onPlay?: () => void;
  children?: ReactNode;
};

const BADGE = 104;

export const LessonHero = ({
  lessonNumber,
  title,
  chapter,
  badge,
  poster,
  collapse,
  topInset,
  onBack,
  onPlay,
  children,
}: LessonHeroProps) => {
  const overlay = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - collapse.value / 0.66),
  }));
  const play = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - collapse.value / 0.4),
    transform: [{ scale: 1 - collapse.value * 0.25 }],
  }));

  return (
    <View style={styles.media}>
      {children ? (
        <View style={StyleSheet.absoluteFill}>{children}</View>
      ) : poster ? (
        <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.plate]}>
          <Text style={styles.plateText}>Video slot</Text>
        </View>
      )}

      <LinearGradient
        colors={["rgba(28,27,26,0.46)", "rgba(28,27,26,0)"]}
        style={[styles.scrimTop, { height: topInset + 120 }]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.scrimBottom, overlay]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(28,27,26,0)", "rgba(28,27,26,0.62)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={[styles.chrome, { top: topInset + space.sm }]} pointerEvents="box-none">
        {onBack ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            onPress={onBack}
          >
            <ArrowLeftIcon size={iconSize.nav} color={bg.surface} weight="bold" />
          </PressScale>
        ) : (
          <View />
        )}

        <Animated.View style={[styles.chromeRight, overlay]} pointerEvents="box-none">
          <View style={styles.pawChip}>
            <PawPrintIcon size={iconSize.inline} color={bg.surface} weight="fill" />
          </View>
          {chapter ? (
            <View style={styles.chapterPill}>
              <Text style={styles.chapterText}>{chapter}</Text>
              <PlayIcon size={iconSize.inline} color={bg.surface} weight="fill" />
            </View>
          ) : null}
        </Animated.View>
      </View>

      {badge ? (
        <Animated.View
          style={[styles.badge, { top: topInset + 76 }, overlay]}
          pointerEvents="none"
        >
          <CircleBadge label={badge} />
        </Animated.View>
      ) : null}

      {onPlay ? (
        <Animated.View style={[styles.playWrap, play]} pointerEvents="box-none">
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Play lesson"
            scaleTo={0.94}
            style={styles.play}
            onPress={onPlay}
          >
            <PlayIcon size={28} color={text.primary} weight="fill" />
          </PressScale>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.caption, overlay]} pointerEvents="none">
        {lessonNumber !== undefined ? (
          <Text style={styles.lessonLine}>Lesson {lessonNumber}</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </Animated.View>
    </View>
  );
};

const CircleBadge = ({ label }: { label: string }) => (
  <Svg width={BADGE} height={BADGE} viewBox="0 0 100 100">
    <Defs>
      <Path id="lessonRing" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" fill="none" />
    </Defs>
    <Circle cx={50} cy={50} r={46} fill={accent.primary} opacity={0.95} />
    <SvgText fill={text.primary} fontSize={9.5} fontWeight="700" letterSpacing={0.85}>
      <TextPath href="#lessonRing" startOffset="6%">
        {label.toUpperCase()}
      </TextPath>
    </SvgText>
  </Svg>
);

const styles = StyleSheet.create({
  media: { flex: 1, backgroundColor: text.primary, overflow: "hidden" },
  plate: { backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  plateText: { ...type.cardTitle, fontWeight: "600", color: text.tertiary },

  scrimTop: { position: "absolute", left: 0, right: 0, top: 0 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 260 },

  chrome: {
    position: "absolute",
    left: space.xl,
    right: space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  chromeRight: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pawChip: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,27,26,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  chapterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,27,26,0.55)",
  },
  chapterText: { ...type.supporting, fontWeight: "600", color: bg.surface },

  badge: { position: "absolute", left: space.xl },

  playWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },

  caption: { position: "absolute", left: space.xl, right: space.xl, bottom: space.section },
  lessonLine: {
    ...type.caption,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.82)",
    marginBottom: space.xs,
  },
  title: { ...type.pageTitle, fontSize: 27, lineHeight: 32, color: text.inverse },
});
