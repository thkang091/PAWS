import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckIcon, HouseIcon, MapPinIcon, NavigationArrowIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import type { SavedPlace } from "@/features/care/state/careLocations";
import { currentPlace, resolvePlace, type PlaceResult } from "@/services/placeSearch";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

type Status = "idle" | "looking" | PlaceResult["state"];

const NOTE: Partial<Record<Status, string>> = {
  looking: "Finding it",
  notFound: "No match for that. Try a street and city, or a ZIP code.",
  denied: "Location is off for PAWS. Type an address instead.",
  offline: "Could not look that up. Check the connection and try again.",
};

export const PlaceField = ({
  value,
  home,
  onResolve,
  autoFocus = false,
}: {
  value: SavedPlace | null;
  home: SavedPlace | null;
  onResolve: (place: SavedPlace) => void;
  autoFocus?: boolean;
}) => {
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState(value?.query ?? "");
  const [status, setStatus] = useState<Status>(value ? "found" : "idle");
  const request = useRef(0);

  useEffect(() => {
    if (value && value.query !== draft) {
      setDraft(value.query);
      setStatus("found");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.query]);

  const settle = (result: PlaceResult, ticket: number) => {
    if (ticket !== request.current) return;
    setStatus(result.state);
    if (result.state === "found") {
      void Haptics.selectionAsync();
      setDraft(result.place.query);
      onResolve(result.place);
    }
  };

  const look = (raw: string) => {
    const ticket = ++request.current;
    setStatus("looking");
    void resolvePlace(raw).then((result) => settle(result, ticket));
  };

  useEffect(() => {
    const raw = draft.trim();
    if (raw.length < 5 || raw === value?.query) return;
    const timer = setTimeout(() => look(raw), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const useHere = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ticket = ++request.current;
    setStatus("looking");
    void currentPlace().then((result) => settle(result, ticket));
  };

  const found = status === "found" && value;
  const showHome = home && home.query !== value?.query;

  return (
    <View>
      <View style={[styles.field, found && styles.fieldFound]}>
        <MapPinIcon size={iconSize.standard} color={found ? text.primary : text.tertiary} weight={found ? "fill" : "regular"} />
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(next) => {
            setDraft(next);
            if (status !== "idle") setStatus("idle");
          }}
          onSubmitEditing={() => look(draft)}
          placeholder="Address or ZIP code"
          placeholderTextColor={text.tertiary}
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          accessibilityLabel="Address or ZIP code"
        />
        {status === "looking" ? <ActivityIndicator size="small" color={text.secondary} /> : null}
      </View>

      <View style={styles.meta}>
        {found ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
            style={styles.resolved}
          >
            <CheckIcon size={iconSize.inline} color={text.primary} weight="bold" />
            <Text style={styles.resolvedText} numberOfLines={1}>
              {value.label === draft ? "Saved for next time" : value.label}
            </Text>
          </Animated.View>
        ) : NOTE[status] ? (
          <Text style={styles.note}>{NOTE[status]}</Text>
        ) : null}
      </View>

      <View style={styles.shortcuts}>
        {showHome ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Use saved address, ${home.label}`}
            scaleTo={0.96}
            style={styles.shortcut}
            onPress={() => {
              void Haptics.selectionAsync();
              request.current += 1;
              setStatus("found");
              setDraft(home.query);
              onResolve(home);
            }}
          >
            <HouseIcon size={iconSize.inline} color={text.primary} weight="regular" />
            <Text style={styles.shortcutText} numberOfLines={1}>
              {home.label}
            </Text>
          </PressScale>
        ) : null}
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          scaleTo={0.96}
          style={styles.shortcut}
          onPress={useHere}
        >
          <NavigationArrowIcon size={iconSize.inline} color={text.primary} weight="regular" />
          <Text style={styles.shortcutText}>Current location</Text>
        </PressScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    height: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
  },
  fieldFound: { borderColor: accent.deep, backgroundColor: bg.canvas },
  input: { flex: 1, ...type.body, color: text.primary, paddingVertical: 0 },
  meta: { minHeight: 22, marginTop: space.sm, justifyContent: "center" },
  resolved: { flexDirection: "row", alignItems: "center", gap: 6 },
  resolvedText: { ...type.caption, fontWeight: "600", color: text.primary, flexShrink: 1 },
  note: { ...type.caption, color: text.tertiary },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: accent.soft,
  },
  shortcutText: { ...type.caption, fontWeight: "600", color: text.primary, flexShrink: 1 },
});
