import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogMoments } from "@/hooks/useDogMoments";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";

export default function ShareDogMomentScreen() {
  const dog = useCurrentDog();
  const moments = useDogMoments(dog.data?.id);
  const dashboard = useProfileDashboard(dog.data?.id);
  const moment = moments.data?.[0];

  if (dog.isLoading || moments.isLoading) return <ScreenContainer centered><LoadingState message="Loading share card..." /></ScreenContainer>;

  const shareMessage = moment?.caption ? `PAWS DogMoment: ${moment.caption}` : "PAWS DogMoment";

  return (
    <ScreenContainer scroll padded={false}>
      <View style={styles.dimmedTop}>
        <Text style={styles.dimmedBrand}>PAWS</Text>
      </View>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {moment ? (
          <>
            <View style={styles.storyCard}>
              <View style={styles.ribbon}>
                <Text style={styles.ribbonText}>MEMORIES</Text>
              </View>
              <View style={styles.imageFrame}>
                {moment.imageUrl ? <ExpoImage source={{ uri: moment.imageUrl }} style={styles.image} contentFit="cover" /> : <View style={styles.emptyImage} />}
                <View style={styles.moodPill}>
                  <Ionicons name="heart" size={14} color="#657057" />
                  <Text style={styles.moodText}>Happy</Text>
                </View>
                <Ionicons name="sparkles" size={20} color="#D6DA78" style={styles.sparkle} />
              </View>
              <Text style={styles.eyebrow}>{dog.data?.name?.toUpperCase() ?? "DOG"}’S DOGMOMENT</Text>
              <Text style={styles.cardTitle}>{moment.caption || "Today’s vibe: Happy"}</Text>
              <View style={styles.streakRow}>
                <Ionicons name="flame" size={16} color="#7A805F" />
                <Text style={styles.streakText}>{dashboard.data?.streak ?? 0} Day Streak</Text>
              </View>
              <Text style={styles.cardBrand}>PAWS</Text>
            </View>

            <Text style={styles.shareTitle}>Share with friends</Text>
            <View style={styles.shareApps}>
              <ShareApp label="IG Story" color="#E84C86" icon="camera" />
              <ShareApp label="TikTok" color="#050505" icon="musical-notes" />
              <ShareApp label="Snapchat" color="#FFF200" icon="barcode" darkIcon />
              <ShareApp label="iMessage" color="#30C861" icon="chatbubble" />
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryAction} onPress={() => void Share.share({ message: shareMessage })}>
                <Ionicons name="download-outline" size={20} color="#565B4E" />
                <Text style={styles.secondaryText}>Save Image</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={() => void Share.share({ message: shareMessage })}>
                <Ionicons name="link-outline" size={20} color="#565B4E" />
                <Text style={styles.secondaryText}>Copy Link</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <EmptyState title="No shareable moment yet" description="Upload a DogMoment first." />
        )}

        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const ShareApp = ({
  label,
  color,
  icon,
  darkIcon = false,
}: {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  darkIcon?: boolean;
}) => (
  <View style={styles.shareApp}>
    <View style={[styles.appIcon, { backgroundColor: color }]}>
      {icon === "barcode" ? (
        <MaterialCommunityIcons name="barcode-scan" size={24} color="#171B17" />
      ) : (
        <Ionicons name={icon} size={24} color={darkIcon ? "#171B17" : theme.colors.white} />
      )}
    </View>
    <Text style={styles.appLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  dimmedTop: { height: 236, backgroundColor: "rgba(31,32,28,0.34)", paddingTop: theme.spacing.xl, paddingHorizontal: theme.spacing.xl },
  dimmedBrand: { color: "rgba(47,52,41,0.14)", fontSize: 30, fontWeight: "900" },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#FFFCF7", paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.lg, ...theme.shadows.raised },
  handle: { width: 58, height: 6, borderRadius: 999, backgroundColor: "#D7D2C8", alignSelf: "center", marginBottom: theme.spacing.lg },
  storyCard: { width: 278, alignSelf: "center", borderRadius: 22, backgroundColor: "#FFFCF7", borderWidth: 4, borderColor: "#D8D7CC", padding: theme.spacing.md, alignItems: "center", ...theme.shadows.raised },
  ribbon: { position: "absolute", left: 10, top: -10, zIndex: 2, backgroundColor: "#DDE086", borderRadius: 14, paddingHorizontal: theme.spacing.sm, paddingVertical: 3, transform: [{ rotate: "-7deg" }] },
  ribbonText: { color: "#657057", fontSize: 11, fontWeight: "900" },
  imageFrame: { width: "100%", aspectRatio: 1.17, borderRadius: 10, overflow: "hidden", backgroundColor: "#E6E1D8" },
  image: { width: "100%", height: "100%" },
  emptyImage: { flex: 1, backgroundColor: "#D8D2C6" },
  moodPill: { position: "absolute", left: 12, bottom: 12, borderRadius: 16, backgroundColor: "#FFFCF7", paddingHorizontal: theme.spacing.sm, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  moodText: { color: "#555B4B", fontSize: 12, fontWeight: "800" },
  sparkle: { position: "absolute", right: 8, top: 8 },
  eyebrow: { marginTop: theme.spacing.lg, color: "#A7A092", fontSize: 11, fontWeight: "800" },
  cardTitle: { color: "#2A2D26", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 2 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  streakText: { color: "#6A7154", fontSize: 14, fontWeight: "900" },
  cardBrand: { alignSelf: "flex-end", color: "#AAA393", fontSize: 14, fontWeight: "900", marginTop: theme.spacing.sm },
  shareTitle: { color: "#171B17", fontSize: 20, fontWeight: "900" },
  shareApps: { flexDirection: "row", justifyContent: "space-between" },
  shareApp: { alignItems: "center", gap: theme.spacing.sm, width: 70 },
  appIcon: { width: 54, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  appLabel: { color: "#555B4B", fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: theme.spacing.md },
  secondaryAction: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: "#EEEAE4", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: theme.spacing.sm },
  secondaryText: { color: "#363A31", fontSize: 14, fontWeight: "900" },
  cancelButton: { minHeight: 58, borderRadius: 12, backgroundColor: "#697056", alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm },
  cancelText: { color: theme.colors.white, fontSize: 16, fontWeight: "900" },
});
