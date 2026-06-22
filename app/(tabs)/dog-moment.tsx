import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { SaveProgressBanner } from "@/components/account/SaveProgressBanner";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { todayKey } from "@/hooks/useDailyQuests";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogMoments, useUploadDogMoment } from "@/hooks/useDogMoments";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { theme } from "@/constants/theme";
import { autoCompleteDogMomentTasks } from "@/services/autoCompleteTasksService";

const moods = ["Happy", "Proud", "Silly", "Calm"];
const questTags = [
  { label: "Walk", icon: "walk" },
  { label: "Training", icon: "school-outline" },
  { label: "Playtime", icon: "tennis" },
  { label: "Grooming", icon: "content-cut" },
] as const;

export default function DogMomentTabScreen() {
  const dog = useCurrentDog();
  const moments = useDogMoments(dog.data?.id);
  const dashboard = useProfileDashboard(dog.data?.id);
  const upload = useUploadDogMoment(dog.data?.id ?? "");
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedMood, setSelectedMood] = useState("Happy");
  const [selectedQuest, setSelectedQuest] = useState("Training");
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const todayMoment = useMemo(() => (moments.data ?? []).find((moment) => moment.momentDate === todayKey()), [moments.data]);
  const recentMoments = moments.data ?? [];

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) setSelectedAsset(asset);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) setSelectedAsset(asset);
  };

  const postMoment = () => {
    if (!dog.data || !selectedAsset) return;
    upload.mutate({
      dogId: dog.data.id,
      ownerId: dog.data.ownerId,
      uri: selectedAsset.uri,
      fileSize: selectedAsset.fileSize,
      caption: caption || null,
      localDate: todayKey(),
    }, {
      onSuccess: () => {
        setShowSaveBanner(true);
        setSelectedAsset(null);
        setCaption("");
        if (dog.data?.id) {
          void autoCompleteDogMomentTasks(dog.data.id);
        }
      },
    });
  };

  if (dog.isLoading || moments.isLoading) return <ScreenContainer centered><LoadingState message="Loading DogMoment..." /></ScreenContainer>;
  if (moments.error) return <ScreenContainer centered><ErrorState message={moments.error.message} onRetry={() => void moments.refetch()} /></ScreenContainer>;

  if (selectedAsset) {
    return (
      <ScreenContainer scroll>
        <View style={styles.postHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close composer" onPress={() => setSelectedAsset(null)}>
            <Ionicons name="close" size={24} color={theme.colors.textMuted} />
          </Pressable>
          <Text style={styles.postBrand}>PAWS</Text>
          <Pressable style={styles.postTopButton} disabled={upload.isPending} onPress={postMoment}>
            <Text style={styles.postTopText}>Post</Text>
            <Ionicons name="checkmark" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.previewWrap}>
          <ExpoImage source={{ uri: selectedAsset.uri }} style={styles.previewImage} contentFit="cover" />
          <View style={styles.previewActions}>
            <View style={styles.floatingIcon}><Ionicons name="musical-note" size={22} color={theme.colors.textMuted} /></View>
            <View style={styles.floatingIcon}><Ionicons name="chatbox-outline" size={22} color={theme.colors.textMuted} /></View>
          </View>
        </View>

        <TextInput
          accessibilityLabel="DogMoment caption"
          multiline
          placeholder="Write a caption for this DogMoment..."
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
        />

        <View>
          <Text style={styles.smallPrompt}>How is your pup feeling?</Text>
          <View style={styles.chipRow}>
            {moods.map((mood) => (
              <Pressable key={mood} style={[styles.moodChip, selectedMood === mood && styles.moodChipActive]} onPress={() => setSelectedMood(mood)}>
                <Ionicons name={mood === "Happy" ? "happy-outline" : mood === "Proud" ? "star-outline" : mood === "Silly" ? "sad-outline" : "leaf-outline"} size={18} color={theme.colors.textMuted} />
                <Text style={styles.chipText}>{mood}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.smallPrompt}>Tag a Quest</Text>
          <View style={styles.questGrid}>
            {questTags.map((quest) => (
              <Pressable key={quest.label} style={[styles.questChip, selectedQuest === quest.label && styles.questChipActive]} onPress={() => setSelectedQuest(quest.label)}>
                <MaterialCommunityIcons name={quest.icon} size={22} color={theme.colors.textMuted} />
                <Text style={styles.questText}>{quest.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.privacyRow}>
          <View style={styles.privacyLeft}>
            <Ionicons name="eye-outline" size={21} color={theme.colors.textMuted} />
          <Text style={styles.privacyText}>Privacy: Private</Text>
          </View>
          <Pressable onPress={() => router.push("/dog-moment/share")}><Text style={styles.changeText}>Share later</Text></Pressable>
        </View>

        {upload.error ? <Text style={styles.error}>{upload.error.message}</Text> : null}
        <Pressable style={[styles.postButton, upload.isPending && styles.disabled]} disabled={upload.isPending} onPress={postMoment}>
          <Text style={styles.postButtonText}>{upload.isPending ? "Posting..." : "Post Today’s DogMoment"}</Text>
          <Ionicons name="paper-plane-outline" size={20} color={theme.colors.white} />
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>DogMoment</Text>
        <Pressable style={styles.calendarButton} onPress={() => router.push("/dog-moment/calendar")}>
          <Ionicons name="calendar" size={24} color={theme.colors.text} />
        </Pressable>
      </View>
      {showSaveBanner ? <SaveProgressBanner forceVisible /> : <SaveProgressBanner />}

      <View style={styles.streakCard}>
        <View style={styles.fireCircle}><Ionicons name="flame" size={28} color={theme.colors.secondary} /></View>
        <View style={styles.streakCopy}>
          <Text style={styles.streakTitle}>{dashboard.data?.streak ?? 0} Day Streak</Text>
          <Text style={styles.streakSub}>Keep the streak alive!</Text>
        </View>
        <View style={styles.goldPill}>
          <MaterialCommunityIcons name="currency-usd" size={18} color={theme.colors.gold} />
          <Text style={styles.goldText}>Daily{"\n"}Reward</Text>
        </View>
      </View>

      <View style={styles.cameraCard}>
        <LinearGradient colors={["#17301F", "#26351C", "#11100E"]} style={styles.cameraGradient}>
          <Text style={styles.cameraTitle}>Today’s DogMoment</Text>
          <Text style={styles.cameraSub}>Capture a happy moment{"\n"}with your dog today!</Text>
          <View style={styles.liveFrame}>
            <Ionicons name="camera-outline" size={76} color="rgba(255,255,255,0.82)" />
            <Text style={styles.liveFrameText}>Camera ready</Text>
          </View>
          <View style={styles.sideTools}>
            <ToolButton icon="camera-reverse-outline" />
            <ToolButton icon="flash-outline" />
            <ToolButton icon="timer-outline" />
          </View>
          <View style={styles.cameraBottom}>
            <Pressable style={styles.galleryButton} onPress={pickPhoto}>
              <Ionicons name="image-outline" size={26} color={theme.colors.white} />
            </Pressable>
            <Pressable style={styles.shutterOuter} onPress={takePhoto}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable style={styles.galleryButton}>
              <Ionicons name="happy-outline" size={26} color={theme.colors.white} />
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.todayTitle}>Today’s DogMoments</Text>
      <View style={styles.lockedFeed}>
        <View style={styles.feedGrid}>
          {recentMoments.slice(0, 4).map((moment) => moment.imageUrl ? <ExpoImage key={moment.id} source={{ uri: moment.imageUrl }} style={styles.feedTile} contentFit="cover" blurRadius={todayMoment ? 0 : 10} /> : null)}
          {recentMoments.length === 0 ? (
            <>
              <View style={[styles.feedTile, styles.feedPlaceholder]} />
              <View style={[styles.feedTile, styles.feedPlaceholderAlt]} />
              <View style={[styles.feedTile, styles.feedPlaceholderAlt]} />
              <View style={[styles.feedTile, styles.feedPlaceholder]} />
            </>
          ) : null}
        </View>
        {!todayMoment ? (
          <View style={styles.lockOverlay}>
            <View style={styles.lockIcon}><Ionicons name="lock-closed-outline" size={34} color={theme.colors.textMuted} /></View>
            <Text style={styles.lockText}>Post today’s{"\n"}DogMoment to open{"\n"}your memories.</Text>
            <Pressable style={styles.unlockButton} onPress={takePhoto}><Text style={styles.unlockText}>Unlock Feed</Text></Pressable>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const ToolButton = ({ icon }: { icon: keyof typeof Ionicons.glyphMap }) => (
  <View style={styles.toolButton}><Ionicons name={icon} size={22} color={theme.colors.white} /></View>
);

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: theme.colors.primaryDark, fontSize: 32, fontWeight: "900", letterSpacing: 0 },
  calendarButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center", ...theme.shadows.soft },
  streakCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.card, borderRadius: theme.radii.md, padding: theme.spacing.lg, ...theme.shadows.soft },
  fireCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.secondarySoft, alignItems: "center", justifyContent: "center" },
  streakCopy: { flex: 1 },
  streakTitle: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  streakSub: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 20 },
  goldPill: { minWidth: 122, borderRadius: 28, backgroundColor: theme.colors.goldSoft, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  goldText: { color: theme.colors.secondary, fontSize: theme.typography.md, fontWeight: "800", lineHeight: 20 },
  cameraCard: { borderRadius: 20, overflow: "hidden", ...theme.shadows.raised },
  cameraGradient: { minHeight: 560, padding: theme.spacing.xl },
  cameraTitle: { color: theme.colors.white, fontSize: 23, fontWeight: "900" },
  cameraSub: { color: "rgba(255,255,255,0.92)", fontSize: 17, lineHeight: 25, marginTop: theme.spacing.sm },
  liveFrame: { position: "absolute", top: 164, left: 44, right: 44, bottom: 154, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  liveFrameText: { color: "rgba(255,255,255,0.86)", fontSize: 16, fontWeight: "900", marginTop: theme.spacing.md },
  sideTools: { position: "absolute", right: theme.spacing.xl, top: 210, gap: theme.spacing.lg },
  toolButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(46,28,18,0.58)", alignItems: "center", justifyContent: "center" },
  cameraBottom: { position: "absolute", left: 28, right: 28, bottom: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  galleryButton: { width: 54, height: 54, borderRadius: 14, backgroundColor: "rgba(46,28,18,0.58)", alignItems: "center", justifyContent: "center" },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: theme.colors.white, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: theme.colors.card },
  todayTitle: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", marginTop: theme.spacing.lg },
  lockedFeed: { minHeight: 430, borderRadius: 0, overflow: "hidden" },
  feedGrid: { flexDirection: "row", flexWrap: "wrap" },
  feedTile: { width: "50%", height: 215 },
  feedPlaceholder: { backgroundColor: theme.colors.border },
  feedPlaceholderAlt: { backgroundColor: theme.colors.backgroundSoft },
  lockOverlay: { position: "absolute", left: "9%", right: "9%", top: 88, borderRadius: 28, backgroundColor: "rgba(255,252,246,0.90)", alignItems: "center", padding: theme.spacing.xl, ...theme.shadows.raised },
  lockIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.lg },
  lockText: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", textAlign: "center", lineHeight: 29 },
  unlockButton: { marginTop: theme.spacing.xl, minHeight: 52, borderRadius: theme.radii.md, backgroundColor: theme.colors.primaryDark, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  unlockText: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: "900" },
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postBrand: { color: theme.colors.primaryDark, fontSize: theme.typography.xxl, fontWeight: "900", letterSpacing: 0 },
  postTopButton: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  postTopText: { color: theme.colors.textMuted, fontSize: theme.typography.md, fontWeight: "800" },
  previewWrap: { borderRadius: 28, overflow: "hidden" },
  previewImage: { height: 438, borderRadius: 28 },
  previewActions: { position: "absolute", right: theme.spacing.lg, bottom: theme.spacing.lg, flexDirection: "row", gap: theme.spacing.sm },
  floatingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,252,246,0.92)", alignItems: "center", justifyContent: "center" },
  captionInput: { minHeight: 104, borderRadius: theme.radii.xl, backgroundColor: theme.colors.backgroundSoft, color: theme.colors.text, fontSize: theme.typography.md, padding: theme.spacing.xl, textAlignVertical: "top" },
  smallPrompt: { color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: "800", marginBottom: theme.spacing.sm },
  chipRow: { flexDirection: "row", gap: theme.spacing.sm },
  moodChip: { minHeight: 36, borderRadius: theme.radii.pill, backgroundColor: theme.colors.cardMuted, paddingHorizontal: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  moodChipActive: { backgroundColor: theme.colors.accent },
  chipText: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "900" },
  questGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  questChip: { width: "47%", minHeight: 48, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  questChipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  questText: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "900" },
  privacyRow: { minHeight: 58, borderRadius: theme.radii.lg, backgroundColor: theme.colors.backgroundSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg },
  privacyLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  privacyText: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "800" },
  changeText: { color: theme.colors.primaryDark, fontSize: theme.typography.sm, fontWeight: "800", textDecorationLine: "underline" },
  postButton: { minHeight: 58, borderRadius: theme.radii.md, backgroundColor: theme.colors.primaryDark, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: theme.spacing.sm },
  postButtonText: { color: theme.colors.white, fontSize: theme.typography.lg, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "900" },
});
