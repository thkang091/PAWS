import { Asset } from "expo-asset";
import type { VideoSource } from "expo-video";

// In a dev build, require(mp4) resolves to Metro over Wi-Fi. Download the
// complete clip before handing it to the player, also reusing Expo's disk cache.
export async function prepareTrainingClip(source: VideoSource): Promise<VideoSource> {
  if (typeof source !== "number") return source;
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Video download unavailable");
  return { uri: asset.localUri };
}
