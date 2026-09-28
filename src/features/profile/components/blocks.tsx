import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { router } from "expo-router";
import { CaretDownIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { Panel, PanelChips, PanelRow } from "@/features/profile/components/ProfilePanels";
import type { Block, StateKey } from "@/constants/profileRecord";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const DEFAULT_STATE_LABELS: Record<StateKey, string> = {
  settled: "Comfortable",
  learning: "Building",
  hard: "Working on",
};

type EditProps = {
  editing?: boolean;
  onEditField?: (label: string, value: string) => void;
};

export const BlockList = ({
  blocks,
  editing = false,
  onEditField,
}: { blocks: readonly Block[] } & EditProps) => (
  <>
    {blocks.map((block, index) => (
      <BlockView
        key={index}
        block={block}
        first={index === 0}
        editing={editing}
        onEditField={onEditField}
      />
    ))}
  </>
);

const STATE_STEPS: Record<StateKey, number> = { hard: 1, learning: 2, settled: 3 };

const BlockView = ({
  block,
  first,
  editing,
  onEditField,
}: { block: Block; first: boolean } & EditProps) => {
  if (block.kind === "prose") {
    return <Text style={[styles.prose, !first && styles.spaced]}>{block.text}</Text>;
  }

  if (block.kind === "link") {
    return (
      <Panel
        lead={block.hint}
        title={`${block.label}.`}
        size="section"
        onPress={() => router.push(block.href as never)}
      />
    );
  }

  const title = "title" in block && block.title ? block.title : "Details";
  const note = "note" in block ? block.note : undefined;

  return (
    <Panel title={`${title}.`} size="section" meta={note}>
      {block.kind === "facts" ? (
        <Collapsible count={block.rows.length} limit={block.collapseAfter}>
          {(shown) =>
            block.rows.slice(0, shown).map((row, index) => (
              <PanelRow
                key={row[0]}
                label={row[0]}
                value={row[1]}
                order={index}
                editing={editing}
                onPress={editing && onEditField ? () => onEditField(row[0], row[1]) : undefined}
              />
            ))
          }
        </Collapsible>
      ) : null}

      {block.kind === "states" ? (
        <Collapsible count={block.rows.length} limit={block.collapseAfter}>
          {(shown) =>
            block.rows.slice(0, shown).map((row, index) => (
              <PanelRow
                key={row.label}
                label={row.label}
                steps={{ filled: STATE_STEPS[row.state], total: 3 }}
                value={block.labels?.[row.state] ?? DEFAULT_STATE_LABELS[row.state]}
                order={index}
                a11y={`${row.label}: ${block.labels?.[row.state] ?? DEFAULT_STATE_LABELS[row.state]}${row.detail ? `. ${row.detail}` : ""}`}
              />
            ))
          }
        </Collapsible>
      ) : null}

      {block.kind === "entries" ? (
        <Collapsible count={block.rows.length} limit={block.collapseAfter}>
          {(shown) =>
            block.rows.slice(0, shown).map((row, index) => (
              <PanelRow key={row.title} label={row.title} sub={row.meta} value={row.trailing} order={index} />
            ))
          }
        </Collapsible>
      ) : null}

      {block.kind === "meters"
        ? block.rows.map((row, index) => (
            <PanelRow
              key={row.label}
              label={row.label}
              steps={{ filled: row.strong, total: row.total }}
              value={`${row.strong}/${row.total}`}
              order={index}
            />
          ))
        : null}

      {block.kind === "chips" ? <PanelChips items={block.items} /> : null}
    </Panel>
  );
};

const Collapsible = ({
  count,
  limit,
  children,
}: {
  count: number;
  limit?: number;
  children: (shown: number) => React.ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const collapses = limit != null && count > limit;
  const shown = collapses && !open ? limit : count;
  const hidden = count - shown;

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
      style={styles.collapsible}
    >
      {children(shown)}

      {collapses && !open ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Show ${hidden} more`}
          scaleTo={0.98}
          onPress={() => setOpen(true)}
        >
          <View style={styles.more}>
            <Text style={styles.moreText}>Show {hidden} more</Text>
            <CaretDownIcon size={iconSize.inline} color={text.secondary} weight="bold" />
          </View>
        </PressScale>
      ) : null}
    </Animated.View>
  );
};

export const StateChip = ({ state, label }: { state: StateKey; label: string }) => (
  <View style={[styles.stateChip, state === "settled" && styles.chipSettled, state === "hard" && styles.chipHard]}>
    <Text style={[styles.stateChipText, state === "settled" && styles.chipTextSettled]}>{label}</Text>
  </View>
);

export const enterAt = (order: number, reduceMotion: boolean) =>
  reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

const styles = StyleSheet.create({
  collapsible: { gap: space.md },
  spaced: { marginTop: space.xl },
  prose: { ...type.body, color: text.secondary },





  stateChip: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSettled: { backgroundColor: accent.primary },
  chipHard: { backgroundColor: "transparent", borderColor: border.default },
  stateChipText: { ...type.caption, fontWeight: "500", color: text.secondary },
  chipTextSettled: { color: text.primary },


  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  chipText: { ...type.supporting, color: text.primary },

  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: space.xs,
  },
  moreText: { ...type.supporting, fontWeight: "500", color: text.secondary },

});
