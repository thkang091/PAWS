import { StyleSheet, Text, View } from "react-native";

import { MascotStage } from "@/components/mascot/MascotStage";
import { AccentHeadline, type HeadlineWord } from "@/features/onboarding/components/AccentHeadline";
import { HeartDoodle } from "@/features/onboarding/components/HeartDoodle";
import { layout, space, text, type } from "@/constants/design";
import { ageBucketOptions } from "@/constants/onboardingOptions";
import { useOnboardingDraft } from "@/providers/OnboardingDraftProvider";

const MASCOT_WIDTH = 168;

type OnboardingHeroProps = {
  words: HeadlineWord[];
  supporting: string;
  doodle?: boolean;
};

export const OnboardingHero = ({ words, supporting, doodle = false }: OnboardingHeroProps) => {
  const { draft } = useOnboardingDraft();
  const pose = draft.ageBucket
    ? (ageBucketOptions.find((option) => option.value === draft.ageBucket)?.pose ?? null)
    : null;

  return (
  <View>
    <View style={styles.row}>
      <View style={styles.copyColumn}>
        <AccentHeadline words={words} trailing={doodle ? <HeartDoodle /> : undefined} />
      </View>

      <View style={styles.mascot}>
        <MascotStage pose={pose} curious={draft.ageBucket === "unsure"} />
      </View>
    </View>

    <Text style={styles.supporting}>{supporting}</Text>
  </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  copyColumn: {
    flex: 1,
    paddingRight: space.sm,
  },
  mascot: {
    width: MASCOT_WIDTH,
    marginRight: -layout.gutter,
  },
  supporting: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 300,
  },
});
