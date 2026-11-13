import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { errorText } from "@/features/game/arena/arenaCopy";
import { getReplayUrl } from "@/services/arenaService";
import { space, type } from "@/constants/design";

/** A full-screen replay of one clip. The link is fetched when it opens and lasts ten minutes. */
export const ReplaySheet = ({ attemptId, title, onClose }: { attemptId: string | null; title: string; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!attemptId) return;
    let live = true;
    getReplayUrl(attemptId)
      .then((u) => live && setUrl(u))
      .catch((e) => live && setError(errorText((e as { code?: string }).code)));
    return () => {
      live = false;
    };
  }, [attemptId]);

  return (
    <Modal visible={Boolean(attemptId)} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        {url ? <Player url={url} /> : <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color="#FFFFFF" />}</View>}
        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Close replay" style={styles.close} onPress={onClose}>
            <XIcon size={20} color="#FFFFFF" weight="bold" />
          </PressScale>
        </View>
      </View>
    </Modal>
  );
};

const Player = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  error: { ...type.body, color: "#FFFFFF", textAlign: "center" },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, gap: space.md },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
});
