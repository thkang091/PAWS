import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { AppleLogoIcon, CaretRightIcon, CheckIcon, EnvelopeSimpleIcon, GoogleLogoIcon, ShieldCheckIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { PressScale } from "@/components/ui/PressScale";
import { useAccountStatus, useConfirmEmailLink, useFinishLink, useStartEmailLink, useStartProviderLink } from "@/hooks/useAccountStatus";
import { AUTH_CALLBACK } from "@/services/accountService";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

/** Turn auth errors into something a person can act on. */
const plain = (error: unknown, provider?: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/provider is not enabled|unsupported provider|manual linking/i.test(message)) return `${provider ?? "This sign-in"} is not turned on yet. Use email for now.`;
  if (/already (been )?registered|already exists|identity_already_exists|email_exists/i.test(message)) return "That email already belongs to another PAWS account.";
  if (/token has expired|invalid/i.test(message)) return "That code did not work. Check it, or send a new one.";
  if (/rate limit|security purposes/i.test(message)) return "Please wait a minute before asking for another code.";
  if (/network|fetch/i.test(message)) return "No connection. Check your internet and try again.";
  return "That did not work. Try again in a moment.";
};

/**
 * Account: optional. PAWS saves everything to this phone's account automatically; adding Apple, Google or an email
 * attaches a way back in to the same account, so nothing moves or is lost. Real gift cards require it.
 */
export default function AccountScreen() {
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ reason?: string; linked?: string }>();
  const forRedeem = params.reason === "redeem";
  const dog = useCurrentDog();
  const name = dog.data?.name ?? "your dog";
  const account = useAccountStatus();

  const provider = useStartProviderLink();
  const sendCode = useStartEmailLink();
  const confirm = useConfirmEmailLink();
  const finish = useFinishLink();

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const secured = account.data ? !account.data.isAnonymous && account.data.hasRecoverableIdentity : false;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const link = (which: "apple" | "google") => {
    const label = which === "apple" ? "Apple sign-in" : "Google sign-in";
    setError(null);
    void Haptics.selectionAsync();
    provider.mutate(which, {
      // Apple or Google opens inside PAWS and hands the one-time code straight back.
      onSuccess: async (url) => {
        const result = await WebBrowser.openAuthSessionAsync(url, AUTH_CALLBACK);
        if (result.type !== "success") return;
        const code = new URL(result.url).searchParams.get("code");
        finish.mutate(code, {
          onSuccess: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void account.refetch();
          },
          onError: (e) => setError(plain(e, label)),
        });
      },
      onError: (e) => setError(plain(e, label)),
    });
  };

  const send = () => {
    if (!validEmail || sendCode.isPending) return;
    setError(null);
    sendCode.mutate(email, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSentTo(email.trim());
      },
      onError: (e) => setError(plain(e)),
    });
  };

  const verify = () => {
    if (!sentTo || code.trim().length < 6 || confirm.isPending) return;
    setError(null);
    confirm.mutate(
      { email: sentTo, code },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void account.refetch();
        },
        onError: (e) => setError(plain(e)),
      },
    );
  };

  return (
    <DetailShell
      title="Account"
      glyph={<ShieldCheckIcon size={iconSize.standard} color={accent.band} weight="bold" />}
      back="/(tabs)/profile"
      action={
        secured && forRedeem
          ? { label: "Back to the Pet Shop", icon: <CaretRightIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: () => router.back() }
          : undefined
      }
    >
      <Animated.View key={secured ? "secured" : "open"} entering={reduceMotion ? undefined : enter({ y: 10 }, { duration: motion.duration.enter })} style={styles.hero}>
        <View style={[styles.mark, secured && styles.markOn]}>
          {secured ? <CheckIcon size={26} color={text.primary} weight="bold" /> : <ShieldCheckIcon size={26} color={text.primary} weight="regular" />}
        </View>
        <Text style={styles.headline}>{secured ? "Your account is secure" : "Saved on this phone"}</Text>
        <Text style={styles.body}>
          {secured
            ? `Signed in as ${account.data?.email ?? "you"}. ${name}'s progress, coins and rewards can come with you to any phone.`
            : `PAWS saves everything automatically. Add a way to sign in so ${name}'s progress, coins and rewards come with you to a new phone.`}
        </Text>
        {forRedeem && !secured ? (
          <Text style={styles.redeemNote}>Gift cards are real money, so redeeming one needs an account you can get back into. Your coins stay exactly as they are.</Text>
        ) : null}
      </Animated.View>

      {!secured ? (
        <>
          <Text style={styles.section}>Add a way to sign in</Text>
          <Text style={styles.lede}>It attaches to this account. Nothing is moved or reset.</Text>
          <View style={styles.list}>
            <Option Glyph={AppleLogoIcon} label="Continue with Apple" busy={provider.isPending && provider.variables === "apple"} onPress={() => link("apple")} />
            <Option Glyph={GoogleLogoIcon} label="Continue with Google" busy={provider.isPending && provider.variables === "google"} onPress={() => link("google")} ruled />
            <Option Glyph={EnvelopeSimpleIcon} label="Use email" open={emailOpen} onPress={() => setEmailOpen((v) => !v)} ruled />
            {emailOpen ? (
              <Animated.View entering={reduceMotion ? undefined : enter({ y: 6 }, { duration: motion.duration.enter })} style={styles.emailBox}>
                {sentTo ? (
                  <>
                    <Text style={styles.small}>{`We sent a 6-digit code to ${sentTo}.`}</Text>
                    <TextInput
                      style={[styles.input, styles.code]}
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor={text.tertiary}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      accessibilityLabel="Code from the email"
                    />
                    <Button label={confirm.isPending ? "Confirming..." : "Confirm"} disabled={code.length < 6 || confirm.isPending} onPress={verify} />
                    <PressScale accessibilityRole="button" accessibilityLabel="Use a different email" scaleTo={0.96} style={styles.quiet} onPress={() => setSentTo(null)}>
                      <Text style={styles.quietText}>Use a different email</Text>
                    </PressScale>
                  </>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={text.tertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      accessibilityLabel="Email"
                    />
                    <Button label={sendCode.isPending ? "Sending..." : "Send code"} disabled={!validEmail || sendCode.isPending} onPress={send} />
                  </>
                )}
              </Animated.View>
            ) : null}
          </View>
        </>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </DetailShell>
  );
}

const Option = ({ Glyph, label, onPress, busy = false, open, ruled = false }: { Glyph: typeof AppleLogoIcon; label: string; onPress: () => void; busy?: boolean; open?: boolean; ruled?: boolean }) => (
  <PressScale accessibilityRole="button" accessibilityState={{ busy, expanded: open }} accessibilityLabel={label} scaleTo={0.98} style={[styles.row, ruled && styles.ruled]} onPress={onPress}>
    <View style={styles.disc}>
      <Glyph size={iconSize.standard} color={text.primary} weight="fill" />
    </View>
    <Text style={styles.rowLabel}>{busy ? "Opening..." : label}</Text>
    <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" style={open ? styles.caretOpen : undefined} />
  </PressScale>
);

const Button = ({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) => (
  <PressScale accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={label} disabled={disabled} scaleTo={0.97} style={[styles.button, disabled && styles.buttonOff]} onPress={onPress}>
    <Text style={[styles.buttonText, disabled && styles.buttonTextOff]}>{label}</Text>
  </PressScale>
);

const styles = StyleSheet.create({
  hero: { marginTop: space.lg, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  mark: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  markOn: { backgroundColor: accent.deep },
  headline: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary, marginTop: space.lg },
  body: { ...type.supporting, color: text.secondary, marginTop: space.sm },
  redeemNote: { ...type.supporting, fontWeight: "600", color: text.primary, marginTop: space.md },
  section: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.section },
  lede: { ...type.supporting, color: text.secondary, marginTop: 2, marginBottom: space.lg },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  rowLabel: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
  caretOpen: { transform: [{ rotate: "90deg" }] },
  emailBox: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  small: { ...type.supporting, color: text.secondary },
  input: { height: 52, marginTop: space.sm, paddingHorizontal: space.lg, borderRadius: radius.control + 2, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary },
  code: { fontSize: 24, letterSpacing: 8, fontVariant: ["tabular-nums"], textAlign: "center" },
  button: { height: layout.controlHeight, marginTop: space.md, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  buttonOff: { backgroundColor: bg.subtle },
  buttonText: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  buttonTextOff: { color: text.disabled },
  quiet: { alignSelf: "center", paddingVertical: space.md },
  quietText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  error: { ...type.supporting, color: text.primary, marginTop: space.lg, padding: space.md, borderRadius: radius.control, backgroundColor: accent.soft },
});
