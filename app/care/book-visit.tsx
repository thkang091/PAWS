import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRightIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  CheckIcon,
  MapTrifoldIcon,
  PhoneIcon,
  StarIcon,
  XIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { PlaceField } from "@/features/care/components/PlaceField";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import {
  bookVisit,
  cancelVisit,
  saveHome,
  useCareLocations,
  type SavedClinic,
  type SavedPlace,
  type Visit,
} from "@/features/care/state/careLocations";
import { recordVaccineBooking } from "@/features/care/state/careOnboarding";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { openLink } from "@/lib/openLink";
import { directionsUrl, mapsSearchUrl } from "@/services/placeSearch";
import { upsertCareEvent } from "@/services/careService";
import type { Feed } from "@/services/serpApi";
import { findClinics, type Clinic } from "@/services/vetDirectory";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const REASONS = ["Check-up", "Vaccines", "Feeling unwell", "Follow-up", "Dental", "Skin or ears"] as const;

const TIMES: readonly string[] = Array.from({ length: 21 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayLabel = (key: string) => {
  const d = fromKey(key);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
};

const nextDays = (count: number) => {
  const start = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      key: isoDate(d),
      top: i === 0 ? "Today" : i === 1 ? "Tmrw" : WEEKDAY[d.getDay()],
      date: d.getDate(),
    };
  });
};

const toSaved = (clinic: Clinic): SavedClinic => ({
  id: clinic.id,
  name: clinic.name,
  address: clinic.address || null,
  phone: clinic.phone,
});

export default function BookVisitScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogName = dog.data?.name ?? "your dog";
  const { home, clinics: savedClinics, visits } = useCareLocations();

  const today = isoDate(new Date());
  const days = useMemo(() => nextDays(14), []);
  const lastVisit = visits[0] ?? null;

  const [place, setPlace] = useState<SavedPlace | null>(home);
  const [clinic, setClinic] = useState<SavedClinic | null>(lastVisit?.clinic ?? savedClinics[0] ?? null);
  const [otherName, setOtherName] = useState("");
  const [dayKey, setDayKey] = useState(days[1].key);
  const [time, setTime] = useState(lastVisit?.time ?? "10:00");
  const params = useLocalSearchParams<{ reason?: string }>();
  const [reason, setReason] = useState<string>(
    REASONS.find((item) => item === params.reason) ?? REASONS[0],
  );
  const [justBooked, setJustBooked] = useState<Visit | null>(null);
  const [nearby, setNearby] = useState<Feed<Clinic>>({ state: "idle" });

  useEffect(() => {
    if (!place && home) setPlace(home);
    if (!clinic && (lastVisit?.clinic ?? savedClinics[0])) setClinic(lastVisit?.clinic ?? savedClinics[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, savedClinics.length]);

  useEffect(() => {
    if (!place) return;
    let live = true;
    setNearby({ state: "loading" });
    void findClinics(place).then((result) => live && setNearby(result));
    return () => {
      live = false;
    };
  }, [place]);

  const nearbyClinics = useMemo(
    () =>
      nearby.state === "ready"
        ? nearby.items.filter((item) => !savedClinics.some((saved) => saved.id === item.id))
        : [],
    [nearby, savedClinics],
  );

  const upcoming = useMemo(
    () =>
      visits
        .filter((visit) => visit.dayKey >= today)
        .sort((a, b) => `${a.dayKey}${a.time}`.localeCompare(`${b.dayKey}${b.time}`)),
    [visits, today],
  );
  const past = useMemo(() => visits.filter((visit) => visit.dayKey < today).slice(0, 4), [visits, today]);

  const chosen: SavedClinic | null =
    clinic ?? (otherName.trim().length >= 2 ? { id: `custom-${otherName.trim().toLowerCase()}`, name: otherName.trim(), address: null, phone: null } : null);

  const choose = (next: SavedClinic) => {
    void Haptics.selectionAsync();
    setClinic(next);
    setOtherName("");
  };

  const rebook = (visit: Visit) => {
    void Haptics.selectionAsync();
    setClinic(visit.clinic);
    setTime(visit.time);
    setReason(visit.reason);
    setJustBooked(null);
  };

  const commit = () => {
    if (!chosen) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const visit = bookVisit({ clinic: chosen, dayKey, time, reason });
    recordVaccineBooking({
      clinic: chosen.name,
      day: dayLabel(dayKey),
      dayKey,
      time,
      phone: chosen.phone,
      address: chosen.address,
    });
    if (dog.data?.id) {
      void upsertCareEvent({
        dogId: dog.data.id,
        eventType: "vet",
        title: `${reason}: ${chosen.name}`,
        description: chosen.address,
        startTime: `${dayKey}T${time}:00`,
        endTime: null,
        note: chosen.phone ? `Phone: ${chosen.phone}` : null,
      }).catch(() => undefined);
    }
    setClinic(chosen);
    setOtherName("");
    setJustBooked(visit);
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const timeStrip = useRef<ScrollView>(null);
  const timeScrolled = useRef(false);

  return (
    <DetailShell
      title="Book a visit"
      glyph={<CalendarPlusIcon size={iconSize.standard} color={text.primary} weight="regular" />}
      action={
        justBooked
          ? undefined
          : {
              label: chosen ? `Book ${dayKey === today ? "today" : dayLabel(dayKey)}, ${prettyTime(time)}` : "Pick a clinic",
              icon: <CalendarCheckIcon size={iconSize.button} color={text.primary} weight="bold" />,
              disabled: !chosen,
              onPress: commit,
            }
      }
    >
      {justBooked ? (
        <Booked visit={justBooked} dogName={dogName} onAnother={() => setJustBooked(null)} />
      ) : null}

      <Animated.View layout={settle}>
        {justBooked ? null : <Text style={styles.lede}>
          {lastVisit
            ? `Everything is set from ${dogName}'s last visit. Change anything, or just book.`
            : `Where are you, and which clinic? PAWS remembers both for next time.`}
        </Text>}

        <Text style={styles.section}>From</Text>
        <PlaceField
          value={place}
          home={home}
          onResolve={(next) => {
            setPlace(next);
            saveHome(next);
          }}
        />

        <Text style={styles.section}>Clinic</Text>
        <View style={styles.list}>
          {savedClinics.map((item, index) => (
            <ClinicRow
              key={item.id}
              name={item.name}
              detail={item.address ?? item.phone ?? "Saved clinic"}
              tag="Visited"
              on={chosen?.id === item.id}
              ruled={index > 0}
              onPress={() => choose(item)}
            />
          ))}
          {nearbyClinics.map((item, index) => (
            <ClinicRow
              key={item.id}
              name={item.name}
              detail={[item.distance, item.address].filter(Boolean).join(" · ")}
              rating={item.rating}
              on={chosen?.id === item.id}
              ruled={savedClinics.length + index > 0}
              onPress={() => choose(toSaved(item))}
            />
          ))}
          <View style={[styles.other, (savedClinics.length > 0 || nearbyClinics.length > 0) && styles.ruled]}>
            <TextInput
              style={styles.otherInput}
              value={otherName}
              onChangeText={(next) => {
                setOtherName(next);
                if (next.trim()) setClinic(null);
              }}
              placeholder={savedClinics.length || nearbyClinics.length ? "Another clinic" : "Clinic name"}
              placeholderTextColor={text.tertiary}
              accessibilityLabel="Type a clinic name"
            />
          </View>
        </View>
        <ClinicFeedNote feed={nearby} place={place} />

        <Text style={styles.section}>When</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {days.map((day) => {
            const on = day.key === dayKey;
            return (
              <PressScale
                key={day.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={dayLabel(day.key)}
                scaleTo={0.94}
                style={[styles.day, on && styles.dayOn]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDayKey(day.key);
                }}
              >
                <Text style={[styles.dayTop, on && styles.onText]}>{day.top}</Text>
                <Text style={[styles.dayDate, on && styles.onText]}>{day.date}</Text>
              </PressScale>
            );
          })}
        </ScrollView>
        <ScrollView ref={timeStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {TIMES.map((slot) => {
            const on = slot === time;
            return (
              <PressScale
                key={slot}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={prettyTime(slot)}
                scaleTo={0.94}
                style={[styles.chip, on && styles.chipOn]}
                onLayout={(event) => {
                  if (!on || timeScrolled.current) return;
                  timeScrolled.current = true;
                  timeStrip.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - space.xxl), animated: false });
                }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTime(slot);
                }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{prettyTime(slot)}</Text>
              </PressScale>
            );
          })}
        </ScrollView>

        <Text style={styles.section}>For</Text>
        <View style={styles.wrap}>
          {REASONS.map((item) => {
            const on = item === reason;
            return (
              <PressScale
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={item}
                scaleTo={0.95}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setReason(item);
                }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item}</Text>
              </PressScale>
            );
          })}
        </View>

        {upcoming.length > 0 ? (
          <>
            <Text style={styles.section}>Coming up</Text>
            <View style={styles.list}>
              {upcoming.map((visit, index) => (
                <VisitRow key={visit.id} visit={visit} ruled={index > 0} onCancel={() => cancelVisit(visit.id)} />
              ))}
            </View>
          </>
        ) : null}

        {past.length > 0 ? (
          <>
            <Text style={styles.section}>Before</Text>
            <View style={styles.list}>
              {past.map((visit, index) => (
                <VisitRow key={visit.id} visit={visit} ruled={index > 0} onRebook={() => rebook(visit)} />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.footnote}>
          PAWS keeps the visit on your schedule. The clinic confirms the time, so give them a call.
        </Text>
      </Animated.View>
    </DetailShell>
  );
}

const ClinicRow = ({
  name,
  detail,
  tag,
  rating,
  on,
  ruled,
  onPress,
}: {
  name: string;
  detail: string;
  tag?: string;
  rating?: number | null;
  on: boolean;
  ruled: boolean;
  onPress: () => void;
}) => (
  <PressScale
    accessibilityRole="radio"
    accessibilityState={{ selected: on }}
    accessibilityLabel={`${name}. ${detail}`}
    scaleTo={0.985}
    style={[styles.row, ruled && styles.ruled, on && styles.rowOn]}
    onPress={onPress}
  >
    <View style={[styles.radio, on && styles.radioOn]}>{on ? <CheckIcon size={12} color={text.primary} weight="bold" /> : null}</View>
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {name}
      </Text>
      {detail ? (
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
    {tag ? (
      <Text style={styles.tag}>{tag}</Text>
    ) : rating ? (
      <View style={styles.rating}>
        <StarIcon size={12} color={text.primary} weight="fill" />
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    ) : null}
  </PressScale>
);

const ClinicFeedNote = ({ feed, place }: { feed: Feed<Clinic>; place: SavedPlace | null }) => {
  const message =
    feed.state === "loading"
      ? "Looking for clinics nearby"
      : feed.state === "idle"
        ? "Add where you are to see clinics nearby."
        : feed.state === "ready" || feed.state === "empty"
          ? null
          : "Nearby search is not answering. Type the clinic, or look it up in Maps.";
  if (!message && feed.state !== "empty") return null;
  return (
    <View style={styles.feedNote}>
      <Text style={styles.footnoteInline}>{message ?? "No clinics came back for this area."}</Text>
      {place && feed.state !== "loading" ? (
        <PressScale
          accessibilityRole="link"
          accessibilityLabel="Search clinics in Maps"
          scaleTo={0.96}
          style={styles.mapsLink}
          onPress={() => void openLink(mapsSearchUrl("veterinarian", place))}
        >
          <MapTrifoldIcon size={iconSize.inline} color={text.primary} weight="regular" />
          <Text style={styles.mapsText}>Maps</Text>
        </PressScale>
      ) : null}
    </View>
  );
};

const VisitRow = ({
  visit,
  ruled,
  onCancel,
  onRebook,
}: {
  visit: Visit;
  ruled: boolean;
  onCancel?: () => void;
  onRebook?: () => void;
}) => (
  <View style={[styles.row, ruled && styles.ruled]}>
    <View style={styles.visitDate}>
      <Text style={styles.visitDay}>{fromKey(visit.dayKey).getDate()}</Text>
      <Text style={styles.visitMonth}>{MONTH[fromKey(visit.dayKey).getMonth()]}</Text>
    </View>
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {visit.clinic.name}
      </Text>
      <Text style={styles.rowDetail} numberOfLines={1}>
        {`${visit.reason} · ${prettyTime(visit.time)}`}
      </Text>
    </View>
    {visit.clinic.phone ? (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Call ${visit.clinic.name}`}
        scaleTo={0.92}
        style={styles.iconButton}
        onPress={() => void openLink(`tel:${visit.clinic.phone}`)}
      >
        <PhoneIcon size={iconSize.inline} color={text.primary} weight="regular" />
      </PressScale>
    ) : null}
    {onRebook ? (
      <PressScale accessibilityRole="button" accessibilityLabel={`Book ${visit.clinic.name} again`} scaleTo={0.95} style={styles.again} onPress={onRebook}>
        <Text style={styles.againText}>Again</Text>
      </PressScale>
    ) : onCancel ? (
      <PressScale accessibilityRole="button" accessibilityLabel={`Remove the visit at ${visit.clinic.name}`} scaleTo={0.92} style={styles.iconButton} onPress={onCancel}>
        <XIcon size={14} color={text.tertiary} weight="bold" />
      </PressScale>
    ) : null}
  </View>
);

const Booked = ({ visit, dogName, onAnother }: { visit: Visit; dogName: string; onAnother: () => void }) => {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)}
      style={styles.booked}
    >
      <View style={styles.bookedMark}>
        <CheckIcon size={iconSize.feature} color={text.primary} weight="bold" />
      </View>
      <Text style={styles.bookedTitle}>{`${dogName} is on the list.`}</Text>
      <Text style={styles.bookedBody}>
        {`${visit.reason} at ${visit.clinic.name}, ${dayLabel(visit.dayKey)} at ${prettyTime(visit.time)}. It is on your schedule now.`}
      </Text>
      <View style={styles.bookedActions}>
        {visit.clinic.phone ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Call ${visit.clinic.name} to confirm`}
            scaleTo={0.97}
            style={styles.primary}
            onPress={() => void openLink(`tel:${visit.clinic.phone}`)}
          >
            <PhoneIcon size={iconSize.inline} color={text.inverse} weight="bold" />
            <Text style={styles.primaryText}>Call to confirm</Text>
          </PressScale>
        ) : null}
        {visit.clinic.address ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Directions"
            scaleTo={0.97}
            style={styles.secondary}
            onPress={() => void openLink(directionsUrl(visit.clinic.address ?? ""))}
          >
            <ArrowUpRightIcon size={iconSize.inline} color={text.primary} weight="bold" />
            <Text style={styles.secondaryText}>Directions</Text>
          </PressScale>
        ) : null}
        <PressScale accessibilityRole="button" accessibilityLabel="Book another visit" scaleTo={0.97} style={styles.secondary} onPress={onAnother}>
          <Text style={styles.secondaryText}>Book another</Text>
        </PressScale>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  lede: { ...type.body, color: text.secondary, marginTop: space.md },
  section: { ...type.sectionTitle, color: text.primary, marginTop: space.section, marginBottom: space.md },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    backgroundColor: bg.canvas,
  },
  rowOn: { backgroundColor: accent.soft },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: accent.deep, backgroundColor: accent.deep },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowDetail: { ...type.caption, color: text.tertiary, marginTop: 2 },
  tag: {
    ...type.caption,
    fontWeight: "600",
    color: text.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    overflow: "hidden",
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { ...type.caption, fontWeight: "600", color: text.primary },

  other: { paddingHorizontal: space.lg, backgroundColor: bg.canvas },
  otherInput: { ...type.body, color: text.primary, height: 52 },

  feedNote: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
  footnoteInline: { ...type.caption, color: text.tertiary, flex: 1 },
  mapsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: accent.soft,
  },
  mapsText: { ...type.caption, fontWeight: "600", color: text.primary },

  strip: { gap: space.sm, paddingRight: layout.gutter, paddingBottom: space.sm },
  day: {
    width: 56,
    paddingVertical: space.md,
    borderRadius: radius.control,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  dayOn: { backgroundColor: text.primary, borderColor: text.primary },
  dayTop: { ...type.caption, color: text.tertiary },
  dayDate: { ...type.sectionTitle, color: text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  onText: { color: text.inverse },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  chipOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  chipText: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },
  chipTextOn: { color: text.primary, fontWeight: "600" },

  visitDate: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  visitDay: { ...type.cardTitle, fontWeight: "700", color: text.primary, lineHeight: 18 },
  visitMonth: { ...type.caption, fontSize: 10, lineHeight: 12, color: text.secondary },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  again: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: accent.primary },
  againText: { ...type.caption, fontWeight: "700", color: text.primary },

  footnote: { ...type.caption, color: text.tertiary, marginTop: space.xl, lineHeight: 17 },

  booked: {
    marginTop: space.lg,
    padding: space.xl,
    borderRadius: radius.card + 6,
    backgroundColor: accent.primary,
  },
  bookedMark: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  bookedTitle: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  bookedBody: { ...type.supporting, color: text.secondary, marginTop: space.sm, lineHeight: 21 },
  bookedActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  primaryText: { ...type.supporting, fontWeight: "700", color: text.inverse },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
  },
  secondaryText: { ...type.supporting, fontWeight: "600", color: text.primary },
});
