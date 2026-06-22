import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

type GoldBarProps = {
  size?: number;
};

export const GoldBar = ({ size = 14 }: GoldBarProps) => (
  <View
    style={[
      styles.bar,
      {
        width: Math.round(size * 1.75),
        height: Math.round(size * 1.0),
        borderRadius: Math.round(size * 0.2),
      },
    ]}
  >
    <View style={styles.shine} />
    <View style={styles.stripe} />
  </View>
);

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.gold,
    borderBottomWidth: 2,
    borderBottomColor: "#9A7000",
    borderRightWidth: 1,
    borderRightColor: "#B89000",
    overflow: "hidden",
    justifyContent: "center",
  },
  shine: {
    position: "absolute",
    top: 2,
    left: 3,
    right: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  stripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "30%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
