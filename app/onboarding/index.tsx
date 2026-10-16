import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";

import { AgeCard } from "@/features/onboarding/components/AgeCard";
import { FieldLabel } from "@/features/onboarding/components/FieldLabel";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { HeartDoodle } from "@/features/onboarding/components/HeartDoodle";
import { NameInline } from "@/features/onboarding/components/NameInline";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { QuestionBlock } from "@/features/onboarding/components/QuestionBlock";
import {
  QuestionHeadline,
  type QuestionPart,
} from "@/features/onboarding/components/QuestionHeadline";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { bg, border, layout, motion, radius, space, text, type } from "@/constants/design";
import { ALL_BREEDS, ageBucketOptions, energyChoices, exactAgeOptions, quickBreeds } from "@/constants/onboardingOptions";
import { MagnifyingGlassIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { useOnboardingDraft } from "@/providers/OnboardingDraftProvider";

const SCROLL_HEADROOM = 96;

export default function OnboardingIdentityScreen() {
  const { draft, update } = useOnboardingDraft();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const carried = useRef<Record<string, boolean>>({});

  const trimmedName = draft.name.trim();
  const displayName = trimmedName || "your dog";

  const askAge = trimmedName.length > 0;
  const complete = askAge && draft.ageBucket !== null;
  const reduceMotion = useReducedMotion();
  // "Search breeds" opens a field that finds any breed; one not in the list is kept as typed.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const isQuick = (b: string) => (quickBreeds as readonly string[]).includes(b);
  const matches = query.trim().length
    ? ALL_BREEDS.filter((b) => b.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  const fraction = Math.max(0.12, ((trimmedName ? 1 : 0) + (draft.ageBucket ? 1 : 0)) / 2);

  const carryTo = (key: string) => {
    if (carried.current[key]) return;
    carried.current[key] = true;
    setTimeout(() => {
      const y = positions.current[key];
      if (y === undefined) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_HEADROOM), animated: true });
    }, 90);
  };

  useEffect(() => {
    if (askAge) carryTo("age");
  }, [askAge]);

  // Picking an age brings its closer-age choices into view; the rest waits below, never scrolled past.
  useEffect(() => {
    if (draft.ageBucket && draft.ageBucket !== "unsure") {
      carried.current.exact = false;
      carryTo("exact");
    }
  }, [draft.ageBucket]);

  const nameParts: QuestionPart[] = useMemo(
    () => [
      { kind: "text", value: "Let's get to" },
      { kind: "text", value: "know" },
      {
        kind: "slot",
        suffix: ".",
        render: () => (
          <NameInline
            value={draft.name}
            onChangeText={(name) => update({ name })}
            onSubmit={() => Keyboard.dismiss()}
            autoFocus
          />
        ),
      },
    ],
    [draft.name],
  );

  return (
    <OnboardingScreen
      stage={1}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
      fraction={fraction}
      scrollRef={scrollRef}
      ctaLabel="Continue"
      ctaDisabled={!complete}
      onContinue={() => {
        Keyboard.dismiss();
        router.push("/onboarding/goals");
      }}
    >
      <View style={styles.opening}>
        <QuestionHeadline parts={nameParts} trailing={<HeartDoodle />} />
        <Text style={styles.supporting}>A few quick things, then we'll build the plan.</Text>
      </View>

      {askAge ? (
        <QuestionBlock
          style={styles.block}
          onMeasure={(y) => (positions.current.age = y)}
        >
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "How old is" },
              { kind: "accent", value: displayName, suffix: "?" },
            ]}
          />
          <Text style={styles.supporting}>A rough answer is fine.</Text>

          <View style={styles.ageRow}>
            {ageBucketOptions.map((option, index) => (
              <Reveal key={option.value} index={index} offset={120} style={styles.ageSlot}>
                <AgeCard
                  option={option}
                  selected={draft.ageBucket === option.value}
                  onSelect={() => {
                    Keyboard.dismiss();
                    update({ ageBucket: option.value, ageExact: null });
                  }}
                />
              </Reveal>
            ))}
          </View>

          {draft.ageBucket && draft.ageBucket !== "unsure" ? (
            <Animated.View
              key={draft.ageBucket}
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
              style={styles.exact}
              onLayout={(e) => (positions.current.exact = (positions.current.age ?? 0) + e.nativeEvent.layout.y - 140)}
            >
              <FieldLabel>{draft.ageBucket === "puppy" ? "How many months, if you know" : "How many years, if you know"}</FieldLabel>
              <View style={styles.chips}>
                {exactAgeOptions[draft.ageBucket].map((choice) => (
                  <Chip
                    key={choice.label}
                    label={choice.label}
                    selected={draft.ageExact === choice.years}
                    onPress={() => update({ ageExact: draft.ageExact === choice.years ? null : choice.years })}
                  />
                ))}
              </View>
            </Animated.View>
          ) : null}
        </QuestionBlock>
      ) : null}

      {complete ? (
        <QuestionBlock style={styles.block} onMeasure={(y) => (positions.current.more = y)}>
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "A bit more about" },
              { kind: "accent", value: displayName, suffix: "." },
            ]}
          />
          <Text style={styles.supporting}>All optional. Skip what you are unsure of.</Text>

          <View style={styles.row}>
            <FieldLabel>Boy or girl</FieldLabel>
            <View style={styles.chips}>
              <Chip label="Boy" selected={draft.gender === "male"} onPress={() => update({ gender: draft.gender === "male" ? null : "male" })} />
              <Chip label="Girl" selected={draft.gender === "female"} onPress={() => update({ gender: draft.gender === "female" ? null : "female" })} />
            </View>
          </View>

          <View style={styles.row}>
            <FieldLabel>Breed</FieldLabel>
            <View style={styles.chips}>
              {/* A breed found by search sits first, selected, so the choice is always visible. */}
              {draft.breed && !isQuick(draft.breed) ? <Chip label={draft.breed} selected onPress={() => update({ breed: "" })} /> : null}
              {quickBreeds.map((breed) => (
                <Chip
                  key={breed}
                  label={breed}
                  selected={draft.breed === breed}
                  onPress={() => {
                    Keyboard.dismiss();
                    update({ breed: draft.breed === breed ? "" : breed });
                  }}
                />
              ))}
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Search breeds"
                scaleTo={0.95}
                style={[styles.searchChip, searching && styles.searchChipOn]}
                onPress={() => setSearching((on) => !on)}
              >
                <MagnifyingGlassIcon size={14} color={text.primary} weight="bold" />
                <Text style={styles.searchChipText}>More breeds</Text>
              </PressScale>
            </View>
            {searching ? (
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}>
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search, for example Shiba or Corgi"
                  placeholderTextColor={text.tertiary}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (query.trim().length >= 2) update({ breed: matches[0] ?? query.trim() });
                    setSearching(false);
                    setQuery("");
                  }}
                  accessibilityLabel="Search breeds"
                />
                {query.trim().length >= 2 ? (
                  <View style={[styles.chips, styles.results]}>
                    {matches.map((b) => (
                      <Chip
                        key={b}
                        label={b}
                        selected={draft.breed === b}
                        onPress={() => {
                          Keyboard.dismiss();
                          update({ breed: b });
                          setSearching(false);
                          setQuery("");
                        }}
                      />
                    ))}
                    {!matches.some((b) => b.toLowerCase() === query.trim().toLowerCase()) ? (
                      <Chip
                        label={`Use "${query.trim()}"`}
                        selected={false}
                        onPress={() => {
                          Keyboard.dismiss();
                          update({ breed: query.trim() });
                          setSearching(false);
                          setQuery("");
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.row}>
            <FieldLabel>Energy on a normal day</FieldLabel>
            <View style={styles.chips}>
              {energyChoices.map((choice) => (
                <Chip
                  key={choice.label}
                  label={choice.label}
                  selected={draft.energy === choice.label}
                  onPress={() => update({ energy: draft.energy === choice.label ? null : choice.label })}
                />
              ))}
            </View>
          </View>
        </QuestionBlock>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  opening: {
    marginTop: space.section,
  },
  block: {
    marginTop: space.block,
  },
  supporting: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 300,
  },
  togetherHead: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  togetherCopy: {
    flex: 1,
    paddingRight: space.sm,
  },
  mascot: {
    marginRight: -layout.gutter,
  },
  ageRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxl,
  },
  ageSlot: {
    flex: 1,
  },
  searchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: border.default,
  },
  searchChipOn: { borderStyle: "solid", borderColor: text.primary },
  searchChipText: { ...type.supporting, fontSize: 15, fontWeight: "600", color: text.primary },
  results: { marginTop: space.md },
  exact: {
    marginTop: space.xl,
  },
  row: {
    marginTop: space.xxl,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  input: {
    height: 52,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    ...type.body,
    color: text.primary,
  },
  choiceStack: {
    gap: space.md,
    marginTop: space.xxl,
  },
});
