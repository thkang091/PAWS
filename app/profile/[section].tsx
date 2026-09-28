import { useMemo, useState } from "react";
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
import { findSection, type Block } from "@/constants/profileRecord";
import { useProfileDraft } from "@/features/profile/state/profileDraft";

export default function ProfileSectionScreen() {
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const draft = useProfileDraft();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<EditTarget>(null);

  const section = key ? findSection(key) : undefined;

  const blocks = useMemo<readonly Block[]>(() => {
    if (!section) return [];
    return section.blocks.map((block) =>
      block.kind === "facts"
        ? {
            ...block,
            rows: block.rows.map(
              ([label, value]) => [label, draft.resolve(section.key, label, value)] as const,
            ),
          }
        : block,
    );
  }, [draft, section]);

  if (!section) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top + HEADER_HEIGHT }]}>
        <Text style={styles.lede}>That part of Bori&rsquo;s record does not exist.</Text>
      </View>
    );
  }

  const editableLabels = section.blocks
    .filter((block): block is Extract<Block, { kind: "facts" }> => block.kind === "facts")
    .flatMap((block) => block.rows.map(([label]) => label));

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
            onEditField={(label, value) => setTarget({ label, value })}
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
