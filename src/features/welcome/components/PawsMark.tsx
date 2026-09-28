import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G } from "react-native-svg";

import { text as textColor, type } from "@/constants/design";

export const PawsMark = () => (
  <View style={styles.row}>
    <Text style={styles.word}>PAWS</Text>
    <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.paw}>
      <G fill={textColor.primary}>
        <Ellipse cx="5.5" cy="8" rx="3" ry="4" transform="rotate(-16 5.5 8)" />
        <Circle cx="12" cy="5" r="3.4" />
        <Ellipse cx="18.5" cy="8" rx="3" ry="4" transform="rotate(16 18.5 8)" />
        <Ellipse cx="12" cy="16" rx="6" ry="5" />
      </G>
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  word: {
    ...type.sectionTitle,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: textColor.primary,
  },
  paw: {
    marginLeft: 3,
    marginTop: -2,
  },
});
