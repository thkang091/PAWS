import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRightIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
} from "phosphor-react-native";

import { ClinicMark } from "@/features/care/components/KitArt";
import { MonthPicker, type PickedDay } from "@/features/care/components/MonthPicker";
import { TimeGrid } from "@/features/care/components/TimeGrid";
import { openLink } from "@/lib/openLink";
import { TIME_SLOTS, prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import type { Booking, Clinic } from "@/services/vetDirectory";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const CLINIC_HOURS = TIME_SLOTS.filter((time) => {
  const hour = Number(time.slice(0, 2));
  return hour >= 8 && hour <= 18;
});

export const ClinicCard = ({
  clinic,
  order,
  booking,
  reduceMotion,
  onBook,
}: {
  clinic: Clinic;
  order: number;
  booking: Booking | null;
  reduceMotion: boolean;
  onBook: (booking: Booking | null) => void;
}) => {
  const mine = booking?.clinicId === clinic.id;
  const [confirming, setConfirming] = useState(mine);
  const [day, setDay] = useState<string | null>(mine ? (booking?.dayKey ?? null) : null);
  const [dayLabel, setDayLabel] = useState<string | null>(mine ? (booking?.day ?? null) : null);
  const [via, setVia] = useState<Booking["via"]>(clinic.bookOnline ? "online" : "phone");
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const woken = useSharedValue(day ? 1 : 0);
  useEffect(() => {
    woken.value = reduceMotion
      ? day
        ? 1
        : 0
      : withTiming(day ? 1 : 0, {
          duration: motion.duration.enter,
          easing: motion.easing.out,
        });
  }, [day, reduceMotion, woken]);

  const wake = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * woken.value }));

  const handoff = (url: string, fallback: string, route: Booking["via"]) => {
    void Haptics.selectionAsync();
    setVia(route);
    void openLink(url).then((opened) => setUnreachable(opened ? null : fallback));
    setConfirming(true);
  };

  const pickTime = (time: string) => {
    if (!day || !dayLabel) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next: Booking = {
      clinicId: clinic.id,
      clinicName: clinic.name,
      dayKey: day,
      day: dayLabel,
      time,
      phone: clinic.phone,
      address: clinic.address || null,
      via,
    };
    onBook(mine && booking?.time === time && booking?.dayKey === day ? null : next);
  };

  return (
    <Animated.View
      entering={
        reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 60)
      }
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
      style={[styles.card, mine && styles.cardOn]}
    >
      <View style={styles.head}>
        {clinic.thumbnail ? (
          <Image
            source={{ uri: clinic.thumbnail }}
            style={styles.photo}
            contentFit="cover"
            transition={180}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.markFrame}>
            <ClinicMark size={34} />
          </View>
        )}

        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={2}>
            {clinic.name}
          </Text>

          {clinic.rating !== null ? (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingValue}>{clinic.rating.toFixed(1)}</Text>
              <StarIcon size={11} color={accent.band} weight="fill" />
              {clinic.reviews ? (
                <Text style={styles.meta}>({clinic.reviews.toLocaleString()})</Text>
              ) : null}
              {clinic.distance ? <Text style={styles.meta}>· {clinic.distance}</Text> : null}
            </View>
          ) : clinic.distance ? (
            <Text style={styles.meta}>{clinic.distance}</Text>
          ) : null}

          {clinic.openState ? (
            <Text style={styles.open} numberOfLines={1}>
              {clinic.openState}
            </Text>
          ) : null}
        </View>
      </View>

      {clinic.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {clinic.address}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {clinic.bookOnline ? (
          <PressScale
            accessibilityRole="link"
            accessibilityLabel={`Book online with ${clinic.name}`}
            scaleTo={0.96}
            style={[styles.action, styles.actionPrimary]}
            onPress={() =>
              handoff(
                clinic.bookOnline as string,
                `Booking page: ${clinic.bookOnline}`,
                "online",
              )
            }
          >
            <Text style={styles.actionPrimaryText}>Book online</Text>
            <ArrowUpRightIcon size={13} color={text.primary} weight="bold" />
          </PressScale>
        ) : null}

        {clinic.phone ? (
          <PressScale
            accessibilityRole="link"
            accessibilityLabel={`Call ${clinic.name} on ${clinic.phone}`}
            scaleTo={0.96}
            style={[styles.action, !clinic.bookOnline && styles.actionPrimary]}
            onPress={() =>
              handoff(
                `tel:${clinic.phone?.replace(/[^\d+]/g, "")}`,
                `No dialler on this device. Call ${clinic.phone}.`,
                "phone",
              )
            }
          >
            <PhoneIcon size={13} color={text.primary} weight="bold" />
            <Text style={clinic.bookOnline ? styles.actionText : styles.actionPrimaryText}>
              {clinic.bookOnline ? "Call" : clinic.phone}
            </Text>
          </PressScale>
        ) : null}

        <PressScale
          accessibilityRole="link"
          accessibilityLabel={`Directions to ${clinic.name}`}
          scaleTo={0.96}
          style={styles.action}
          onPress={() => {
            void Haptics.selectionAsync();
            const query = encodeURIComponent(`${clinic.name} ${clinic.address}`);
            void openLink(
              Platform.OS === "ios"
                ? `http://maps.apple.com/?q=${query}`
                : `geo:0,0?q=${query}`,
            ).then((opened) =>
              setUnreachable(opened ? null : `No maps app here. ${clinic.address}`),
            );
          }}
        >
          <MapPinIcon size={13} color={text.primary} weight="bold" />
          <Text style={styles.actionText}>Directions</Text>
        </PressScale>
      </View>

      {unreachable ? (
        <Animated.Text
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
          style={styles.unreachable}
          selectable
        >
          {unreachable}
        </Animated.Text>
      ) : null}

      {confirming ? (
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.duration(motion.duration.enter)
                  .withInitialValues({ transform: [{ translateY: -6 }] })
          }
          style={styles.confirm}
        >
          <Text style={styles.confirmHead}>
            {mine
              ? `On the schedule: ${booking?.day} at ${prettyTime(booking?.time ?? "")}`
              : via === "phone"
                ? "What time did they give you?"
                : "Booked it? Put it on the schedule."}
          </Text>

          <MonthPicker
            selected={day}
            reduceMotion={reduceMotion}
            onPick={(picked: PickedDay) => {
              setDay(picked.key);
              setDayLabel(picked.label);
            }}
          />

          <Animated.View style={wake} pointerEvents={day ? "auto" : "none"}>
            <TimeGrid
              slots={mine && booking ? [booking.time] : []}
              times={CLINIC_HOURS}
              animateIn={false}
              reduceMotion={reduceMotion}
              onToggle={pickTime}
            />
          </Animated.View>

          {!day ? <Text style={styles.hint}>Pick the day first.</Text> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    padding: space.lg,
    gap: space.md,
  },
  cardOn: { borderColor: accent.deep, backgroundColor: accent.soft },

  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  photo: { width: 54, height: 54, borderRadius: radius.control, backgroundColor: bg.subtle },
  markFrame: {
    width: 54,
    height: 54,
    borderRadius: radius.control,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 2 },
  name: { ...type.cardTitle, color: text.primary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  ratingValue: { ...type.caption, fontWeight: "600", color: text.primary },
  meta: { ...type.caption, color: text.secondary },
  open: { ...type.caption, color: text.tertiary },
  address: { ...type.caption, color: text.secondary },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  actionPrimary: { backgroundColor: accent.deep, borderColor: accent.deep },
  actionText: { ...type.caption, fontWeight: "600", color: text.primary },
  actionPrimaryText: { ...type.caption, fontWeight: "600", color: text.primary },

  unreachable: { ...type.caption, color: text.secondary },
  confirm: {
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: border.soft,
    paddingTop: space.md,
  },
  hint: { ...type.caption, color: text.tertiary },
  confirmHead: { ...type.caption, fontWeight: "600", color: text.primary },
});
