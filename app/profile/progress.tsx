import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedRef,
  useReducedMotion,
  useScrollViewOffset,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon } from "phosphor-react-native";

import { BlockList } from "@/features/profile/components/blocks";
import { Panel, PanelRow } from "@/features/profile/components/ProfilePanels";
import { HEADER_HEIGHT, ScrollHeader } from "@/features/profile/components/ScrollHeader";
import { SegmentedTabs } from "@/features/profile/components/SegmentedTabs";
import { PressScale } from "@/components/ui/PressScale";
import {
  achievements,
  gameHistory,
  gameRecords,
  together,
  type Block,
} from "@/constants/profileRecord";
import {
  bg,
  icon as iconSize,
  layout,
  motion,
  space,
  text,
  type,
} from "@/constants/design";

type ViewKey = "training" | "games" | "milestones";

const VIEWS: readonly { key: ViewKey; label: string }[] = [
  { key: "training", label: "Training" },
  { key: "games", label: "Games" },
  { key: "milestones", label: "Milestones" },
];

const VIEW_ORDER: readonly ViewKey[] = ["training", "games", "milestones"];

const TRAINING_BLOCKS: readonly Block[] = [
  {
    kind: "meters",
    title: "By category",
    note: "Skills marked strong, out of the skills Bori has started.",
    rows: [
      { label: "Communication", strong: 2, total: 2 },
      { label: "Calmness", strong: 1, total: 3 },
      { label: "Leash skills", strong: 1, total: 2 },
      { label: "Social skills", strong: 1, total: 2 },
      { label: "Real-world skills", strong: 1, total: 2 },
      { label: "Handling", strong: 0, total: 1 },
    ],
  },
  {
    kind: "facts",
    title: "Totals",
    rows: [
      ["Skills learned", "9"],
      ["Strong", "6"],
      ["Still practising", "3"],
      ["Current focus", "Calm manners"],
    ],
  },
  { kind: "link", label: "Open training", hint: "Lessons and this week's plan", href: "/train" },
];

const GAMES_BLOCKS: readonly Block[] = [
  { kind: "entries", title: "Personal records", rows: gameRecords },
  { kind: "entries", title: "History", rows: gameHistory },
  { kind: "link", label: "Open games", hint: "Challenges, duels and tournaments", href: "/game" },
];

const MILESTONE_BLOCKS: readonly Block[] = [
  { kind: "entries", title: "Recent", rows: achievements },
];

export default function ProfileProgressScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const [view, setView] = useState<ViewKey>("training");

  const previous = useRef(0);
  const index = VIEW_ORDER.indexOf(view);
  const direction = index >= previous.current ? 1 : -1;
  previous.current = index;
  const panelEnter = reduceMotion
    ? undefined
    : FadeIn.duration(motion.duration.select).withInitialValues({
        opacity: 0,
        transform: [{ translateX: direction * 24 }],
      });

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const blocks =
    view === "training" ? TRAINING_BLOCKS : view === "games" ? GAMES_BLOCKS : MILESTONE_BLOCKS;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: insets.bottom + space.block },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
          <Text style={styles.title}>Together</Text>
          <Text style={styles.lede}>
            Twelve days running, nine skills, and everything the two of you have done in PAWS.
          </Text>
        </Animated.View>

        <Panel
          lead={`Bond level ${together.bondLevel}`}
          title={`${together.streakDays} days running.`}
          style={styles.summary}
        >
          <PanelRow
            label="Next level"
            steps={{ filled: Math.round((together.bondXpInLevel / together.bondXpPerLevel) * 5), total: 5 }}
            value={`${together.bondXpPerLevel - together.bondXpInLevel} XP`}
          />
          <PanelRow label="Day streak" value={`${together.streakDays} days`} order={1} />
          <PanelRow label="Best ever" value={`${together.bestStreakDays} days`} order={2} />
          <PanelRow label="Paw points" value={together.pawPoints.toLocaleString()} order={3} />
        </Panel>

        <View style={styles.switch}>
          <SegmentedTabs options={VIEWS} value={view} onChange={setView} />
        </View>

        <Animated.View style={styles.panel} layout={settle}>
          <Animated.View key={view} entering={panelEnter}>
            <BlockList blocks={blocks} />
          </Animated.View>
        </Animated.View>
      </Animated.ScrollView>

      <ScrollHeader
        scrollY={scrollY}
        title="Together"
        appearAt={insets.top + 96}
        insetTop={insets.top}
        left={
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.glyphButton}
            onPress={() => router.back()}
          >
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },
  title: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },

  summary: { marginTop: space.xl },

  switch: { marginTop: space.section },
  panel: { minHeight: 320, marginTop: space.sm },

  glyphButton: {
    width: iconSize.nav,
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
