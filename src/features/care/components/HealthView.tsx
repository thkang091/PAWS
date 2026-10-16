import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  CalendarPlusIcon,
  FileTextIcon,
  FirstAidKitIcon,
  PillIcon,
} from "phosphor-react-native";

import { requestCheckIn } from "@/features/care/components/CheckInLock";
import { FlowSheet } from "@/features/care/components/FlowSheet";
import { GroomingSetupPrompt } from "@/features/care/components/GroomingSetupPrompt";
import { DaySummary } from "@/features/care/components/HealthCheckIn";
import { HealthLongTerm } from "@/features/care/components/HealthLongTerm";
import { HealthToday } from "@/features/care/components/HealthToday";
import { PharmacyGlyph } from "@/features/care/components/PharmacyGlyph";
import { QUICK_SERVICES } from "@/features/care/components/healthData";
import { useTodayCheckIn } from "@/features/care/state/dailyCheckIn";
import { useGroomingPrompt } from "@/features/care/state/groomingSetup";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  accent,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

type PhosphorIcon = typeof PillIcon;

const SERVICE_GLYPH: Record<string, PhosphorIcon> = {
  records: FileTextIcon,
  appointment: CalendarPlusIcon,
  pharmacy: PharmacyGlyph as PhosphorIcon,
  emergency: FirstAidKitIcon,
};

export const HealthView = memo(
  ({
    dogId,
    week,
    onOpen,
    onSetUpGrooming,
  }: {
    dogId?: string;
    week: readonly Date[];
    onOpen: (href: string) => void;
    onSetUpGrooming: () => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const dog = useCurrentDog();
    const dogName = dog.data?.name ?? "your dog";
    const { due: groomingDue } = useGroomingPrompt();
    const { entry } = useTodayCheckIn();
    const [summaryOpen, setSummaryOpen] = useState(false);

    const enter = (order: number) =>
      reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).delay(order * 70).easing(motion.easing.out);

    return (
      <View>
        <Animated.View entering={enter(0)}>
          <Text style={styles.sectionTitle}>Today</Text>
          <Text style={styles.sectionLede}>{`The daily things that keep ${dogName} well.`}</Text>
          <HealthToday
            dogId={dogId}
            dogName={dogName}
            onCheckIn={requestCheckIn}
            onViewCheckIn={() => setSummaryOpen(true)}
            onOpenMeds={() => onOpen("/care/medications")}
          />
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Text style={styles.sectionTitle}>Care plan</Text>
          <Text style={styles.sectionLede}>Shots, medicine and what a vet should know.</Text>
          <HealthLongTerm dogId={dogId} dogName={dogName} week={week} onOpen={onOpen} />
          {groomingDue ? <GroomingSetupPrompt onSetUp={onSetUpGrooming} /> : null}
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <Text style={styles.sectionTitle}>Quick services</Text>
          <View style={styles.services}>
            {QUICK_SERVICES.map((service) => {
              const Glyph = SERVICE_GLYPH[service.key] ?? FileTextIcon;
              return (
                <PressScale
                  key={service.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${service.label}. ${service.hint}`}
                  scaleTo={0.97}
                  style={styles.service}
                  onPress={() => onOpen(service.href)}
                >
                  <View style={styles.serviceDisc}>
                    <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                  </View>
                  <Text style={styles.serviceLabel} numberOfLines={2}>
                    {service.label}
                  </Text>
                  <Text style={styles.serviceHint} numberOfLines={2}>
                    {service.hint}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        </Animated.View>


        <FlowSheet
          open={summaryOpen && Boolean(entry)}
          title="Tonight's check-in"
          step={0}
          total={1}
          direction={1}
          primary={{ label: "Done", onPress: () => setSummaryOpen(false) }}
          onBack={() => setSummaryOpen(false)}
          onClose={() => setSummaryOpen(false)}
        >
          {entry ? <DaySummary entry={entry} dogName={dogName} date={new Date()} isToday /> : null}
        </FlowSheet>
      </View>
    );
  },
);

HealthView.displayName = "HealthView";

const styles = StyleSheet.create({
  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.section },
  sectionLede: { ...type.supporting, color: text.secondary, marginTop: 2, marginBottom: space.lg },
  services: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.lg },
  service: {
    width: "47.5%",
    flexGrow: 1,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  serviceDisc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabel: {
    ...type.cardTitle,
    fontWeight: "600",
    color: text.primary,
    marginTop: space.md,
  },
  serviceHint: { ...type.caption, color: text.tertiary, marginTop: 3 },
});
