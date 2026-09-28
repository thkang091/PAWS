import { StyleSheet, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { theme } from "@/constants/theme";

export const DogMomentUploader = ({
  caption,
  setCaption,
  loading,
  onPicked,
}: {
  caption: string;
  setCaption: (value: string) => void;
  loading: boolean;
  onPicked: (asset: ImagePicker.ImagePickerAsset) => void;
}) => {
  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) onPicked(asset);
  };

  return (
    <AppCard>
      <Text style={styles.title}>Today’s Dog Moment</Text>
      <Text style={styles.copy}>Choose a real photo from your library. One rewarded moment is allowed per day.</Text>
      <AppTextInput label="Caption" value={caption} onChangeText={setCaption} placeholder="A tiny win from today" />
      <AppButton title="Choose photo" loading={loading} onPress={pick} />
    </AppCard>
  );
};

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900", marginBottom: theme.spacing.sm },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginBottom: theme.spacing.md },
});
