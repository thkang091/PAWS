import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, layout, radius, space, text, type } from "@/constants/design";
import { useYouTubeTrainingPlayback } from "@/hooks/useYouTubeTrainingPlayback";
import { getTrainingClipLessons } from "../media/trainingClipLessons";
import { getTrainingYouTubeSegments, youtubeWatchUrl } from "../media/trainingYouTube";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { TrainingClipScreen } from "./TrainingClipScreen";
import { YouTubeControlsButton } from "./YouTubeControlsButton";

export type YouTubeTrainingClipProps = {
  skillCode: string; title: string; level: number; onContinue: () => void; onClose: () => void;
  sessionId?: string; onHelp?: (at: number, step: number) => void; reviewAt?: number; busy?: boolean; error?: string | null;
  continueLabel?: string; onLevelChange?: (level: number) => void;
};

// Only playback differs from MP4. Both providers render the same lesson screen.
export function YouTubeTrainingClip(props: YouTubeTrainingClipProps) {
  return <YouTubeTrainingClipContent key={`${props.skillCode}:${props.level}:${props.reviewAt ?? 0}`} {...props} />;
}

function YouTubeTrainingClipContent({ skillCode, title, level, sessionId, onContinue, onClose, onHelp, reviewAt,
  busy = false, error: actionError, continueLabel, onLevelChange }: YouTubeTrainingClipProps) {
  const lesson = getTrainingClipLessons(skillCode).find(item => item.levelNumber === level)!;
  const segments = getTrainingYouTubeSegments(skillCode, level);
  const playback = useYouTubeTrainingPlayback(lesson, segments, true, reviewAt, sessionId);
  const segment = playback.segment!;
  const insets = useSafeAreaInsets();
  // Reserve space INSIDE the original dark video stage for its existing close
  // button and overlapping sheet. Neither may cover the official player.
  const playerTop = insets.top + space.sm + 44;
  const leave = (action: () => void) => { playback.pause(); action(); };
  return <TrainingClipScreen title={title} lesson={lesson} playback={playback}
    minimumVideoHeight={playerTop + 200 + space.sm}
    videoActions={<YouTubeControlsButton expanded={playback.showControls} onPress={playback.toggleControls} />}
    video={<View style={{ flex: 1, paddingTop: playerTop, paddingBottom: space.sm }}>
      <YouTubeEmbed key={playback.embedKey} {...playback.embedProps!} />
    </View>}
    navigation={onLevelChange ? <View style={styles.levels}>{getTrainingClipLessons(skillCode).map(item => <PressScale key={item.id} accessibilityRole="button" accessibilityLabel={`Preview Level ${item.levelNumber}`} accessibilityState={{ selected: level === item.levelNumber }} style={[styles.level, level === item.levelNumber && styles.selected]} onPress={() => leave(() => onLevelChange(item.levelNumber))}><Text>{item.levelNumber}</Text></PressScale>)}</View> : undefined}
    sourceLink={playback.error ? <PressScale accessibilityRole="link" accessibilityLabel={`Open original video by ${segment.channel}`} onPress={() => {
      playback.pause(); void Linking.openURL(youtubeWatchUrl(segment)).catch(() => {});
    }}><Text style={styles.source}>Open on YouTube ↗</Text></PressScale> : undefined}
    onClose={() => leave(onClose)} onContinue={() => leave(onContinue)} onReplay={playback.playWhole} replayDisabled={!playback.ready}
    onHelp={onHelp ? () => { if (!busy) leave(() => onHelp(playback.time, playback.currentCue?.stepIndex ?? 0)); } : undefined}
    continueLabel={continueLabel ?? (reviewAt !== undefined ? "Back to question" : "Continue")}
    busy={busy} error={actionError ?? playback.error} />;
}

const styles = StyleSheet.create({
  source: { ...type.caption, color: text.secondary },
  levels: { flexDirection: "row", gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  level: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: bg.subtle },
  selected: { backgroundColor: accent.primary },
});
