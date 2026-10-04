import { StyleSheet, Text } from "react-native";
import { PressScale } from "@/components/ui/PressScale";
import { radius, space, text, type } from "@/constants/design";

export function YouTubeControlsButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  return <PressScale accessibilityRole="button" accessibilityLabel={expanded ? "Hide YouTube controls" : "Show YouTube controls"}
    accessibilityState={{ expanded }} onPress={onPress} style={styles.button}>
    <Text style={styles.label}>{expanded ? "Hide controls" : "YouTube settings"}</Text>
  </PressScale>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: "rgba(28,27,26,0.55)" },
  label: { ...type.caption, color: text.inverse },
});
