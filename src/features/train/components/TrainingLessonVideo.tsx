import { StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { PlayIcon } from "phosphor-react-native";

import { bg, icon as iconSize, radius, space, text, type } from "@/constants/design";
import type { TrainingMediaBinding } from "@/types/domain";

const HEIGHT = 220;

type TrainingLessonVideoProps = {
  media: TrainingMediaBinding | null;
  fill?: boolean;
};

export const TrainingLessonVideo = ({ media, fill = false }: TrainingLessonVideoProps) => {
  if (media?.mediaUrl) {
    return <PlayableVideo uri={media.mediaUrl} fill={fill} />;
  }

  return (
    <View style={[styles.placeholder, fill ? styles.placeholderFill : styles.placeholderInline]}>
      <View style={styles.playBadge}>
        <PlayIcon size={iconSize.standard} color={text.tertiary} weight="fill" />
      </View>
      <Text style={styles.placeholderText}>
        {media?.fallbackText ?? "Video coming soon for this lesson."}
      </Text>
    </View>
  );
};

const PlayableVideo = ({ uri, fill }: { uri: string; fill: boolean }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={fill ? styles.videoFill : styles.videoInline}
      contentFit="cover"
      nativeControls
    />
  );
};

const styles = StyleSheet.create({
  videoInline: { width: "100%", height: HEIGHT, borderRadius: radius.card, backgroundColor: "#000" },
  videoFill: { flex: 1, backgroundColor: "#000" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  placeholderInline: { height: HEIGHT, borderRadius: radius.card, backgroundColor: bg.subtle },
  placeholderFill: { flex: 1, backgroundColor: bg.subtle },
  playBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { ...type.supporting, color: text.tertiary, textAlign: "center" },
});
