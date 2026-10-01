import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { VideoView } from "expo-video";
import type { TrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";

export function TrainingClipVideo({ playback, poster, contentFit = "contain" }: { playback: TrainingClipPlayback; poster?: ImageSourcePropType; contentFit?: "contain" | "cover" }) {
  return <View style={styles.stage}>
    <VideoView player={playback.player} style={styles.video} contentFit={contentFit} nativeControls={false} />
    {!playback.playing && playback.time === 0 && poster ? <Image source={poster} style={styles.poster} resizeMode={contentFit} accessibilityLabel="Training demonstration" /> : null}
  </View>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#141414", overflow: "hidden" },
  video: { width: "100%", height: "100%" },
  poster: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
});
