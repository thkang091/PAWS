import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  CaretLeftIcon,
  CrosshairIcon,
  MapPinSimpleIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
} from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { InviteSheet } from "@/features/rooms/components/InviteSheet";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import { MeetingPointPicker } from "@/features/numberTrail/components/MeetingPointPicker";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import {
  Avatar,
  ConnectionPill,
  IndeterminateTrail,
} from "@/features/numberTrail/components/RacePieces";
import {
  directionsUrl,
  kmPrecise,
  kmText,
} from "@/features/numberTrail/practiceFlow";
import { numberErrorText } from "@/features/numberTrail/raceCopy";
import {
  onlineView,
  type OnlinePlayerRow,
} from "@/features/numberTrail/raceView";
import { NT } from "@/features/numberTrail/theme";
import { ntStore } from "@/features/numberTrail/localStore";
import { useNumberDiscovery } from "@/features/numberTrail/useNumberDiscovery";
import { routeName, scanSummary } from "@/features/numberTrail/discoveryFlow";
import {
  chooseOnlineNumber,
  getCommonNumbers,
  listNearbyRoutes,
  shareOnlineCourse,
  type CommonNumbers,
  type RouteOption,
  cancelRoom,
  checkInAtStart,
  leaveNumberRace,
  matchOnlineCourses,
  prepareOnlineCourse,
  startNumberRace,
  startOnlineSearch,
  type RaceState,
} from "@/services/numberRaceService";
import { DISTANCE_CATEGORIES } from "../../../../supabase/functions/tournament/numberEquivalence";
import {
  accent,
  bg,
  border,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

/** Why a ranked set wasn't called fair, in one line. */
const VERDICT_LINES: Record<string, string> = {
  distance_mismatch: "The course lengths are too far apart.",
  structure_mismatch: "The routes are shaped too differently to call it fair.",
  readability_mismatch:
    "One route's digits don't read as clearly as the others.",
  missing_player: "Someone has no route yet.",
  no_common_window: "No set of routes falls within the same length.",
  number_mismatch: "The routes aren't all the same number.",
};
const SEARCH_LABEL: Record<OnlinePlayerRow["search"], string> = {
  not_started: "Not searched",
  searching: "Searching",
  found: "Route found",
  none: "No route nearby",
  error: "Search failed",
};

/**
 * An online race before the start. Each player finds the number on their own streets; the host matches the routes;
 * PAWS says plainly whether they are fair; everyone checks in at their own start; one server countdown starts all.
 * Nobody sees anyone else's route or position: only names, search status and official lengths.
 */
export const NtOnlineLobby = ({
  state,
  live,
  onChanged,
  openInvite,
}: {
  state: RaceState;
  live: boolean;
  onChanged: () => void;
  openInvite: boolean;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const v = onlineView(state);
  const host = state.me.isHost;
  const matchId = state.match.id;
  const [inviting, setInviting] = useState(openInvite && host);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cat = DISTANCE_CATEGORIES[v.category];

  // ---------- Before a number: what each player's streets can draw, privately ----------
  const numbersCheck = useNumberDiscovery(matchId);
  const [common, setCommon] = useState<CommonNumbers | null>(null);
  const [pickFor, setPickFor] = useState<"route" | "numbers">("route");
  const [sharedRoute, setSharedRoute] = useState<string | null>(null);
  const [routesSheet, setRoutesSheet] = useState(false);
  useEffect(() => {
    void ntStore.sharedRoute(matchId).then(setSharedRoute);
  }, [matchId]);
  useEffect(() => {
    if (v.stage !== "choosing") return undefined;
    let alive = true;
    getCommonNumbers(matchId)
      .then((c) => alive && setCommon(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [matchId, v.stage, state.lastSeq, numbersCheck.running]);
  const myCheck = common?.players.find((p) => p.userId === state.me.userId) ?? null;
  const checkNumbersNearMe = async () => {
    const access = await LocationTracking.requestAccess();
    const fix = access === "granted" ? await LocationTracking.current() : null;
    if (!fix) {
      setPickFor("numbers");
      return setPicking(true);
    }
    void numbersCheck.scan({ latitude: fix.latitude, longitude: fix.longitude, manual: false, accuracyM: fix.accuracyM }, 1_000);
  };
  const checkNumbersHow = () =>
    Alert.alert("Check my streets", "PAWS checks which numbers can be walked near you. Nobody else sees where.", [
      { text: "Near me", onPress: () => void checkNumbersNearMe() },
      {
        text: "Pick a spot",
        onPress: () => {
          setPickFor("numbers");
          setPicking(true);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  const choose = (n: string) => void act("choose", () => chooseOnlineNumber(matchId, n));
  const share = (candidateId: string) => void act("share", () => shareOnlineCourse(matchId, candidateId));

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  // My search widens 500 m, 1 km, 2 km and stops at the first find, as practice does: a wider search spends its frame
  // budget differently and can miss a course a narrower one finds. The spot is used for the search, not stored.
  const searchFrom = (at: { latitude: number; longitude: number }) =>
    act("search", async () => {
      setNote(null);
      for (const r of [500, 1_000, 2_000] as const) {
        const reply = await prepareOnlineCourse(matchId, at, r);
        if (reply.found) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          return;
        }
      }
      setNote(
        `No route for ${v.number} within 2 km of there. Try another spot.`,
      );
    });
  const searchNearMe = async () => {
    const access = await LocationTracking.requestAccess();
    const fix = access === "granted" ? await LocationTracking.current() : null;
    if (!fix) {
      setPickFor("route");
      return setPicking(true);
    }
    void searchFrom(fix);
  };
  const chooseHow = () =>
    Alert.alert("Find my route", "Where should PAWS look?", [
      { text: "Near me", onPress: () => void searchNearMe() },
      {
        text: "Pick a spot",
        onPress: () => {
          setPickFor("route");
          setPicking(true);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);

  const checkIn = () =>
    act("checkin", async () => {
      setNote(null);
      const access = await LocationTracking.requestAccess();
      const fix =
        access === "granted" ? await LocationTracking.current() : null;
      if (!fix)
        return setNote(
          "Location is off, so PAWS can't confirm you're at your start.",
        );
      const r = await checkInAtStart(matchId, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracyM: fix.accuracyM ?? 99,
      });
      if (r.atStart)
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      else
        setNote(
          r.reason === "gps_weak"
            ? "GPS is weak here. Step into the open and try again."
            : `You're about ${r.distanceM ?? "?"} m from your start flag.`,
        );
    });

  const matchNow = () =>
    act("match", async () => {
      const r = await matchOnlineCourses(matchId);
      void Haptics.notificationAsync(
        r.matched
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    });

  const leave = () =>
    Alert.alert(
      "Leave this race?",
      "You can rejoin with the code while it's open.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () =>
            void leaveNumberRace(state.room.id)
              .catch(() => undefined)
              .finally(() => router.replace("/game/tournament?mode=online" as never)),
        },
      ],
    );

  // ---------- The one thing to do next ----------
  let cta: {
    label: string;
    sub?: string;
    key: string;
    onPress: () => void;
    tone?: "white";
  } | null = null;
  if (v.stage === "choosing") {
    if (!myCheck || myCheck.status !== "done")
      cta = {
        label: numbersCheck.running ? "Checking my streets" : myCheck?.status === "partial" ? "Finish checking" : "Check my streets",
        sub: "Which numbers you can walk. Private.",
        key: "numbers",
        onPress: checkNumbersHow,
      };
  } else if (v.stage === "setup" && host && sharedRoute && v.rows.length >= 2)
    cta = {
      label: "Race my route together",
      sub: "One course for everyone here",
      key: "share",
      onPress: () => share(sharedRoute),
    };
  else if (v.hostAction === "start_search")
    cta = {
      label: "Find routes",
      sub: "Everyone searches their own streets",
      key: "start_search",
      onPress: () => void act("start_search", () => startOnlineSearch(matchId)),
    };
  else if (v.myStep === "search")
    cta = {
      label: "Find my route",
      sub: `${v.number} at ${kmText(v.targetM)} near you`,
      key: "search",
      onPress: chooseHow,
    };
  else if (v.hostAction === "match")
    cta = {
      label: v.stage === "unmatched" ? "Match again" : "Match routes",
      sub: "PAWS checks they're fair",
      key: "match",
      onPress: () => void matchNow(),
    };
  else if (v.myStep === "checkin")
    cta = {
      label: "I'm at my start",
      sub: "PAWS checks your location once",
      key: "checkin",
      onPress: () => void checkIn(),
    };
  else if (v.hostAction === "start")
    cta = {
      label: "Start the race",
      sub: "One countdown for everyone",
      key: "start",
      onPress: () => void act("start", () => startNumberRace(matchId)),
    };
  const commonCount = common?.common.length ?? 0;
  const waiting =
    v.stage === "choosing"
      ? !common?.everyoneChecked
        ? "Waiting for everyone to check their streets"
        : commonCount
          ? host
            ? "Pick a number everyone can walk"
            : "Waiting for the host to pick a number"
          : "No number everyone can walk yet"
      : v.stage === "setup"
      ? host
        ? "Invite at least one more player"
        : "Waiting for the host to start the search"
      : v.stage === "matching"
        ? "Checking the routes are fair"
        : v.stage === "matched"
          ? v.allAtStart
            ? "Waiting for the host to start"
            : `Waiting for ${v.waitingFor} to reach their start`
          : v.searchedAll
            ? "Waiting for the host to match routes"
            : `Waiting for ${v.waitingFor} to find a route`;

  const myCourse = state.course;
  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + space.sm,
            paddingBottom: 170 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.round}
            onPress={() => router.replace("/game/tournament?mode=online" as never)}
          >
            <CaretLeftIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          <ConnectionPill live={live} />
        </View>

        <View style={styles.head}>
          {v.number ? <NumberGlyph value={v.number} height={84} stroke={0.3} /> : <View style={styles.noNumber}><Text style={styles.noNumberText}>0 to 99</Text></View>}
          <View style={styles.flexOnly}>
            <Text style={styles.title}>{v.number ? `${kmText(v.targetM)} each` : "Pick a number"}</Text>
            <Text
              style={styles.subtitle}
            >{`${cat.label} · about ${cat.minutes} min · within ${v.toleranceM} m`}</Text>
            <View style={[styles.mode, v.ranked && styles.modeRanked]}>
              <Text
                style={[styles.modeText, v.ranked && styles.modeTextRanked]}
              >
                {v.ranked ? "Ranked" : "Friendly"}
              </Text>
            </View>
          </View>
        </View>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Room code ${state.room.code}. Invite players`}
          style={styles.codeRow}
          onPress={() => setInviting(true)}
        >
          <Text style={styles.code}>{state.room.code}</Text>
          <View style={styles.inviteChip}>
            <QrCodeIcon size={16} color={text.primary} weight="bold" />
            <Text style={styles.inviteText}>Invite</Text>
          </View>
        </PressScale>

        {/* The state of the race, honestly. */}
        {v.stage === "matched" ? (
          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.duration(motion.duration.enter)
                : ZoomIn.duration(motion.duration.enter)
                    .easing(motion.easing.out)
                    .withInitialValues({ transform: [{ scale: 0.96 }] })
            }
            style={[styles.card, styles.fair]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.cardHead}>
              <ShieldCheckIcon size={22} color={NT.two} weight="fill" />
              <Text style={styles.cardTitle}>
                {v.verdict?.status === "unranked"
                  ? "Friendly race set"
                  : "Routes matched"}
              </Text>
            </View>
            <Text style={styles.cardLine}>
              {v.verdict?.status === "unranked"
                ? `Every course is ${kmText(v.targetM)} within ${v.toleranceM} m. Shapes weren't required to match, so it isn't ranked.`
                : `Every course is ${kmText(v.targetM)}, ${v.verdict?.spreadM ?? v.spreadM ?? 0} m apart at most (${v.toleranceM} m allowed), with the same digit structure.`}
            </Text>
            {v.verdict?.unknown.length ? (
              <Text
                style={styles.unknown}
              >{`Not compared, no data: ${v.verdict.unknown.join(", ")}.`}</Text>
            ) : null}
          </Animated.View>
        ) : v.stage === "unmatched" ? (
          <View
            style={[styles.card, styles.unfair]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.cardHead}>
              <ShieldWarningIcon size={22} color="#B4442C" weight="fill" />
              <Text style={styles.cardTitle}>Not fair yet</Text>
            </View>
            <Text style={styles.cardLine}>
              {VERDICT_LINES[v.verdict?.status ?? ""] ??
                "The routes couldn't be matched."}
            </Text>
            <Text style={styles.unknown}>
              {
                "No ranked race on unmatched routes. Search from another spot, then match again."
              }
            </Text>
          </View>
        ) : v.stage === "choosing" ? (
          <View style={styles.card} accessibilityLiveRegion="polite">
            {numbersCheck.running || busy === "choose" ? <IndeterminateTrail /> : null}
            <Text style={styles.cardTitle}>Numbers everyone can walk</Text>
            <Text style={styles.cardLine}>
              {numbersCheck.running
                ? scanSummary(numbersCheck.numbers, true, numbersCheck.checkedRadiusM, 1_000).line
                : common?.everyoneChecked
                  ? commonCount
                    ? `${commonCount} ${commonCount === 1 ? "number" : "numbers"} can be walked near every player.`
                    : "No number can be walked near every player yet. Someone can check a wider area or another spot."
                  : "Each player checks the streets near them. Only the numbers are shared, never where."}
            </Text>
            {commonCount ? (
              <View style={styles.common}>
                {common!.common.map((n) => (
                  <PressScale
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={host ? `Race ${n}` : `${n}, walkable for everyone`}
                    disabled={!host || busy === "choose"}
                    scaleTo={0.95}
                    style={[styles.commonChip, host && styles.commonChipHost]}
                    onPress={() => choose(n)}
                  >
                    <Text style={styles.commonText}>{n}</Text>
                  </PressScale>
                ))}
              </View>
            ) : null}
            {common?.pending.length && common.everyoneChecked ? (
              <Text style={styles.unknown}>{`${common.pending.length} more weren't checked by everyone yet.`}</Text>
            ) : null}
            <Text style={styles.unknown}>Walkable for everyone isn't the same as a fair ranked race: that's checked once the number is picked.</Text>
          </View>
        ) : (
          <View style={styles.card} accessibilityLiveRegion="polite">
            {v.stage === "matching" || busy === "search" || busy === "match" ? (
              <IndeterminateTrail />
            ) : null}
            <Text style={styles.cardTitle}>
              {busy === "search"
                ? `Finding ${v.number} near you`
                : v.stage === "setup"
                  ? "Everyone on their own streets"
                  : v.me?.search === "found"
                    ? "Your route is ready"
                    : `Find ${v.number} near you`}
            </Text>
            <Text style={styles.cardLine}>
              {v.stage === "setup"
                ? `Each player gets a real ${kmText(v.targetM)} course for ${v.number} near them. Only names and lengths are shared.`
                : v.me?.search === "found"
                  ? v.me.officialM
                    ? `${kmPrecise(v.me.officialM)}, measured by PAWS. Only you see your route.`
                    : "Measured by PAWS. Only you see your route."
                  : v.me?.search === "none"
                    ? `No ${v.number} at this length near your last spot. Try another.`
                    : "Pick where you'll walk. PAWS measures the course on real streets."}
            </Text>
          </View>
        )}

        {v.stage === "matched" && myCourse ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Directions to your start"
            style={styles.point}
            onPress={() =>
              void Linking.openURL(directionsUrl(myCourse.start)).catch(
                () => undefined,
              )
            }
          >
            <MapPinSimpleIcon size={20} color={text.primary} weight="fill" />
            <View style={styles.flexOnly}>
              <Text style={styles.pointTitle}>
                {v.me?.atStart ? "You're at your start" : "Your start flag"}
              </Text>
              <Text style={styles.pointLine}>
                {v.me?.atStart
                  ? "Stay close until the countdown."
                  : "Open directions. The walk there isn't timed."}
              </Text>
            </View>
          </PressScale>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Players</Text>
          <Text
            style={styles.count}
          >{`${v.rows.length} of ${state.room.maxPlayers}`}</Text>
        </View>
        <View style={styles.players}>
          {v.rows.map((r) => (
            <View
              key={r.userId}
              style={styles.player}
              accessible
              accessibilityLabel={`${r.name}${r.isMe ? ", you" : ""}. ${v.stage === "matched" ? (r.atStart ? "At start" : "On the way") : SEARCH_LABEL[r.search]}${r.officialM ? `. ${kmPrecise(r.officialM)}` : ""}`}
            >
              <Avatar name={r.name} size={36} />
              <View style={styles.flexOnly}>
                <Text
                  style={styles.playerName}
                  numberOfLines={1}
                >{`${r.name}${r.isMe ? " (you)" : ""}${r.isHost ? " · host" : ""}`}</Text>
                {r.officialM ? (
                  <Text style={styles.playerNote}>
                    {kmPrecise(r.officialM)}
                  </Text>
                ) : null}
              </View>
              {v.stage === "choosing" ? (
                <CheckChip status={common?.players.find((p) => p.userId === r.userId) ?? null} />
              ) : v.stage === "setup" ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Joined</Text>
                </View>
              ) : (
                <StatusChip row={r} matched={v.stage === "matched"} />
              )}
            </View>
          ))}
        </View>

        {note ? (
          <Text style={styles.note} accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {(v.myStep === "wait" || v.myStep === "search") &&
        v.me?.search !== "not_started" ? (
          <PressScale
            accessibilityRole="button"
            style={styles.textButton}
            onPress={chooseHow}
          >
            <Text style={styles.leaveText}>Search from another spot</Text>
          </PressScale>
        ) : null}
        {v.stage === "setup" && host && v.rows.length >= 2 ? (
          <PressScale
            accessibilityRole="button"
            style={styles.textButton}
            onPress={() => (sharedRoute ? void act("start_search", () => startOnlineSearch(matchId)) : setRoutesSheet(true))}
          >
            <Text style={styles.leaveText}>{sharedRoute ? "Each on their own streets instead" : "Race one course together instead"}</Text>
          </PressScale>
        ) : null}
        <PressScale
          accessibilityRole="button"
          style={styles.textButton}
          onPress={leave}
        >
          <Text style={styles.leaveText}>Leave race</Text>
        </PressScale>
        {host ? (
          <PressScale
            accessibilityRole="button"
            style={styles.textButton}
            onPress={() =>
              Alert.alert(
                "Cancel this race?",
                "Everyone in it will be sent back.",
                [
                  { text: "Keep it", style: "cancel" },
                  {
                    text: "Cancel race",
                    style: "destructive",
                    onPress: () =>
                      void act("cancel", () => cancelRoom(state.room.id)),
                  },
                ],
              )
            }
          >
            <Text style={styles.cancelText}>Cancel race</Text>
          </PressScale>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {cta ? (
          <RaisedButton
            label={cta.label}
            sub={cta.sub}
            busy={busy === cta.key}
            onPress={cta.onPress}
          />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.waitingText}>{waiting}</Text>
          </View>
        )}
      </View>

      <InviteSheet
        visible={inviting}
        roomId={state.room.id}
        code={state.room.code}
        isHost={host}
        onClose={() => setInviting(false)}
      />
      <MeetingPointPicker
        visible={picking}
        initial={null}
        title="Where you'll walk"
        line="Put the pin on a public street near you. Only you see it."
        cta="Search here"
        onClose={() => setPicking(false)}
        onPick={(a) => {
          setPicking(false);
          if (pickFor === "numbers") void numbersCheck.scan({ ...a, manual: true }, 1_000);
          else void searchFrom(a);
        }}
      />
      <HostRoutes
        visible={routesSheet}
        number={v.number}
        onClose={() => setRoutesSheet(false)}
        onPick={(id) => {
          setRoutesSheet(false);
          share(id);
        }}
      />
    </View>
  );
};

/** A player's number check: status and a count, never their numbers or where. */
const CheckChip = ({ status }: { status: CommonNumbers["players"][number] | null }) => {
  const done = status?.status === "done";
  const label = !status || status.status === "not_checked" ? "Not checked" : `${status.status === "partial" ? "Part checked" : "Checked"} · ${status.available}`;
  return (
    <View style={[styles.chip, done && styles.chipOk]}>
      <Text style={[styles.chipText, done && styles.chipTextOk]}>{label}</Text>
    </View>
  );
};

/** Host: pick one of your routes for the race's number near you; everyone races it. */
const HostRoutes = ({ visible, number, onClose, onPick }: { visible: boolean; number: string | null; onClose: () => void; onPick: (candidateId: string) => void }) => {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<RouteOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !number) return;
    setRoutes(null);
    setError(null);
    void (async () => {
      const access = await LocationTracking.requestAccess();
      const fix = access === "granted" ? await LocationTracking.current() : null;
      if (!fix) return setError("Location is off, so PAWS can't find routes near you.");
      try {
        const r = await listNearbyRoutes({ latitude: fix.latitude, longitude: fix.longitude, radiusM: 1_000, number });
        setRoutes(r.routes);
      } catch (e) {
        setError(numberErrorText((e as { code?: string }).code));
      }
    })();
  }, [visible, number]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <Text style={styles.sheetTitle}>{`Race one ${number ?? ""} course`}</Text>
          <Text style={styles.cardLine}>Everyone walks the same route. Each player checks in at its start.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : !routes ? <ActivityIndicator style={styles.sheetLoading} color={text.primary} /> : !routes.length ? <Text style={styles.cardLine}>{`No ${number} within 1 km of you.`}</Text> : null}
          <ScrollView style={styles.sheetList}>
            {(routes ?? []).map((r, i) => (
              <PressScale key={r.routeKey} accessibilityRole="button" accessibilityLabel={`Route ${routeName(i)}, ${kmText(r.officialM)} course, ${kmText(r.approachM)} walk to the start`} style={styles.player} onPress={() => onPick(r.id)}>
                <Text style={styles.playerName}>{routeName(i)}</Text>
                <View style={styles.flexOnly}>
                  <Text style={styles.playerName}>{`${kmText(r.officialM)} course`}</Text>
                  <Text style={styles.playerNote}>{`${kmText(r.approachM)} walk to start · about ${r.minutes} min`}</Text>
                </View>
              </PressScale>
            ))}
          </ScrollView>
          <RaisedButton tone="white" label="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const StatusChip = ({
  row,
  matched,
}: {
  row: OnlinePlayerRow;
  matched: boolean;
}) => {
  const ok = matched ? row.atStart : row.search === "found";
  const bad = !matched && (row.search === "none" || row.search === "error");
  const label = matched
    ? row.atStart
      ? "At start"
      : "On the way"
    : SEARCH_LABEL[row.search];
  return (
    <View style={[styles.chip, ok && styles.chipOk, bad && styles.chipBad]}>
      {row.search === "searching" && !matched ? (
        <CrosshairIcon size={12} color={text.primary} weight="bold" />
      ) : null}
      <Text style={[styles.chipText, ok && styles.chipTextOk]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  noNumber: { width: 84, height: 84, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: border.default, alignItems: "center", justifyContent: "center" },
  noNumberText: { fontSize: 13, fontWeight: "800", color: text.tertiary },
  common: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  commonChip: { minWidth: 52, height: 44, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  commonChipHost: { borderWidth: 2, borderColor: accent.band },
  commonText: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.32)" },
  sheet: { maxHeight: "80%", paddingHorizontal: space.xxl, paddingTop: space.xl, gap: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  sheetTitle: { fontSize: 22, fontWeight: "800", color: text.primary },
  sheetLoading: { marginVertical: space.lg },
  sheetList: { flexGrow: 0 },
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  body: { paddingHorizontal: layout.gutter },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.xl,
  },
  mode: {
    alignSelf: "flex-start",
    height: 26,
    justifyContent: "center",
    paddingHorizontal: 10,
    marginTop: space.sm,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  modeRanked: { backgroundColor: accent.deep },
  modeText: { fontSize: 12, fontWeight: "800", color: text.secondary },
  modeTextRanked: { color: text.primary },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: text.primary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  subtitle: {
    ...type.caption,
    fontWeight: "600",
    color: text.secondary,
    marginTop: 2,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.soft,
  },
  code: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 5,
    color: text.primary,
  },
  inviteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  inviteText: { fontSize: 13, fontWeight: "800", color: text.primary },
  card: {
    marginTop: space.lg,
    padding: space.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: NT.board,
    gap: 6,
  },
  fair: { backgroundColor: "#EAF3F0", borderColor: "#CFE3DC" },
  unfair: { backgroundColor: "#FBF0EC", borderColor: "#F2D6CC" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardTitle: {
    ...type.cardTitle,
    fontSize: 17,
    fontWeight: "800",
    color: text.primary,
  },
  cardLine: { ...type.supporting, color: text.primary },
  unknown: { ...type.caption, color: text.secondary, marginTop: 2 },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  pointTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  pointLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: space.section,
    marginBottom: space.md,
  },
  section: { ...type.sectionTitle, color: text.primary },
  count: {
    ...type.supporting,
    fontWeight: "700",
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  players: { gap: space.sm },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.soft,
  },
  playerName: { fontSize: 15, fontWeight: "800", color: text.primary },
  playerNote: {
    ...type.caption,
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  chipOk: { backgroundColor: NT.two },
  chipBad: { backgroundColor: "#FBF0EC" },
  chipText: { fontSize: 12, fontWeight: "800", color: text.secondary },
  chipTextOk: { color: text.inverse },
  note: { ...type.supporting, color: text.primary, marginTop: space.lg },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  textButton: {
    alignSelf: "center",
    marginTop: space.lg,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  leaveText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  cancelText: { ...type.supporting, fontWeight: "700", color: "#B4442C" },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    backgroundColor: bg.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: border.default,
  },
  waiting: {
    height: 56,
    borderRadius: 18,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingText: { ...type.supporting, fontWeight: "700", color: text.secondary },
});
