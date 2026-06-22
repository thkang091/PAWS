import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { ActivityVerificationStatus } from "@/types/activityVerification";

const passedStatuses: ActivityVerificationStatus[] = ["passed", "user_confirmed", "manual_review"];

export const VerificationResultCard = ({
  status,
  retryGuidance,
}: {
  status: ActivityVerificationStatus | string;
  retryGuidance?: string | null;
}) => {
  const passed = passedStatuses.includes(status as ActivityVerificationStatus);
  return (
    <AppCard>
      <Text style={styles.title}>{passed ? "Verification saved" : "Needs another try"}</Text>
      <Text style={styles.copy}>
        {passed
          ? "The activity record is stored. Rewards and ranked scores still require trusted backend processing."
          : retryGuidance ?? "PAWS could not verify this reliably. Retake with clearer framing and lighting."}
      </Text>
      <Text style={styles.status}>Status: {status.replaceAll("_", " ")}</Text>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.sm },
  status: { color: theme.colors.primary, fontSize: theme.typography.sm, fontWeight: "900", marginTop: theme.spacing.md },
});
