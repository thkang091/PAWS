import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { queryKeys } from "@/constants/queryKeys";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useReferenceAssets } from "@/hooks/useReferenceAssets";
import { getClientOrThrow } from "@/services/serviceUtils";
import { saveReferenceAsset } from "@/services/curriculumService";
import type { ReferenceAssetType } from "@/types/domain";

// ── Asset display metadata ────────────────────────────────────────────────────

const ASSET_META: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; description: string; instructions: string[] }
> = {
  DOG_PROFILE: {
    label: "Dog Profile Photo",
    icon: "paw-outline",
    description:
      "A clear front-facing photo of your dog's face. Gemini uses this to confirm the right dog is in every training video you submit.",
    instructions: [
      "Photograph your dog in good natural or indoor lighting.",
      "Face the camera directly — eyes and nose should both be clearly visible.",
      "Avoid filters, cropping the face, or photos where the dog is moving.",
      "One photo is enough; 2–3 from slightly different angles helps more.",
    ],
  },
  TARGET_MAT: {
    label: "Training Mat",
    icon: "grid-outline",
    description:
      "A photo of the mat your dog will stand, sit, or lie on. Gemini matches this against the mat visible in your training videos.",
    instructions: [
      "Place the mat on a plain floor with no other rugs or mats nearby.",
      "Photograph from directly above so the full shape, color, and texture are visible.",
      "Include the full mat — don't crop the edges.",
      "Good lighting is important — shadows obscure the texture pattern.",
    ],
  },
  TARGET_TOY: {
    label: "Training Toy",
    icon: "tennisball-outline",
    description:
      "A photo of the toy used as a target or reward in training. Gemini checks that the same toy appears in your video.",
    instructions: [
      "Place the toy on a plain surface with nothing else nearby.",
      "Photograph from an angle that shows its distinctive shape and color.",
      "Ensure the toy is in good focus.",
    ],
  },
  TARGET_CRATE: {
    label: "Dog Crate",
    icon: "home-outline",
    description:
      "A photo of your dog's crate. Gemini verifies that the dog enters the same crate visible in your training video.",
    instructions: [
      "Photograph the crate with the door open and from a slight angle so depth is visible.",
      "Ensure the full crate fits in the frame.",
      "Include enough surrounding context to distinguish it from other objects.",
    ],
  },
  TARGET_DOORWAY: {
    label: "Target Doorway",
    icon: "exit-outline",
    description:
      "A photo of the doorway or threshold used in training. Gemini checks the dog is waiting at the correct doorway.",
    instructions: [
      "Stand inside looking toward the door — capture the full door frame, threshold, and the door itself.",
      "Include the floor area on both sides of the threshold.",
      "Make sure the photo is taken in the same location you'll use for training.",
    ],
  },
  TARGET_BOWL: {
    label: "Food Bowl",
    icon: "nutrition-outline",
    description:
      "A photo of the food bowl used in training. Gemini matches this to verify the dog is waiting at the correct bowl.",
    instructions: [
      "Place the bowl empty on the floor and photograph from slightly above.",
      "The bowl's shape, color, and any patterns should be clearly visible.",
    ],
  },
  TARGET_BUTTON: {
    label: "Training Button",
    icon: "radio-button-on-outline",
    description:
      "A photo of the communication button your dog will press. Gemini tracks button presses in your training video.",
    instructions: [
      "Photograph the button on the surface it will be trained on.",
      "Make sure the button label (if any) is visible.",
    ],
  },
  TARGET_BELL: {
    label: "Bell",
    icon: "notifications-outline",
    description:
      "A photo of the bell your dog will ring to signal. Gemini listens for bell sounds and matches the visual.",
    instructions: [
      "Photograph the bell mounted in its usual training position.",
      "Show any rope or attachment so Gemini can confirm the setup.",
    ],
  },
  TARGET_PLATFORM: {
    label: "Training Platform",
    icon: "layers-outline",
    description:
      "A photo of the raised platform or box your dog will stand on.",
    instructions: [
      "Place the platform on a plain floor.",
      "Photograph from an angle that shows its height and surface area.",
    ],
  },
  TARGET_CONE: {
    label: "Target Cone",
    icon: "triangle-outline",
    description: "A photo of the cone used as a target in training.",
    instructions: [
      "Place the cone on a plain floor.",
      "Photograph so the color and shape are clearly visible.",
    ],
  },
  TARGET_BOX: {
    label: "Target Box",
    icon: "cube-outline",
    description: "A photo of the box your dog will paw, stand in, or interact with.",
    instructions: [
      "Photograph the box with the opening facing the camera.",
      "Show the size of the box relative to surrounding objects if possible.",
    ],
  },
  TARGET_DRAWER: {
    label: "Target Drawer",
    icon: "file-tray-outline",
    description: "A photo of the drawer your dog will open or close.",
    instructions: [
      "Photograph the closed drawer at eye level.",
      "Include enough of the surrounding furniture for context.",
    ],
  },
  TARGET_PERSON: {
    label: "Helper Person",
    icon: "person-outline",
    description:
      "A photo of the helper person who will appear in your training video as a distraction or greeting target.",
    instructions: [
      "Full front-facing photo of the helper.",
      "Consistent clothing isn't required but helps Gemini match across clips.",
    ],
  },
  CUSTOM_OBJECT: {
    label: "Custom Training Object",
    icon: "cube-outline",
    description: "A photo of any custom prop or target object used in training.",
    instructions: [
      "Photograph the object from the angle it will appear in your training video.",
    ],
  },
};

const DEFAULT_META = {
  label: "Reference Photo",
  icon: "image-outline" as keyof typeof Ionicons.glyphMap,
  description: "A reference photo for Gemini to use during video verification.",
  instructions: ["Take a clear, well-lit photo of the required object."],
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReferenceSetupScreen() {
  const { assetType } = useLocalSearchParams<{ assetType: string }>();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const userId = dog.data?.ownerId;

  const { assets, refetch: refetchAssets } = useReferenceAssets(dogId);
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (dog.isLoading) {
    return <ScreenContainer centered><LoadingState message="Loading..." /></ScreenContainer>;
  }

  if (!dog.data || !dogId || !userId) {
    return (
      <ScreenContainer centered>
        <ErrorState message="Dog profile not found." />
      </ScreenContainer>
    );
  }

  const normalizedType = (assetType ?? "").toUpperCase() as ReferenceAssetType;
  const meta = ASSET_META[normalizedType] ?? DEFAULT_META;

  const existing = assets.filter((a) => a.assetType === normalizedType);
  const hasExisting = existing.length > 0;

  const pickAndUpload = async () => {
    setUploadError(null);

    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission required", "Please allow photo library access in Settings.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setLocalUri(asset.uri);

    try {
      setUploading(true);
      const client = getClientOrThrow();

      // Download bytes from the local URI
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const ext = asset.uri.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const timestamp = Date.now();
      const storagePath = `${userId}/${dogId}/reference/${normalizedType}/${timestamp}.${ext}`;

      const { error: uploadError } = await client.storage
        .from("dog-activity-photos")
        .upload(storagePath, arrayBuffer, {
          contentType: ext === "png" ? "image/png" : "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      await saveReferenceAsset(dogId, normalizedType, storagePath, meta.label);

      await queryClient.invalidateQueries({ queryKey: queryKeys.referenceAssets(dogId) });
      await refetchAssets();

      // Success — let the user know and offer to go back
      Alert.alert(
        "Reference photo saved",
        `Your ${meta.label} photo is ready. Gemini will use it during video verification.`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed. Please try again.";
      setUploadError(message);
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      {/* Back */}
      <Pressable style={s.back} onPress={() => router.back()} accessibilityRole="button">
        <Ionicons name="chevron-back" size={18} color={theme.colors.primaryDark} />
        <Text style={s.backText}>Activity</Text>
      </Pressable>

      {/* Header */}
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name={meta.icon} size={28} color={theme.colors.primaryDark} />
        </View>
        <Text style={s.title}>{meta.label}</Text>
        <Text style={s.description}>{meta.description}</Text>
      </View>

      {/* Existing photos */}
      {hasExisting && (
        <View style={s.existingCard}>
          <View style={s.existingHeader}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={s.existingTitle}>
              {existing.length} photo{existing.length > 1 ? "s" : ""} saved
            </Text>
          </View>
          <Text style={s.existingHint}>
            Gemini already has a reference for this item. Upload another to replace or add to it.
          </Text>
        </View>
      )}

      {/* Preview */}
      {localUri && !uploading && (
        <View style={s.previewCard}>
          <Image source={{ uri: localUri }} style={s.previewImage} resizeMode="cover" />
        </View>
      )}

      {/* Instructions */}
      <View style={s.instructionsCard}>
        <Text style={s.sectionLabel}>PHOTO TIPS</Text>
        {meta.instructions.map((tip, i) => (
          <View key={i} style={s.tipRow}>
            <View style={s.tipDot} />
            <Text style={s.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Error */}
      {uploadError ? (
        <View style={s.errorCard}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
          <Text style={s.errorText}>{uploadError}</Text>
        </View>
      ) : null}

      {/* CTA */}
      <Pressable
        style={[s.uploadBtn, uploading && s.uploadBtnLoading]}
        onPress={pickAndUpload}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={uploading ? "Uploading photo" : "Choose photo from library"}
      >
        <Ionicons
          name={uploading ? "cloud-upload-outline" : hasExisting ? "add-circle-outline" : "camera-outline"}
          size={18}
          color="#fff"
        />
        <Text style={s.uploadBtnText}>
          {uploading
            ? "Uploading…"
            : hasExisting
            ? "Add another photo"
            : "Choose photo from library"}
        </Text>
      </Pressable>

      {hasExisting && (
        <Pressable
          style={s.doneBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={s.doneBtnText}>Done — go back to activity</Text>
        </Pressable>
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },

  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: theme.typography.xl,
    fontWeight: "900",
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    lineHeight: 21,
  },

  existingCard: {
    backgroundColor: theme.colors.successSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  existingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  existingTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "800",
    color: theme.colors.success,
  },
  existingHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.success,
    opacity: 0.85,
  },

  previewCard: {
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    aspectRatio: 1,
    backgroundColor: theme.colors.cardMuted,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },

  instructionsCard: {
    backgroundColor: theme.colors.backgroundSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tipRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.errorSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.error,
    fontWeight: "700",
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radii.pill,
    paddingVertical: 15,
    minHeight: 52,
  },
  uploadBtnLoading: { opacity: 0.65 },
  uploadBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: "#fff",
  },

  doneBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },
});
