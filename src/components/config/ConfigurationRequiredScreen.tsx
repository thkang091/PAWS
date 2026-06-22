import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AppCard } from "@/components/ui/AppCard";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";

type ConfigurationRequiredScreenProps = {
  missingVariables: string[];
  message: string;
};

export const ConfigurationRequiredScreen = ({
  missingVariables,
  message,
}: ConfigurationRequiredScreenProps) => (
  <ScreenContainer centered>
    <AppCard>
      <View style={styles.content}>
        <MaterialCommunityIcons
          color={theme.colors.warning}
          name="tools"
          size={theme.iconSizes.xl}
        />
        <Text style={styles.title}>Supabase setup required</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.copy}>
          Copy `.env.example` to `.env`, then add your Supabase project URL and public anon key.
        </Text>
        <View style={styles.list}>
          {(missingVariables.length > 0
            ? missingVariables
            : ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]
          ).map((variable) => (
            <Text key={variable} style={styles.variable}>
              {variable}
            </Text>
          ))}
        </View>
      </View>
    </AppCard>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: "900",
  },
  message: {
    color: theme.colors.warning,
    fontSize: theme.typography.md,
    fontWeight: "700",
    lineHeight: 22,
  },
  copy: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 22,
  },
  list: {
    gap: theme.spacing.sm,
  },
  variable: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "800",
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
