import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";

/**
 * One clip, looping and muted, filling its box. The still frame sits underneath until the first frame is ready, so
 * nothing flashes black. `playing` false shows the still only (cheap, for grids).
 */
export const ReelPlayer = ({ url, poster, playing = true, style }: { url: string | null; poster?: string | null; playing?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.box, style]}>
    {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
    {playing && url ? <Live url={url} /> : null}
  </View>
);

const Live = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    player.play();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
};

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#1C1B1A" },
});
