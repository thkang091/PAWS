import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { features } from "@/config/features";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { theme } from "@/constants/theme";
import { useSelectPlan, useSubscriptionPlans } from "@/hooks/usePlanSelection";
import type { SubscriptionPlan } from "@/types/domain";

const PlanCard = ({ plan, onSelect, loading }: { plan: SubscriptionPlan; onSelect: () => void; loading: boolean }) => {
  const disabled = plan.isPaid && !features.paidPlansEnabled;
  return (
    <AppCard>
      <View style={styles.plan}>
        <View style={styles.row}>
          <Text style={styles.planTitle}>{plan.name}</Text>
          <Badge label={plan.isPaid ? "Billing required" : "Works now"} tone={plan.isPaid ? "warning" : "success"} />
        </View>
        <Text style={styles.copy}>{plan.description}</Text>
        {plan.priceDisplay ? <Text style={styles.price}>{plan.priceDisplay}</Text> : null}
        {plan.features.map((feature) => <Text key={feature} style={styles.feature}>• {feature}</Text>)}
        {disabled ? <Text style={styles.warning}>Paid checkout is intentionally disabled until billing is configured.</Text> : null}
        <AppButton title={disabled ? "Unavailable" : "Select plan"} disabled={disabled} loading={loading} onPress={onSelect} />
      </View>
    </AppCard>
  );
};

export default function PlanSelectionScreen() {
  const plans = useSubscriptionPlans();
  const select = useSelectPlan();

  if (plans.isLoading) return <ScreenContainer centered><LoadingState message="Loading plans..." /></ScreenContainer>;
  if (plans.error) return <ScreenContainer centered><ErrorState message={plans.error.message} onRetry={() => void plans.refetch()} /></ScreenContainer>;

  return (
    <ScreenContainer scroll>
      <SectionHeader title="Choose your PAWS plan" subtitle="Free works today. Paid plans stay locked until billing is really configured." />
      {plans.data?.map((plan) => (
        <PlanCard key={plan.id} plan={plan} loading={select.isPending} onSelect={() => select.mutate(plan, { onSuccess: () => router.replace("/tutorial") })} />
      ))}
      {select.error ? <Text style={styles.warning}>{select.error.message}</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  plan: { gap: theme.spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  planTitle: { flex: 1, color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22 },
  price: { color: theme.colors.secondary, fontSize: theme.typography.md, fontWeight: "900" },
  feature: { color: theme.colors.text, fontSize: theme.typography.sm, lineHeight: 20 },
  warning: { color: theme.colors.warning, fontSize: theme.typography.sm, fontWeight: "700" },
});
