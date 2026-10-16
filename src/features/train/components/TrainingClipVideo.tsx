import { memo } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { VideoView } from "expo-video";
import type { TrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";

export const TrainingClipVideo = memo(function TrainingClipVideo({ playback, poster, contentFit = "contain" }: { playback: TrainingClipPlayback; poster?: ImageSourcePropType; contentFit?: "contain" | "cover" }) {
  return <View style={styles.stage}>
    <VideoView player={playback.player} style={styles.video} contentFit={contentFit} nativeControls={false} onFirstFrameRender={playback.onFirstFrameRender} />
    {!playback.playing && playback.time === 0 && poster ? <Image source={poster} style={styles.poster} resizeMode={contentFit} accessibilityLabel="Training demonstration" /> : null}
    {playback.loading || playback.error ? <View style={styles.loading}>
      {playback.error ? <Pressable accessibilityRole="button" onPress={playback.retry} style={styles.retry}><Text style={styles.label}>Retry video</Text></Pressable> : <>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.label}>Preparing video…</Text>
      </>}
    </View> : null}
  </View>;
}, (previous, next) => previous.poster === next.poster && previous.contentFit === next.contentFit
  && previous.playback.player === next.playback.player && previous.playback.playing === next.playback.playing
  && (previous.playback.time === 0) === (next.playback.time === 0)
  && previous.playback.loading === next.playback.loading && previous.playback.error === next.playback.error
  && previous.playback.retry === next.playback.retry && previous.playback.onFirstFrameRender === next.playback.onFirstFrameRender);

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#141414", overflow: "hidden" },
  video: { width: "100%", height: "100%" },
  poster: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(20,20,20,0.5)" },
  label: { color: "#FFFFFF", fontSize: 14 },
  retry: { padding: 20 },
});
