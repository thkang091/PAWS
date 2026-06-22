import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAccountStatus, useSendLinkAccountEmail } from "@/hooks/useAccountStatus";
import { theme } from "@/constants/theme";

export default function LinkAccountScreen() {
  const [email, setEmail] = useState("");
  const account = useAccountStatus();
  const sendEmail = useSendLinkAccountEmail();

  return (
    <ScreenContainer scroll>
      <SectionHeader title="Save your progress" subtitle="Link a recoverable identity so your dog’s memories, streaks, and rewards survive phone changes." />
      <AppCard>
        <Text style={styles.title}>{account.data?.isAnonymous ? "Anonymous account" : "Recoverable account"}</Text>
        <Text style={styles.copy}>Email OTP can be configured through Supabase Auth. This screen sends an email link without creating a disconnected account.</Text>
        <AppTextInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        <AppButton title="Send magic link" loading={sendEmail.isPending} onPress={() => sendEmail.mutate(email)} />
        {sendEmail.isSuccess ? <Text style={styles.success}>Check your email for the sign-in link.</Text> : null}
        {sendEmail.error ? <Text style={styles.error}>{sendEmail.error.message}</Text> : null}
      </AppCard>
      <AppCard>
        <Text style={styles.title}>OAuth providers</Text>
        <Text style={styles.copy}>Google and Apple sign-in require Supabase dashboard provider credentials. Buttons stay disabled until that external setup exists.</Text>
        <AppButton title="Google sign-in requires setup" disabled variant="secondary" />
        <AppButton title="Apple sign-in requires setup" disabled variant="secondary" />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900", marginBottom: theme.spacing.sm },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginBottom: theme.spacing.md },
  success: { color: theme.colors.success, fontSize: theme.typography.sm, fontWeight: "800", marginTop: theme.spacing.md },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "800", marginTop: theme.spacing.md },
});
