import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useFinishLink } from "@/hooks/useAccountStatus";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, layout, radius, space, text, type } from "@/constants/design";

/** Apple, Google and email confirmations come back here. Finish the link on the same account, then go back. */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const finish = useFinishLink();
  const [failed, setFailed] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    if (params.error_description) return;
    finish.mutate(params.code ?? null, {
      onSuccess: () => router.replace("/account/link?linked=1" as never),
      onError: (e) => setFailed(e instanceof Error ? e.message : "Linking did not finish."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{failed ? "That did not link" : "Finishing up..."}</Text>
      {failed ? (
        <>
          <Text style={styles.body}>{`${failed} Your PAWS data is safe on this phone.`}</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Back to Account" scaleTo={0.97} style={styles.button} onPress={() => router.replace("/account/link" as never)}>
            <Text style={styles.buttonText}>Back to Account</Text>
          </PressScale>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas, justifyContent: "center", paddingHorizontal: layout.gutter },
  title: { ...type.pageTitle, color: text.primary },
  body: { ...type.body, color: text.secondary, marginTop: space.md },
  button: { height: layout.controlHeight, marginTop: space.xl, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  buttonText: { ...type.cardTitle, fontWeight: "600", color: text.primary },
});
