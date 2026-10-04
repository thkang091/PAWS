import { memo, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, border, radius, space, text, type } from "@/constants/design";
import type { TrainingClipLesson } from "@/features/train/media/doorwayWaitLesson";
import type { TrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";

type GuidePlayback = Pick<TrainingClipPlayback, "time" | "currentCue" | "error" | "seek" | "retry">;

export const TrainingClipGuide = memo(function TrainingClipGuide({ lesson, playback }: { lesson: TrainingClipLesson; playback: GuidePlayback }) {
  const scroll = useRef<ScrollView>(null);
  const [rows, setRows] = useState<Record<number, { y: number; height: number }>>({});
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const offset = useRef(0);
  const manualUntil = useRef(0);
  const autoUntil = useRef(0);
  const activeAt = playback.currentCue?.at ?? 0;
  const stepIndex = playback.currentCue?.stepIndex ?? 0;
  const cues = lesson.steps.flatMap((step) => step.cues);

  useEffect(() => {
    const row = rows[activeAt];
    if (!row || !viewportHeight || Date.now() < manualUntil.current) return;
    // Leave visible captions in place. Only follow when the active row leaves
    // the viewport, retaining surrounding rows and no trailing blank spacer.
    if (row.y >= offset.current && row.y + row.height <= offset.current + viewportHeight) return;
    const y = Math.max(0, Math.min(contentHeight - viewportHeight, row.y - (viewportHeight - row.height) / 2));
    autoUntil.current = Date.now() + 700;
    scroll.current?.scrollTo({ y, animated: true });
  }, [activeAt, rows, viewportHeight, contentHeight]);

  const holdAutoScroll = () => { manualUntil.current = Date.now() + 3000; };

  return <View style={styles.root}>
    <Text style={styles.eyebrow}>STEP {stepIndex + 1} OF {lesson.steps.length} · {lesson.steps[stepIndex].title.toUpperCase()}</Text>
    <ScrollView ref={scroll} testID="training-captions" style={styles.script} contentContainerStyle={styles.scriptContent} showsVerticalScrollIndicator
      onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
      onContentSizeChange={(_, height) => setContentHeight(height)}
      onTouchStart={holdAutoScroll} onScrollBeginDrag={() => { autoUntil.current = 0; holdAutoScroll(); }} onScrollEndDrag={holdAutoScroll}
      scrollEventThrottle={16}
      onScroll={({ nativeEvent }) => {
        offset.current = nativeEvent.contentOffset.y;
        if (Date.now() > autoUntil.current) holdAutoScroll();
      }}>
      {cues.map((cue, index) => <View key={`${lesson.id}-${cue.at}`} onLayout={({ nativeEvent: { layout } }) => {
        setRows((previous) => previous[cue.at]?.y === layout.y && previous[cue.at]?.height === layout.height ? previous : { ...previous, [cue.at]: { y: layout.y, height: layout.height } });
      }}>
        <PressScale accessibilityRole="button" accessibilityState={{ selected: activeAt === cue.at }} accessibilityLabel={`${index + 1}. ${cue.text}`} onPress={() => { manualUntil.current = 0; playback.seek(cue.at); }} style={[styles.cue, activeAt === cue.at && styles.selected]}>
          <Text style={styles.timestamp}>{index + 1}</Text>
          <Text style={[styles.caption, activeAt === cue.at && styles.captionSelected]}>{cue.text}</Text>
        </PressScale>
      </View>)}
    </ScrollView>
    {playback.error ? <PressScale accessibilityRole="button" accessibilityLabel="Retry video" onPress={() => void playback.retry()}><Text style={styles.remaining}>Retry video</Text></PressScale> : null}
  </View>;
}, (previous, next) => previous.lesson === next.lesson
  && previous.playback.currentCue?.at === next.playback.currentCue?.at
  && previous.playback.error === next.playback.error
  && previous.playback.seek === next.playback.seek && previous.playback.retry === next.playback.retry);

export function TrainingClipTimeline({ lesson, playback }: { lesson: TrainingClipLesson; playback: GuidePlayback }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const cues = lesson.steps.flatMap(step => step.cues);
  const activeIndex = Math.max(0, cues.findIndex(cue => cue.at === playback.currentCue?.at));
  const seekIndex = (index: number) => { const cue = cues[Math.max(0, Math.min(cues.length - 1, index))]; if (cue) playback.seek(cue.at); };
  const seekPosition = (x: number) => seekIndex(Math.round(Math.max(0, Math.min(1, x / trackWidth)) * (cues.length - 1)));
  return (
    <View style={styles.meter}>
      <View testID="training-timeline" style={styles.seekArea} accessible accessibilityRole="adjustable" accessibilityLabel="Instruction sequence" accessibilityValue={{ min: 1, max: cues.length, now: activeIndex + 1, text: `${activeIndex + 1} of ${cues.length}` }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={({ nativeEvent }) => seekIndex(activeIndex + (nativeEvent.actionName === "increment" ? 1 : -1))} onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderRelease={({ nativeEvent }) => seekPosition(nativeEvent.locationX)}>
        <View pointerEvents="none" style={styles.track}><View style={[styles.fill, { width: `${(activeIndex + 1) / Math.max(1, cues.length) * 100}%` }]} /></View>
      </View>
      <Text style={styles.remaining}>{activeIndex + 1} / {cues.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: space.sm },
  eyebrow: { ...type.eyebrow, color: text.tertiary },
  script: { flex: 1, minHeight: 0, marginHorizontal: -space.sm },
  scriptContent: { paddingBottom: space.xs },
  cue: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10, minHeight: 48, borderRadius: radius.control },
  selected: { backgroundColor: accent.primary },
  timestamp: { ...type.caption, minWidth: 18, textAlign: "center", fontWeight: "600", lineHeight: 23, color: text.primary, fontVariant: ["tabular-nums"] },
  caption: { flex: 1, fontSize: 17, lineHeight: 23, color: text.secondary },
  captionSelected: { color: text.primary, fontWeight: "600" },
  meter: { flexDirection: "row", alignItems: "center", gap: space.sm },
  seekArea: { flex: 1, height: 44, justifyContent: "center" },
  track: { height: 3, borderRadius: radius.pill, backgroundColor: border.soft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: accent.deep },
  remaining: { ...type.caption, color: text.tertiary, fontVariant: ["tabular-nums"] },
});
