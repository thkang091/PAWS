import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CheckCircleIcon, CheckIcon, NotePencilIcon, SkipForwardIcon, XCircleIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { canPublish, canReview, nearestRoad, nextPending, publishChecklist, regionStage, reviewCounts, type RoadStatus } from "@/features/rooms/regionAdmin";
import { CHECK_LABEL, ROAD_LABEL, ROAD_MEANING } from "@/features/rooms/regionCopy";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { RoadMap, type RoadMapHandle } from "@/features/rooms/components/RoadMap";
import { ROAD_STYLE, RoadSwatch, StageBadge } from "@/features/rooms/components/RoadStyle";
import { formatDistance } from "@/features/tournament/format";
import { REGION_KEYS, useOrganizerRegions, useRefreshRegions, useRegionRoads } from "@/hooks/useRegions";
import { disableRegion, publishRegion, reopenRegion, setRoadStatus, updateRegion, type RegionRoad, type RegionSummary } from "@/services/roomService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const STATUSES: RoadStatus[] = ["pending", "verified", "unsafe", "disabled"];
const CHOICES: RoadStatus[] = ["verified", "unsafe", "disabled"];

/** Review map: every road of one area, tapped one by one and marked verified, unsafe or disabled, then published. */
export default function RegionReviewScreen() {
  return (
    <OrganizerGate>
      <RegionReview />
    </OrganizerGate>
  );
}

const RegionReview = () => {
  const { id, publish } = useLocalSearchParams<{ id: string; publish?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const client = useQueryClient();
  const refresh = useRefreshRegions();
  const regions = useOrganizerRegions(true);
  const roadsQuery = useRegionRoads(id);
  const region = regions.data?.find((r) => r.id === id) ?? null;
  const roads = useMemo(() => roadsQuery.data ?? [], [roadsQuery.data]);
  const counts = useMemo(() => reviewCounts(roads), [roads]);
  const map = useRef<RoadMapHandle | null>(null);

  const [hidden, setHidden] = useState<Set<RoadStatus>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<RoadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [why, setWhy] = useState(false);
  const [editing, setEditing] = useState(false);

  const selected = roads.find((r) => r.id === selectedId) ?? null;
  useEffect(() => setNote(selected?.note ?? ""), [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = region ? canReview(true, region.status) : false;
  const checklist = useMemo(() => (region ? publishChecklist({ isOrganizer: true, status: region.status, source: region.source, license: region.license, roads }) : []), [region, roads]);
  const ready = canPublish(checklist);
  const blocking = checklist.filter((c) => !c.ok);

  // Opened from the list's Publish button: go straight to the confirmation once everything has loaded.
  const asked = useRef(false);
  useEffect(() => {
    if (publish === "1" && !asked.current && region && roadsQuery.data) {
      asked.current = true;
      if (ready) setPublishing(true);
      else setWhy(true);
    }
  }, [publish, region, roadsQuery.data, ready]);

  const visible = useMemo(() => roads.filter((r) => !hidden.has(r.status)), [roads, hidden]);

  const select = (rid: string | null, focus = false) => {
    setSelectedId(rid);
    setError(null);
    if (rid && focus) map.current?.focus(rid);
  };

  const goNext = () => {
    const n = nextPending(roads, selectedId);
    if (n) select(n, true);
    else {
      select(null);
      map.current?.fitAll();
    }
  };

  const mark = async (road: RegionRoad, status: RoadStatus) => {
    setSaving(status);
    setError(null);
    try {
      await setRoadStatus(road.id, status, note.trim());
      void Haptics.selectionAsync();
      // The server accepted it; show it now and move on to the next road waiting.
      const updated = roads.map((r) => (r.id === road.id ? { ...r, status, note: note.trim() } : r));
      client.setQueryData(REGION_KEYS.roads(id), updated);
      const n = nextPending(updated, road.id);
      if (n) select(n, true);
      else select(null);
      void client.invalidateQueries({ queryKey: REGION_KEYS.admin });
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setSaving(null);
    }
  };

  if (regions.isPending || roadsQuery.isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centerTitle}>Loading roads</Text>
      </View>
    );
  }
  if (!region || roadsQuery.error || regions.error) {
    const code = ((roadsQuery.error ?? regions.error) as { code?: string } | null)?.code;
    return (
      <View style={styles.centered}>
        <Text style={styles.centerTitle}>{region ? "Couldn't load the roads" : "Road area not found"}</Text>
        {code ? <Text style={styles.centerBody}>{roomErrorText(code)}</Text> : null}
        <RaisedButton tone="white" label="Back to road areas" onPress={() => router.replace(ROUTES.regions as never)} style={styles.centerButton} />
      </View>
    );
  }

  const stage = regionStage(region.status, counts);
  const progress = counts.total ? counts.reviewed / counts.total : 0;

  return (
    <View style={styles.flex}>
      {roads.length ? (
        <RoadMap
          ref={map}
          roads={visible}
          selectedId={selectedId}
          style={StyleSheet.absoluteFill}
          padding={{ top: insets.top + 190, bottom: insets.bottom + 260, left: 36, right: 36 }}
          onPressMap={(p) => {
            const hit = nearestRoad(p, visible, 30);
            select(hit?.id ?? null);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noRoads]}>
          <Text style={styles.centerTitle}>No roads in this area</Text>
          <Text style={styles.centerBody}>The import didn't add any roads. Create a new area from the file again.</Text>
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.regions as never))}>
            <CaretLeftIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          <View style={styles.titleCard}>
            <Text style={styles.title} numberOfLines={1}>
              {region.name}
            </Text>
            <StageBadge stage={stage} style={styles.centerSelf} />
          </View>
          {editable ? (
            <PressScale accessibilityRole="button" accessibilityLabel="Edit area details" style={styles.round} onPress={() => setEditing(true)}>
              <NotePencilIcon size={20} color={text.primary} weight="bold" />
            </PressScale>
          ) : null}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressValue} accessibilityLabel={`${counts.reviewed} of ${counts.total} roads reviewed`}>
              {`${counts.reviewed}/${counts.total}`}
              <Text style={styles.progressUnit}> reviewed</Text>
            </Text>
            <Text style={styles.progressLen}>{formatDistance(roads.reduce((s, r) => s + r.lengthM, 0))}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
            {STATUSES.map((s) => {
              const off = hidden.has(s);
              return (
                <PressScale
                  key={s}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !off }}
                  accessibilityLabel={`${ROAD_LABEL[s]} roads, ${counts[s]}. ${off ? "Hidden" : "Shown"}`}
                  style={[styles.legendChip, off && styles.legendOff]}
                  onPress={() =>
                    setHidden((h) => {
                      const next = new Set(h);
                      if (next.has(s)) next.delete(s);
                      else next.add(s);
                      return next;
                    })
                  }
                >
                  <RoadSwatch status={s} width={22} />
                  <Text style={[styles.legendText, off && styles.legendTextOff]}>{`${ROAD_LABEL[s]} ${counts[s]}`}</Text>
                </PressScale>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.bottomWrap} pointerEvents="box-none">
        <View style={[styles.panel, { paddingBottom: Math.max(space.lg, insets.bottom - space.xs) }]}>
          {selected ? (
            <Animated.View key={selected.id} entering={reduceMotion ? FadeIn : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)}>
              <View style={styles.roadHead}>
                <View style={styles.flex1}>
                  <Text style={styles.roadName} numberOfLines={1}>
                    {selected.name ?? "Unnamed road"}
                  </Text>
                  <View style={styles.roadMeta}>
                    <RoadSwatch status={selected.status} width={22} />
                    <Text style={styles.roadMetaText}>{`${ROAD_LABEL[selected.status]}, ${formatDistance(selected.lengthM)}, ${selected.coords.length} points`}</Text>
                  </View>
                </View>
                <PressScale accessibilityRole="button" accessibilityLabel="Close road" hitSlop={8} style={styles.close} onPress={() => select(null)}>
                  <XIcon size={16} color={text.secondary} weight="bold" />
                </PressScale>
              </View>
              <Text style={styles.coords} selectable>
                {`From ${fmtPoint(selected.coords[0])}  to ${fmtPoint(selected.coords[selected.coords.length - 1])}`}
              </Text>
              <Text style={styles.coords} selectable>{`Road ${selected.id.slice(0, 8)}`}</Text>

              {editable ? (
                <>
                  <TextInput value={note} onChangeText={setNote} maxLength={300} style={styles.note} placeholder="Note, e.g. no pavement past the bridge" placeholderTextColor={text.tertiary} accessibilityLabel="Review note" />
                  <View style={styles.choices}>
                    {CHOICES.map((s) => {
                      const on = selected.status === s;
                      return (
                        <PressScale
                          key={s}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on, disabled: Boolean(saving) }}
                          accessibilityLabel={`Mark ${ROAD_LABEL[s].toLowerCase()}`}
                          disabled={Boolean(saving)}
                          style={[styles.choice, on && { borderColor: ROAD_STYLE[s].color, backgroundColor: `${ROAD_STYLE[s].color}14` }]}
                          onPress={() => void mark(selected, s)}
                        >
                          {on ? <CheckIcon size={14} color={ROAD_STYLE[s].color} weight="bold" /> : <RoadSwatch status={s} width={20} />}
                          <Text style={[styles.choiceText, on && { color: ROAD_STYLE[s].color }]}>{saving === s ? "Saving" : ROAD_LABEL[s]}</Text>
                        </PressScale>
                      );
                    })}
                  </View>
                  <Text style={styles.meaning}>{selected.status === "pending" ? "Unsafe is a hazard. Disabled is fine, just not part of the game. Neither is shown to players." : ROAD_MEANING[selected.status]}</Text>
                </>
              ) : (
                <Text style={styles.locked}>{region.status === "published" ? "Published areas are locked. Disable the area, then reopen it as a draft to change roads." : "Disabled areas are locked. Reopen it as a draft to change roads."}</Text>
              )}
              {selected.note && !editable ? <Text style={styles.meaning}>{`Note: ${selected.note}`}</Text> : null}
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              {editable && counts.pending > 0 ? (
                <PressScale accessibilityRole="button" style={styles.skip} onPress={goNext}>
                  <SkipForwardIcon size={16} color={text.primary} weight="fill" />
                  <Text style={styles.skipText}>{selected.status === "pending" ? "Skip for now" : "Next pending road"}</Text>
                </PressScale>
              ) : null}
            </Animated.View>
          ) : (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}>
              {region.status === "published" ? (
                <>
                  <Text style={styles.panelTitle}>Live in Steal Your Road</Text>
                  <Text style={styles.panelLine}>{`${counts.verified} verified roads. Hosts can pick this area in a road lobby.`}</Text>
                  <RaisedButton tone="white" label="Disable area" sub="Takes it out of new rooms" style={styles.panelButton} onPress={() => confirmDisable(region, () => refresh(id))} />
                </>
              ) : region.status === "disabled" ? (
                <>
                  <Text style={styles.panelTitle}>Disabled</Text>
                  <Text style={styles.panelLine}>Players can't pick it. Reopen it as a draft to fix roads and publish again.</Text>
                  <RaisedButton tone="white" label="Reopen as draft" style={styles.panelButton} onPress={() => void reopenRegion(region.id).catch((e) => Alert.alert("That didn't work", roomErrorText(e.code))).finally(() => void refresh(id))} />
                </>
              ) : counts.pending > 0 ? (
                <>
                  <Text style={styles.panelTitle}>{`${counts.pending} ${counts.pending === 1 ? "road" : "roads"} to check`}</Text>
                  <Text style={styles.panelLine}>Tap a road on the map, or step through them in order.</Text>
                  <RaisedButton label="Review next road" style={styles.panelButton} onPress={goNext} />
                  <WhyLink count={blocking.length} onPress={() => setWhy(true)} />
                </>
              ) : (
                <>
                  <Text style={styles.panelTitle}>{ready ? "Ready to publish" : "Almost there"}</Text>
                  <Text style={styles.panelLine}>{ready ? `${counts.verified} verified roads will be playable.` : CHECK_LABEL[blocking[0]?.check ?? "reviewed"]}</Text>
                  <RaisedButton label="Publish area" sub={ready ? undefined : `${blocking.length} ${blocking.length === 1 ? "thing" : "things"} left`} disabled={!ready} style={styles.panelButton} onPress={() => setPublishing(true)} />
                  {!ready ? <WhyLink count={blocking.length} onPress={() => setWhy(true)} /> : null}
                </>
              )}
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>

      <ChecklistSheet visible={why} items={checklist} counts={counts} onClose={() => setWhy(false)} />
      <PublishModal visible={publishing} region={region} counts={counts} checklist={checklist} onClose={() => setPublishing(false)} onDone={() => refresh(id)} />
      {editing ? <DetailsSheet region={region} onClose={() => setEditing(false)} onSaved={() => refresh(id)} /> : null}
    </View>
  );
};

const fmtPoint = (p: readonly [number, number] | undefined) => (p ? `${p[1].toFixed(5)}, ${p[0].toFixed(5)}` : "");

const confirmDisable = (region: RegionSummary, after: () => unknown) =>
  Alert.alert(`Disable ${region.name}?`, "Players can't pick it for new rooms, and open rooms that picked it lose the pick.", [
    { text: "Keep it live", style: "cancel" },
    {
      text: "Disable",
      style: "destructive",
      onPress: () =>
        void disableRegion(region.id)
          .catch((e) => Alert.alert("That didn't work", roomErrorText((e as { code?: string }).code)))
          .finally(() => void after()),
    },
  ]);

const WhyLink = ({ count, onPress }: { count: number; onPress: () => void }) => (
  <PressScale accessibilityRole="button" style={styles.why} onPress={onPress}>
    <Text style={styles.whyText}>{count ? `Why can't I publish yet?` : "Publishing checklist"}</Text>
  </PressScale>
);

const Checklist = ({ items, counts }: { items: ReturnType<typeof publishChecklist>; counts: ReturnType<typeof reviewCounts> }) => (
  <View style={styles.checks}>
    {items
      .filter((i) => i.check !== "organizer")
      .map((i) => (
        <View key={i.check} style={styles.check} accessible accessibilityLabel={`${CHECK_LABEL[i.check]}. ${i.ok ? "Done" : "Not yet"}`}>
          {i.ok ? <CheckCircleIcon size={20} color={ROAD_STYLE.verified.color} weight="fill" /> : <XCircleIcon size={20} color={ROAD_STYLE.unsafe.color} weight="fill" />}
          <Text style={[styles.checkText, !i.ok && styles.checkTextOff]}>{CHECK_LABEL[i.check]}</Text>
          {i.check === "reviewed" ? <Text style={styles.checkCount}>{`${counts.reviewed}/${counts.total}`}</Text> : null}
          {i.check === "verified" ? <Text style={styles.checkCount}>{counts.verified}</Text> : null}
        </View>
      ))}
  </View>
);

const SheetFrame = ({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.scrim}>
        <Pressable style={styles.flex1} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const ChecklistSheet = ({ visible, items, counts, onClose }: { visible: boolean; items: ReturnType<typeof publishChecklist>; counts: ReturnType<typeof reviewCounts>; onClose: () => void }) => (
  <SheetFrame visible={visible} title="Before publishing" onClose={onClose}>
    <Text style={styles.sheetLine}>The server checks each of these again when you publish.</Text>
    <Checklist items={items} counts={counts} />
    <RaisedButton tone="white" label="Close" onPress={onClose} style={styles.panelButton} />
  </SheetFrame>
);

/** The last step. Shows exactly what goes live, and only says it's live once the server has confirmed it. */
const PublishModal = ({ visible, region, counts, checklist, onClose, onDone }: { visible: boolean; region: RegionSummary; counts: ReturnType<typeof reviewCounts>; checklist: ReturnType<typeof publishChecklist>; onClose: () => void; onDone: () => Promise<unknown> }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const live = region.status === "published";

  useEffect(() => {
    if (!visible) {
      setError(null);
      setDone(false);
    }
  }, [visible]);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await publishRegion(region.id);
      await onDone();
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
      void onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <Animated.View entering={FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.modal}>
          {done && live ? (
            <>
              <View style={styles.liveDisc}>
                <CheckIcon size={30} color={bg.surface} weight="bold" />
              </View>
              <Text style={styles.modalTitle}>{`${region.name} is live`}</Text>
              <Text style={styles.modalLine}>Hosts can pick it now in a Steal Your Road lobby.</Text>
              <RaisedButton label="Done" style={styles.modalButton} onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>{`Publish ${region.name}?`}</Text>
              <View style={styles.summary}>
                <SummaryRow status="verified" text={`${counts.verified} verified roads become playable`} />
                <SummaryRow status="unsafe" text={`${counts.unsafe} unsafe roads stay hidden`} />
                <SummaryRow status="disabled" text={`${counts.disabled} disabled roads stay hidden`} />
              </View>
              <Text style={styles.modalLine}>{region.attribution ? `Players see: ${region.attribution}` : `Source: ${region.source}, ${region.license}`}</Text>
              {!canPublish(checklist) ? <Checklist items={checklist} counts={counts} /> : null}
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <RaisedButton label="Publish" busy={busy} disabled={!canPublish(checklist)} style={styles.modalButton} onPress={() => void go()} />
              <RaisedButton tone="white" label="Not yet" disabled={busy} style={styles.modalButtonSecond} onPress={onClose} />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const SummaryRow = ({ status, text: line }: { status: RoadStatus; text: string }) => (
  <View style={styles.summaryRow}>
    <RoadSwatch status={status} width={26} />
    <Text style={styles.summaryText}>{line}</Text>
  </View>
);

const DetailsSheet = ({ region, onClose, onSaved }: { region: RegionSummary; onClose: () => void; onSaved: () => Promise<unknown> }) => {
  const [form, setForm] = useState({ name: region.name, source: region.source, license: region.license, attribution: region.attribution, notes: region.notes });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateRegion(region.id, form);
      await onSaved();
      onClose();
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SheetFrame visible title="Area details" onClose={onClose}>
      <View style={styles.form}>
        <FormField label="Name" value={form.name} onChange={set("name")} max={60} />
        <FormField label="Source" value={form.source} onChange={set("source")} max={300} rule />
        <FormField label="Licence" value={form.license} onChange={set("license")} max={200} rule />
        <FormField label="Attribution" value={form.attribution} onChange={set("attribution")} max={300} rule />
        <FormField label="Notes" value={form.notes} onChange={set("notes")} max={1000} rule />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <RaisedButton label="Save" busy={busy} disabled={form.name.trim().length < 2} style={styles.panelButton} onPress={() => void save()} />
    </SheetFrame>
  );
};

const FormField = ({ label, value, onChange, max, rule }: { label: string; value: string; onChange: (v: string) => void; max: number; rule?: boolean }) => (
  <View style={[styles.formRow, rule && styles.formRule]}>
    <Text style={styles.formLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} maxLength={max} style={styles.formInput} accessibilityLabel={label} placeholderTextColor={text.tertiary} placeholder="Not set" />
  </View>
);

const FLOAT = { shadowColor: "#1C1B1A", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.stage },
  flex1: { flex: 1 },
  centerSelf: { alignSelf: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xxl, backgroundColor: bg.canvas },
  centerTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary, textAlign: "center" },
  centerBody: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 300 },
  centerButton: { alignSelf: "stretch", marginTop: space.lg },
  noRoads: { alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xxl },

  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.lg, gap: space.sm },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", ...FLOAT },
  titleCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 44, paddingHorizontal: space.md, borderRadius: 22, backgroundColor: bg.surface, ...FLOAT },
  title: { ...type.cardTitle, fontWeight: "800", color: text.primary, flex: 1 },
  progressCard: { padding: space.md, paddingBottom: space.sm, borderRadius: radius.card, backgroundColor: bg.surface, ...FLOAT },
  progressHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  progressValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, color: text.primary, fontVariant: ["tabular-nums"] },
  progressUnit: { fontSize: 14, fontWeight: "600", letterSpacing: 0, color: text.secondary },
  progressLen: { ...type.caption, fontWeight: "700", color: text.secondary, fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, backgroundColor: bg.subtle, marginTop: space.sm, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: ROAD_STYLE.verified.color },
  legend: { gap: 6, paddingTop: space.sm },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  legendOff: { backgroundColor: bg.subtle, borderColor: bg.subtle, opacity: 0.6 },
  legendText: { fontSize: 12, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  legendTextOff: { textDecorationLine: "line-through", color: text.secondary },

  bottomWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  panel: { marginHorizontal: space.sm, marginBottom: space.sm, padding: space.lg, borderRadius: 26, backgroundColor: bg.surface, ...FLOAT },
  panelTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  panelLine: { ...type.supporting, color: text.secondary, marginTop: 2 },
  panelButton: { marginTop: space.md },
  roadHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  roadName: { ...type.sectionTitle, fontSize: 18, fontWeight: "800", color: text.primary },
  roadMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  roadMetaText: { ...type.caption, fontWeight: "700", color: text.secondary, fontVariant: ["tabular-nums"] },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  coords: { ...type.caption, color: text.tertiary, marginTop: 4, fontVariant: ["tabular-nums"] },
  note: { height: 44, marginTop: space.md, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.subtle, ...type.supporting, color: text.primary },
  choices: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  choice: { flex: 1, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface },
  choiceText: { fontSize: 14, fontWeight: "800", color: text.primary },
  meaning: { ...type.caption, color: text.secondary, marginTop: space.sm },
  locked: { ...type.supporting, color: text.secondary, marginTop: space.md },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.md },
  skip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, marginTop: space.sm },
  skipText: { ...type.supporting, fontWeight: "800", color: text.primary },
  why: { alignSelf: "center", minHeight: 40, justifyContent: "center", marginTop: space.xs },
  whyText: { ...type.supporting, fontWeight: "700", color: text.secondary, textDecorationLine: "underline" },

  checks: { gap: space.md, marginTop: space.lg },
  check: { flexDirection: "row", alignItems: "center", gap: space.md },
  checkText: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1 },
  checkTextOff: { color: text.primary },
  checkCount: { ...type.supporting, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },

  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.32)", justifyContent: "flex-end" },
  sheet: { paddingHorizontal: layout.gutter, paddingTop: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: border.default, marginBottom: space.lg },
  sheetTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  sheetLine: { ...type.supporting, color: text.secondary, marginTop: 4 },
  form: { marginTop: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft },
  formRow: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingLeft: space.lg },
  formRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  formLabel: { ...type.supporting, fontWeight: "700", color: text.primary, width: 96 },
  formInput: { flex: 1, minHeight: 52, paddingRight: space.lg, ...type.body, color: text.primary },

  modalScrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.42)", alignItems: "center", justifyContent: "center", padding: space.xl },
  modal: { alignSelf: "stretch", maxWidth: 420, padding: space.xxl, borderRadius: 28, backgroundColor: bg.surface },
  modalTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, fontWeight: "800", color: text.primary },
  modalLine: { ...type.supporting, color: text.secondary, marginTop: space.md },
  summary: { gap: space.sm, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryText: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1, fontVariant: ["tabular-nums"] },
  modalButton: { marginTop: space.xl },
  modalButtonSecond: { marginTop: space.sm },
  liveDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: ROAD_STYLE.verified.color, alignItems: "center", justifyContent: "center", marginBottom: space.lg, alignSelf: "flex-start" },
});
