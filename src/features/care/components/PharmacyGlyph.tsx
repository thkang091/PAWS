import { StyleSheet, View } from "react-native";
import { PawPrintIcon, PillIcon, type IconProps } from "phosphor-react-native";

import { accent } from "@/constants/design";

/**
 * The pet pharmacy mark: a capsule with a small paw tucked on its corner, so it reads as medicine for a dog rather
 * than the generic Rx sign. Same line weight and colour as the other service icons, sized like them.
 */
export const PharmacyGlyph = ({ size = 24, color, weight = "regular", backdrop = accent.primary }: IconProps & { backdrop?: string }) => {
  const n = typeof size === "number" ? size : 24;
  const badge = Math.round(n * 0.52);
  return (
    <View style={{ width: n, height: n }}>
      <PillIcon size={n} color={color} weight={weight} />
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, right: -badge * 0.28, bottom: -badge * 0.22, backgroundColor: backdrop }]}>
        <PawPrintIcon size={Math.round(badge * 0.78)} color={color} weight="fill" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // The badge punches out of the capsule with the tile's own colour (`backdrop`), so the two shapes stay separate.
  badge: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
