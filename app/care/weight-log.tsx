import { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { ForkKnifeIcon, PlusIcon, ScalesIcon } from "phosphor-react-native";

import { DetailEmpty, DetailShell } from "@/features/care/components/DetailShell";
import { ChipRow, DetailSheet, Field } from "@/features/care/components/DetailSheet";
import { Band, PanelHead, Rail } from "@/components/ui/panels";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useSaveWeightLog, useWeightLogs } from "@/hooks/useWeightLogs";
import {
  accent,
  bg,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const UNITS = [
  { key: "kg", label: "Kilograms" },
  { key: "lb", label: "Pounds" },
] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function NutritionScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const logs = useWeightLogs(dogId);
  const save = useSaveWeightLog(dogId);

  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [note, setNote] = useState("");

  const entries = useMemo(() => [...(logs.data ?? [])], [logs.data]);
  const series = useMemo(() => [...entries].reverse(), [entries]);

  const latest = entries[0];
  const previous = entries[1];
  const delta =
    latest && previous && latest.weightUnit === previous.weightUnit
      ? latest.weightValue - previous.weightValue
      : null;

  const change =
    delta === null
      ? "First entry"
      : Math.abs(delta) < 0.05
        ? "Steady"
        : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} ${latest.weightUnit}`;

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  const commit = () => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) return;
    save.mutate(
      {
        dogId,
        weightValue: value,
        weightUnit: unit,
        recordedAt: new Date().toISOString(),
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setWeight("");
          setNote("");
        },
      },
    );
  };

  return (
    <DetailShell
      title="Nutrition"
      glyph={<ForkKnifeIcon size={iconSize.standard} color={accent.deep} weight="fill" />}
      action={{
        label: "Log a weight",
        icon: <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: () => setOpen(true),
      }}
    >
      {!latest ? (
        <DetailEmpty
          glyph={<ScalesIcon size={32} color={text.primary} weight="regular" />}
          title="No weigh-ins yet"
          body={`Log ${dog.data?.name ?? "your dog"}'s weight and PAWS will start drawing the trend.`}
        />
      ) : (
        <>
          <Animated.View entering={enter(0)} style={styles.headline}>
            <View style={styles.headlineCopy}>
              <View style={styles.readout}>
                <Text style={styles.value}>{latest.weightValue.toFixed(1)}</Text>
                <Text style={styles.unit}>{latest.weightUnit}</Text>
              </View>
              <Text style={styles.taken}>
                Taken {fmtDate(latest.recordedAt)}
                {latest.note ? ` · ${latest.note}` : ""}
              </Text>
            </View>

            <View style={styles.changeChip}>
              <Text style={styles.changeText}>{change}</Text>
            </View>
          </Animated.View>

          {series.length > 1 ? (
            <Animated.View entering={enter(1)} style={styles.chart}>
              <Trend
                values={series.map((entry) => entry.weightValue)}
                width={width - layout.gutter * 2}
              />
              <View style={styles.axis}>
                <Text style={styles.axisLabel}>{fmtDate(series[0].recordedAt)}</Text>
                <Text style={styles.axisLabel}>
                  {fmtDate(series[series.length - 1].recordedAt)}
                </Text>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(2)}>
            <Band
              figures={[
                {
                  key: "now",
                  glyph: "scales",
                  value: `${latest.weightValue.toFixed(1)}`,
                  label: latest.weightUnit === "kg" ? "Kilograms" : "Pounds",
                },
                { key: "change", glyph: "trend", value: change, label: "Since last" },
                {
                  key: "count",
                  glyph: "calendar",
                  value: String(entries.length),
                  label: entries.length === 1 ? "Weigh-in" : "Weigh-ins",
                },
              ]}
            />
          </Animated.View>

          <PanelHead title="Every weigh-in" />
          <Rail
            cards={entries.slice(0, 12).map((entry, index) => {
              const before = entries[index + 1];
              const step =
                before && before.weightUnit === entry.weightUnit
                  ? entry.weightValue - before.weightValue
                  : null;
              return {
                key: entry.id,
                title: `${entry.weightValue.toFixed(1)} ${entry.weightUnit}`,
                chip:
                  step === null
                    ? "First"
                    : Math.abs(step) < 0.05
                      ? "Steady"
                      : `${step > 0 ? "+" : "−"}${Math.abs(step).toFixed(1)}`,
                meta: fmtDate(entry.recordedAt),
              };
            })}
          />
        </>
      )}

      <DetailSheet
        open={open}
        title="Log a weight"
        saveLabel="Save weigh-in"
        saving={save.isPending}
        canSave={Number(weight) > 0}
        onClose={() => setOpen(false)}
        onSave={commit}
      >
        <Field
          label="Weight"
          value={weight}
          onChangeText={setWeight}
          placeholder={latest ? latest.weightValue.toFixed(1) : "28.4"}
          keyboardType="decimal-pad"
        />
        <ChipRow
          label="Unit"
          options={UNITS.map((item) => ({ key: item.key, label: item.label }))}
          value={unit}
          onChange={(key) => setUnit(key as "kg" | "lb")}
        />
        <Field
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="After a vet visit, new food, anything you noticed…"
          multiline
        />
        {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
      </DetailSheet>
    </DetailShell>
  );
}

const H = 140;
const PAD = 16;
const EDGE = 9;

const Trend = ({ values, width }: { values: readonly number[]; width: number }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.8);
  const floor = min - (span - (max - min)) / 2;

  const plot = width - EDGE * 2;
  const step = plot / Math.max(1, values.length - 1);
  const points = values.map((value, index) => ({
    x: EDGE + index * step,
    y: PAD + (1 - (value - floor) / span) * (H - PAD * 2),
  }));

  const last = points[points.length - 1];

  return (
    <Svg width={width} height={H}>
      <Polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        stroke={accent.deep}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {points.slice(0, -1).map((point, index) => (
        <Circle key={index} cx={point.x} cy={point.y} r={3.5} fill={accent.deep} />
      ))}
      <Circle cx={last.x} cy={last.y} r={7} fill={bg.canvas} stroke={accent.deep} strokeWidth={3} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  headline: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.xxl,
  },
  headlineCopy: { flex: 1 },
  readout: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  value: { ...type.hero, color: text.primary },
  unit: { ...type.sectionTitle, color: text.secondary, paddingBottom: 4 },
  taken: { ...type.caption, color: text.tertiary, marginTop: 6 },
  changeChip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  changeText: { ...type.supporting, fontWeight: "600", color: text.primary },

  chart: { marginTop: space.xl },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  axisLabel: { ...type.caption, color: text.tertiary },

  error: { ...type.caption, color: text.primary, marginTop: space.lg },
});
