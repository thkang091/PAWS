import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LockSimpleIcon } from "phosphor-react-native";
import { ModeIllustration } from "@/features/game/components/ModeIllustration";
import { bg, pastel, radius, space, text, type } from "@/constants/design";
import { GameButton, GameHeading, GameScreen } from "./GameFlowUI";

export function TournamentLockedScreen() {
  const back = () => router.replace("/(tabs)/game");
  return <GameScreen label="Tournament" centered onBack={back}
    footer={<GameButton label="Back to games" onPress={back} />}>
    <View style={styles.panel}>
      <View style={styles.art}><ModeIllustration mode="tournament" width={200} /></View>
      <View style={styles.badge}><LockSimpleIcon size={18} color={text.secondary} weight="bold" /><Text style={styles.badgeText}>Coming soon</Text></View>
    </View>
    <GameHeading title="Tournament is locked" description="Group play is coming later. You can play Solo or Duel for now." />
  </GameScreen>;
}

const styles = StyleSheet.create({
  panel: { alignItems: "center", padding: space.xxl, gap: space.lg, backgroundColor: pastel.mist, borderRadius: 26 },
  art: { opacity: 0.4 },
  badge: { flexDirection: "row", gap: space.sm, alignItems: "center", paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: bg.canvas, borderRadius: radius.pill },
  badgeText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
