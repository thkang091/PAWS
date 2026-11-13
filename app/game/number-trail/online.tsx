import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CheckIcon, GlobeHemisphereWestIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { ntStore } from "@/features/numberTrail/localStore";
import { numberEntry } from "@/features/numberTrail/practiceFlow";
import { numberErrorText } from "@/features/numberTrail/raceCopy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { createOnlineNumberRace, type DistanceCategory } from "@/services/numberRaceService";
import { DISTANCE_CATEGORIES } from "../../../supabase/functions/tournament/numberEquivalence";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const CATEGORIES = Object.entries(DISTANCE_CATEGORIES) as [DistanceCategory, (typeof DISTANCE_CATEGORIES)[DistanceCategory]][];

/**
 * Online: one number for everyone. Without a number, players first check which numbers their own streets can draw and
 * the host picks one they all can; from "Race it" on a route, the number (and that route, to share) comes with it.
 */
export default function OnlineCreateScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ number?: string; routeId?: string }>();
  const dog = useCurrentDog();
  const entry = numberEntry(params.number ?? "");
  const fixed = entry.ok ? entry.number : null;
  const [category, setCategory] = useState<DistanceCategory>("standard");
  const [ranked, setRanked] = useState(true);
  const [safe, setSafe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocker = !safe ? "Tick the safety promise first" : undefined;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await createOnlineNumberRace({
        name: fixed ? `${dog.data?.name ?? "Our"}'s ${fixed}` : `${dog.data?.name ?? "Our"}'s Number Trail`,
        maxPlayers: 10,
        countdownS: 10,
        safetyAck: safe,
        dogId: dog.data?.id ?? null,
        displayName: dog.data?.name ?? "Player",
        number: fixed,
        category,
        ranked,
      });
      if (fixed && params.routeId) await ntStore.setSharedRoute(r.matchId, params.routeId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/game/number-trail/room/[id]", params: { id: r.roomId, invite: "1" } });
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => goBack("/game/tournament")}>
            <CaretLeftIcon size={22} color={text.primary} weight="bold" />
          </PressScale>
          <View style={styles.tag}>
            <GlobeHemisphereWestIcon size={14} color={text.primary} weight="bold" />
            <Text style={styles.tagText}>ONLINE</Text>
          </View>
          <View style={styles.round} />
        </View>
        <View style={styles.body}>
          {fixed ? <NumberGlyph value={fixed} height={Math.min(110, Math.max(72, height * 0.11))} stroke={0.3} /> : null}
          <Text style={styles.title}>{fixed ? `Race ${fixed}` : "Race a number together"}</Text>
          <Text style={styles.sub}>{fixed ? "Friends nearby can race your route. Friends elsewhere race the same number on their own streets." : "Everyone checks which numbers their streets can draw. You pick one you all can."}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>DISTANCE</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(([key, c]) => (
              <PressScale key={key} accessibilityRole="radio" accessibilityState={{ selected: category === key }} accessibilityLabel={`${c.label}, ${c.targetM / 1000} kilometres, about ${c.minutes} minutes`} style={[styles.chip, category === key && styles.chipOn]} onPress={() => setCategory(key)}>
                <Text style={styles.chipBig}>{`${c.targetM / 1000} km`}</Text>
                <Text style={styles.chipSub}>{`${c.label} · ${c.minutes} min`}</Text>
              </PressScale>
            ))}
          </View>

          <Text style={styles.label}>RACE</Text>
          <View style={styles.chips}>
            <PressScale accessibilityRole="radio" accessibilityState={{ selected: ranked }} style={[styles.chip, ranked && styles.chipOn]} onPress={() => setRanked(true)}>
              <Text style={styles.chipBig}>Ranked</Text>
              <Text style={styles.chipSub}>Only on matched routes</Text>
            </PressScale>
            <PressScale accessibilityRole="radio" accessibilityState={{ selected: !ranked }} style={[styles.chip, !ranked && styles.chipOn]} onPress={() => setRanked(false)}>
              <Text style={styles.chipBig}>Friendly</Text>
              <Text style={styles.chipSub}>Same length, shapes may differ</Text>
            </PressScale>
          </View>
          <Text style={styles.fine}>Every course is the same length within 2%, measured by PAWS. The walk to your start isn't timed.</Text>

          <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: safe }} style={styles.safety} onPress={() => setSafe((v) => !v)}>
            <View style={[styles.box, safe && styles.boxOn]}>{safe ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}</View>
            <Text style={styles.safetyText}>We'll walk at our dogs' pace, stay on public paths, cross only where it's safe, and keep dogs on a lead near roads.</Text>
          </PressScale>
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </View>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Create online race" sub={blocker} disabled={Boolean(blocker)} busy={busy} onPress={() => void create()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter },
  round: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: accent.soft },
  tagText: { ...type.eyebrow, color: text.primary },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.lg },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.8, color: text.primary },
  sub: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: text.secondary, marginTop: 2 },
  label: { ...type.eyebrow, color: text.tertiary, marginTop: space.md, marginBottom: space.sm },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: 16, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipBig: { fontSize: 16, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  chipSub: { fontSize: 11, fontWeight: "600", color: text.secondary, marginTop: 2, textAlign: "center" },
  fine: { ...type.caption, color: text.secondary, marginTop: space.md },
  safety: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: accent.deep, borderColor: accent.band },
  safetyText: { ...type.supporting, color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
