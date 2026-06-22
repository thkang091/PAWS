import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { useBackendHealthCheck } from "@/hooks/useBackendHealthCheck";
import { theme } from "@/constants/theme";

export const BackendHealthCheckPanel = () => {
  const health = useBackendHealthCheck();

  if (!__DEV__) return null;

  return (
    <AppCard>
      <View style={styles.header}>
        <Text style={styles.title}>Backend health</Text>
        <AppButton title="Run" variant="ghost" onPress={() => void health.refetch()} />
      </View>
      {(health.data ?? []).map((item) => (
        <View key={item.key} style={styles.row}>
          <Badge label={item.status} tone={item.status === "pass" ? "success" : item.status === "warning" ? "warning" : "error"} />
          <View style={styles.copyWrap}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.message}>{item.message}</Text>
          </View>
        </View>
      ))}
      {health.isLoading ? <Text style={styles.message}>Checking live backend...</Text> : null}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  row: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.md },
  copyWrap: { flex: 1 },
  label: { color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: "900" },
  message: { color: theme.colors.textMuted, fontSize: theme.typography.xs, marginTop: theme.spacing.xs },
});
