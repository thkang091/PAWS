import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  LinearTransition,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollViewOffset,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BellIcon,
  PencilSimpleIcon,
} from "phosphor-react-native";

import {
  FocusHero,
  IdentityPanel,
  Panel,
  PanelRow,
  TemperamentHero,
  glyphFor,
} from "@/features/profile/components/ProfilePanels";
import { ProfileDog } from "@/features/profile/components/ProfileDog";
import { HEADER_HEIGHT, ScrollHeader } from "@/features/profile/components/ScrollHeader";
import { SegmentedTabs } from "@/features/profile/components/SegmentedTabs";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import {
  bg,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
} from "@/constants/design";
import { PROFILE_TABS, bori, findSection, together } from "@/constants/profileRecord";

const formatAge = (birthday: string | null, ageYears: number | null): string => {
  if (birthday) {
    const then = new Date(birthday);
    const now = new Date();
    let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
    if (now.getDate() < then.getDate()) months -= 1;
    const years = Math.floor(Math.max(0, months) / 12);
    const remainder = Math.max(0, months) % 12;
    if (years === 0) return `${remainder}m`;
    return remainder === 0 ? `${years}y` : `${years}y ${remainder}m`;
  }
  if (ageYears !== null) return `${ageYears}y`;
  return "Not set";
};

const TAB_CLEARANCE = 116;
const STAGE_BELOW_INSET = 224;
const SHEET_OVERLAP = 28;

const TAB_KEYS = PROFILE_TABS.map((tab) => tab.key);

const DOOR_FOR_FACT: Record<string, string> = { records: "records", vaccines: "health" };

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const weightLogs = useWeightLogs(dogId);
  const dashboard = useProfileDashboard(dogId);

  const dogName = dog.data?.name ?? bori.name;
  const named = (value: string) => value.replace(/Bori/g, dogName);
  const dogBreed = dog.data?.breed ?? bori.breed;
  const dogTag = dog.data?.dogTag ?? bori.dogTag;
  const ageLabel = dog.data ? formatAge(dog.data.birthday, dog.data.ageYears) : bori.age;
  const latestWeight = weightLogs.data?.[0];
  const weightLabel = latestWeight ? `${latestWeight.weightValue}` : "Not set";
  const weightUnit = latestWeight?.weightUnit;

  const bondXpPerLevel = 100;
  const bondLevel = dashboard.data?.level ?? together.bondLevel;
  const bondXpInLevel = dashboard.data ? dashboard.data.bondXp % bondXpPerLevel : together.bondXpInLevel;

  const [tabKey, setTabKey] = useState(TAB_KEYS[0]);
  const tab = PROFILE_TABS.find((item) => item.key === tabKey) ?? PROFILE_TABS[0];
  const panel = tab.panel;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      arrival.value = 1;
      return;
    }
    arrival.value = withDelay(80, withSpring(1, motion.spring));
  }, [arrival, reduceMotion]);

  const stageHeight = insets.top + STAGE_BELOW_INSET;
  const dogWidth = Math.min(width * 0.56, 236);

  const dogStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const y = scrollY.value;
    const stretch = interpolate(y, [-160, 0], [1.16, 1], {
      extrapolateLeft: Extrapolation.CLAMP,
      extrapolateRight: Extrapolation.CLAMP,
    });
    return {
      transform: [
        { translateY: (y > 0 ? y * 0.4 : y * 0.12) + (1 - arrival.value) * 16 },
        { scale: stretch * (0.965 + arrival.value * 0.035) },
      ],
      opacity: arrival.value,
    };
  });

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

  const previous = useRef(0);
  const index = TAB_KEYS.indexOf(tabKey);
  const direction = index >= previous.current ? 1 : -1;
  previous.current = index;
  const panelEnter = reduceMotion
    ? undefined
    : FadeIn.duration(motion.duration.select).withInitialValues({
        opacity: 0,
        transform: [{ translateX: direction * 24 }],
      });

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(motion.duration.enter).delay(order * motion.stagger);

  return (
    <View style={styles.screen}>
      <View style={[styles.stageBackdrop, { height: stageHeight + 600 }]} />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + insets.bottom }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <View style={[styles.stage, { height: stageHeight }]}>
          <Animated.View style={dogStyle}>
            <ProfileDog width={dogWidth} />
          </Animated.View>
        </View>

        <View style={styles.sheet}>
          <Animated.View entering={enter(0)}>
            <IdentityPanel
              name={dogName}
              breed={dogBreed?.trim() ? dogBreed : "Meet"}
              tag={dogTag}
              onPressBond={() => router.push("/profile/progress")}
              rows={[
                { key: "age", label: "Age", value: ageLabel },
                {
                  key: "weight",
                  label: "Weight",
                  value: latestWeight ? `${weightLabel} ${weightUnit}` : "Not set",
                },
                {
                  key: "bond",
                  label: "Bond level",
                  value: String(bondLevel),
                  steps: { filled: Math.round((bondXpInLevel / bondXpPerLevel) * 5), total: 5 },
                },
              ]}
            />
          </Animated.View>

          <Animated.View entering={enter(2)} style={styles.switch}>
            <SegmentedTabs options={PROFILE_TABS} value={tabKey} onChange={setTabKey} />
          </Animated.View>

          <Animated.View style={styles.panel} layout={settle}>
            <Animated.View key={tabKey} entering={panelEnter}>
              {panel.traits ? (
                <TemperamentHero name={dogName} traits={panel.traits.rows} />
              ) : null}

              {panel.spotlight ? (
                <FocusHero
                  lead={panel.spotlight.chip}
                  title={panel.spotlight.title}
                  meta={panel.spotlight.meta}
                  progress={panel.spotlight.progress}
                  progressNote={panel.spotlight.progressNote}
                  onPress={() => router.push(panel.spotlight!.href as never)}
                />
              ) : null}

              {panel.band ? (
                <Panel lead={`${dogName}'s`} title="essentials." size="section" tone="card">
                  {panel.band.map((figure, index) => (
                    <PanelRow
                      key={figure.key}
                      label={figure.label}
                      value={figure.value}
                      order={index}
                      onPress={
                        DOOR_FOR_FACT[figure.key]
                          ? () => router.push(`/profile/${DOOR_FOR_FACT[figure.key]}` as never)
                          : undefined
                      }
                    />
                  ))}
                </Panel>
              ) : null}

              {panel.meters ? (
                <Panel
                  tone="butter"
                  lead={panel.meters.title}
                  title={`${panel.meters.rows.reduce((t, r) => t + r.strong, 0)} of ${panel.meters.rows.reduce((t, r) => t + r.total, 0)} strong.`}
                  size="section"
                >
                  {panel.meters.rows.map((row, index) => (
                    <PanelRow
                      key={row.key}
                      label={row.label}
                      steps={{ filled: row.strong, total: row.total }}
                      value={`${row.strong}/${row.total}`}
                      order={index}
                    />
                  ))}
                </Panel>
              ) : null}

              {panel.rail ? (
                <Panel
                  tone="card"
                  lead={panel.rail.title}
                  title={`${panel.rail.cards[0]?.chip ?? "On record"}.`}
                  size="section"
                  onPress={() => router.push(tab.headHref as never)}
                  label={`${panel.rail.title}. See all`}
                >
                  {panel.rail.cards.map((card, index) => (
                    <PanelRow key={card.key} label={card.title} sub={card.meta} value={card.chip} order={index} />
                  ))}
                </Panel>
              ) : null}

              <Panel lead="Explore" title={`${named(panel.tilesTitle)}.`} size="section" tone="butter">
                {tab.doors.flatMap((key) => {
                  const section = findSection(key);
                  return section
                    ? [
                        <PanelRow
                          key={key}
                          icon={glyphFor(key)}
                          label={named(section.title)}
                          sub={section.summary}
                          onPress={() => router.push(`/profile/${key}`)}
                        />,
                      ]
                    : [];
                })}
              </Panel>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={enter(3)} layout={settle} style={styles.account}>
            <Panel
              tone="card"
              lead="Account"
              title="Settings."
              size="section"
              meta="Notifications, account, privacy, sign out"
              onPress={() => router.push("/profile/settings")}
            />
          </Animated.View>
        </View>
      </Animated.ScrollView>

      <ScrollHeader
        scrollY={scrollY}
        title={dogName}
        appearAt={stageHeight - 70}
        insetTop={insets.top}
        left={
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={12}
            style={styles.glyphButton}
            onPress={() => router.push("/notifications-settings")}
          >
            <BellIcon size={iconSize.nav} color={text.primary} weight="regular" />
          </PressScale>
        }
        right={
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Edit ${named(tab.headTitle).toLowerCase()}`}
            hitSlop={12}
            style={styles.glyphButton}
            onPress={() => router.push(tab.headHref as never)}
          >
            <PencilSimpleIcon size={iconSize.nav} color={text.primary} weight="regular" />
          </PressScale>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },

  stageBackdrop: {
    position: "absolute",
    top: -600,
    left: 0,
    right: 0,
    backgroundColor: bg.stage,
  },
  stage: { alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },

  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: space.xxl,
    paddingHorizontal: layout.gutter,
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },



  switch: { marginTop: space.xxl },
  panel: { minHeight: 420 },

  account: { marginBottom: space.sm },

  glyphButton: {
    width: iconSize.nav,
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
