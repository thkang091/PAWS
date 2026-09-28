import type { ReactNode, RefObject } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingHeader } from "@/features/onboarding/components/OnboardingHeader";
import { PrimaryCta } from "@/features/onboarding/components/PrimaryCta";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { bg, layout, space, text, type } from "@/constants/design";

type OnboardingScreenProps = {
  stage: number;
  onBack: () => void;
  canGoBack?: boolean;
  fraction?: number;
  scrollRef?: RefObject<ScrollView | null>;
  ctaLabel?: string;
  onContinue?: () => void;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  ctaFootnote?: string;
  children: ReactNode;
};

export const OnboardingScreen = ({
  stage,
  onBack,
  canGoBack,
  fraction,
  scrollRef,
  ctaLabel,
  onContinue,
  ctaDisabled,
  ctaLoading,
  ctaFootnote,
  children,
}: OnboardingScreenProps) => (
  <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0}>
          <OnboardingHeader
            stage={stage}
            onBack={onBack}
            canGoBack={canGoBack}
            fraction={fraction}
          />
        </Reveal>

        {children}

        <View style={styles.spacer} />

        {ctaLabel && onContinue ? (
          <View style={styles.cta}>
            <PrimaryCta
              label={ctaLabel}
              onPress={onContinue}
              disabled={ctaDisabled}
              loading={ctaLoading}
            />
            {ctaFootnote ? <Text style={styles.footnote}>{ctaFootnote}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

export const OnboardingSection = ({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) => (
  <Reveal index={index} style={styles.section}>
    {children}
  </Reveal>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bg.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    paddingBottom: space.section,
  },
  section: {
    marginTop: space.section,
  },
  spacer: {
    flexGrow: 1,
    minHeight: space.sectionLg,
  },
  cta: {
    marginTop: space.xxl,
  },
  footnote: {
    ...type.caption,
    color: text.tertiary,
    textAlign: "center",
    marginTop: space.md,
  },
});
