import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CaretLeftIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { PlayStart } from "@/features/rooms/components/PlayStart";
import { useTournamentOverview } from "@/hooks/useTournaments";
import type { PlayMode } from "@/services/roomService";
import { accent, bg, icon as iconSize, layout, motion, radius, space, text } from "@/constants/design";

const MODE_KEY = "paws.tournament.mode";

/**
 * Tournament: online or nearby, then make a room or join one. Swipe right for that mode's games. The last mode you
 * used is remembered on this phone; a link can ask for one (?mode=nearby).
 */
export default function TournamentHubScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ mode?: string }>();
  const asked = params.mode === "nearby" || params.mode === "online" ? (params.mode as PlayMode) : null;
  const [mode, setMode] = useState<PlayMode>(asked ?? "online");
  const overview = useTournamentOverview();
  const active = overview.data?.activeCount ?? 0;

  useEffect(() => {
    if (asked) return;
    AsyncStorage.getItem(MODE_KEY)
      .then((m) => (m === "nearby" || m === "online" ? setMode(m) : undefined))
      .catch(() => undefined);
  }, [asked]);
  const choose = (m: PlayMode) => {
    setMode(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.head, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.topRow}>
          <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack("/(tabs)/game")}>
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
          {active > 0 ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.live} accessibilityLabel={`You're in ${active} live ${active === 1 ? "tournament" : "tournaments"}`}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{`${active} live`}</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Tournament
        </Text>
      </View>
      <PlayStart mode={mode} onMode={choose} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  head: { paddingHorizontal: layout.gutter },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: "#E8E7E2", alignItems: "center", justifyContent: "center" },
  live: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.soft },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2F8F4E" },
  liveText: { fontSize: 13, fontWeight: "800", color: text.primary },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "800", letterSpacing: -1.2, color: text.primary, marginTop: space.lg },
});
