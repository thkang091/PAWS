import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedRef,
  useReducedMotion,
  useScrollViewOffset,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon } from "phosphor-react-native";

import { BlockList } from "@/features/profile/components/blocks";
import { MedicalRecord } from "@/features/profile/components/MedicalRecord";
import { ProfileSetScreen } from "@/features/profile/components/ProfileSetScreen";
import { EditFieldSheet, type EditTarget } from "@/features/profile/components/EditFieldSheet";
import { HEADER_HEIGHT, ScrollHeader } from "@/features/profile/components/ScrollHeader";
import { PressScale } from "@/components/ui/PressScale";
import {
  bg,
  icon as iconSize,
  layout,
  motion,
  space,
  text,
  type,
} from "@/constants/design";
import { optionsFor, type Block } from "@/constants/profileRecord";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { useProfileData } from "@/features/profile/state/useProfileData";

export default function ProfileSectionRoute() {
  const { section: key } = useLocalSearchParams<{ section: string }>();
  // The medical record has its own screen built on real data; other sections still render from the profile record.
  if (key === "health") return <MedicalRecord />;
  // The question sets each have their own screen; the old social questions live in Personality now.
  if (key === "social") return <ProfileSetScreen setKey="personality" />;
  if (key === "basics" || key === "safety" || key === "home" || key === "baseline" || key === "personality") return <ProfileSetScreen setKey={key} />;
  return <ProfileSectionScreen />;
}

function ProfileSectionScreen() {
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const draft = useProfileDraft();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<EditTarget>(null);

  const profile = useProfileData();
  const section = key ? profile.findSection(key) : undefined;
  const blocks: readonly Block[] = section?.blocks ?? [];

  if (!section) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top + HEADER_HEIGHT }]}>
        <Text style={styles.lede}>{`That part of ${profile.name}'s profile does not exist.`}</Text>
      </View>
    );
  }

  const editableLabels = section.blocks
    .filter((block): block is Extract<Block, { kind: "facts" }> => block.kind === "facts")
    .flatMap((block) => block.rows.map(([label]) => label).filter((label) => !block.locked?.includes(label)));

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
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        >
          <Text style={styles.title}>{section.title}</Text>
          <Text style={styles.lede}>{section.lede}</Text>
        </Animated.View>

        <Animated.View
          style={styles.blocks}
          entering={
            reduceMotion
              ? undefined
              : FadeIn.duration(motion.duration.enter).delay(motion.stagger)
          }
        >
          <BlockList
            blocks={blocks}
            editing={editing}
            onEditField={(label, value) => setTarget({ label, value, options: optionsFor(section.key, label) })}
          />
        </Animated.View>
      </Animated.ScrollView>

      <ScrollHeader
        scrollY={scrollY}
        title={section.title}
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
        right={
          editableLabels.length > 0 ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={editing ? "Finish editing" : "Edit this section"}
              hitSlop={12}
              style={styles.editButton}
              onPress={() => setEditing((value) => !value)}
            >
              <Text style={styles.editLabel}>{editing ? "Done" : "Edit"}</Text>
            </PressScale>
          ) : null
        }
      />

      <EditFieldSheet
        target={target}
        onCancel={() => setTarget(null)}
        onSave={(value) => {
          if (target) draft.setField(section.key, target.label, value);
          setTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },
  missing: { paddingHorizontal: layout.gutter },
  title: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },
  blocks: { marginTop: space.section },
  glyphButton: {
    width: iconSize.nav,
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: { height: HEADER_HEIGHT, alignItems: "center", justifyContent: "center" },
  editLabel: { ...type.supporting, fontWeight: "500", color: text.primary },
});
