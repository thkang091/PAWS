import { memo, useCallback } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions, type ListRenderItem } from "react-native";
import { WarningIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { cellView, type NumberAvailability } from "@/features/numberTrail/discoveryFlow";
import { NT } from "@/features/numberTrail/theme";
import { accent, bg, border, layout, radius, space, text } from "@/constants/design";

const COLUMNS = 5;
const GAP = space.sm;

/**
 * 0 to 99 as a five-column grid. Available numbers are white cards with a gold edge and their route count; checked
 * numbers with no route are flat and quiet; unchecked ones have a dashed outline. Each state differs in fill, edge and
 * words, so colour is never the only signal. Cells don't animate: up to a hundred change during a scan.
 */
export const NumberGrid = ({
  numbers,
  onPick,
  header,
  footer,
  bottomInset,
}: {
  numbers: readonly NumberAvailability[];
  onPick: (n: NumberAvailability) => void;
  header?: React.ReactElement;
  footer?: React.ReactElement;
  bottomInset: number;
}) => {
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - layout.gutter * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const render: ListRenderItem<NumberAvailability> = useCallback(({ item }) => <Cell n={item} size={cell} onPick={onPick} />, [cell, onPick]);
  return (
    <FlatList
      data={numbers as NumberAvailability[]}
      keyExtractor={(n) => n.number}
      numColumns={COLUMNS}
      renderItem={render}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      initialNumToRender={40}
      showsVerticalScrollIndicator={false}
    />
  );
};

const Cell = memo(({ n, size, onPick }: { n: NumberAvailability; size: number; onPick: (n: NumberAvailability) => void }) => {
  const v = cellView(n);
  const body = (
    <>
      <Text style={[styles.number, toneText[v.tone]]} maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit>
        {n.number}
      </Text>
      <View style={styles.subRow}>
        {v.tone === "failed" ? <WarningIcon size={10} color="#B4442C" weight="fill" /> : null}
        <Text style={[styles.sub, v.tone === "available" && styles.subOn]} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {v.sub}
        </Text>
      </View>
    </>
  );
  const style = [styles.cell, { width: size, height: Math.max(64, size * 0.92) }, toneCell[v.tone]];
  if (!v.selectable)
    return (
      <View style={style} accessible accessibilityLabel={v.a11y}>
        {body}
      </View>
    );
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={v.a11y} scaleTo={0.95} style={style} onPress={() => onPick(n)}>
      {body}
    </PressScale>
  );
});
Cell.displayName = "NumberCell";

const toneCell = StyleSheet.create({
  available: { backgroundColor: bg.surface, borderWidth: 2, borderColor: accent.band },
  none: { backgroundColor: bg.subtle },
  unchecked: { borderWidth: 1.5, borderColor: border.default, borderStyle: "dashed" },
  checking: { backgroundColor: NT.board, borderWidth: 1.5, borderColor: border.soft, borderStyle: "dashed" },
  failed: { borderWidth: 1.5, borderColor: "#E9B9A9", borderStyle: "dashed" },
});
const toneText = StyleSheet.create({
  available: { color: text.primary },
  none: { color: text.tertiary },
  unchecked: { color: text.tertiary },
  checking: { color: text.tertiary },
  failed: { color: text.tertiary },
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter },
  row: { gap: GAP, marginBottom: GAP },
  cell: { borderRadius: radius.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  number: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  subRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 },
  sub: { fontSize: 10, fontWeight: "700", color: text.tertiary },
  subOn: { color: text.secondary },
});
