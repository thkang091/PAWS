import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { FlagCheckeredIcon, FlagIcon } from "phosphor-react-native";

import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { DASH, LINE, NT, digitColor } from "@/features/numberTrail/theme";
import type { NumberCourse } from "../../../../supabase/functions/tournament/numberMatch";
import { text } from "@/constants/design";

type LatLng = { latitude: number; longitude: number };
type Pad = { top: number; right: number; bottom: number; left: number };
const ll = (c: readonly (readonly [number, number])[]): LatLng[] => c.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

/** A stroke counts as walked on the map once the server has checked most of it. */
const WALKED = 0.6;

export type CourseMapHandle = { fitAll: (animated?: boolean) => void; focusDigit: (k: 0 | 1) => void; centreOn: (p: LatLng) => void };

/**
 * The assigned course on the PAWS Google map, exactly as the server stored it: the digits' own street edges, the
 * connector and the walk to the start. Nothing is straightened, smoothed or invented. The camera turns by the course's
 * heading so the number reads upright, and only moves when asked; it never takes over while the player is looking.
 */
export const CourseMap = memo(
  forwardRef<
    CourseMapHandle,
    {
      course: NumberCourse;
      /** Server-checked walked share per stroke edge, for each digit. */
      walked?: readonly Record<string, number>[];
      /** The digit to bring forward; the other one fades back. */
      focus?: 0 | 1 | null;
      position?: LatLng | null;
      /** This phone's own walk, drawn thin (never anyone else's). */
      track?: readonly LatLng[][];
      padding: Pad;
      interactive?: boolean;
      showApproach?: boolean;
      /** Other routes for the same number: just their start, lettered, tap to show that route instead. */
      others?: readonly { key: string; label: string; start: LatLng; onPress: () => void }[];
    }
  >(({ course, walked, focus = null, position = null, track = [], padding, interactive = true, showApproach = true, others = [] }, ref) => {
    const map = useRef<MapView | null>(null);
    const finish = course.finish ?? [];
    const all = useMemo(
      () => [...course.digits.flatMap((d) => d.edges.flatMap((e) => ll(e.coords))), ...course.connector.flatMap((e) => ll(e.coords)), ...(course.finish ?? []).flatMap((e) => ll(e.coords)), { latitude: course.start.latitude, longitude: course.start.longitude }],
      [course],
    );
    // Practice and online races start at digit one's first corner: one flag there, not a flag and a badge.
    const startOnDigit = Math.abs(course.start.latitude - course.digits[0].start.latitude) + Math.abs(course.start.longitude - course.digits[0].start.longitude) < 1e-7;
    const digitPts = useMemo(() => course.digits.map((d) => d.edges.flatMap((e) => ll(e.coords))), [course]);
    const heading = ((course.headingDeg % 360) + 360) % 360;

    const fitTo = useCallback(
      (pts: LatLng[], animated: boolean) => {
        const m = map.current;
        if (!m || !pts.length) return;
        // A turned map needs room for the corners the turn brings in.
        const extra = Math.abs(Math.sin((heading * Math.PI) / 180)) * 40;
        m.fitToCoordinates(pts, { edgePadding: { top: padding.top + extra, right: padding.right + extra, bottom: padding.bottom + extra, left: padding.left + extra }, animated: false });
        setTimeout(() => {
          void m.getCamera().then((cam) => m.animateCamera({ ...cam, heading, pitch: 0 }, { duration: animated ? 300 : 1 }));
        }, 60);
      },
      [heading, padding],
    );

    // The frame changes (the bottom panel was measured, a button appeared): fit again, once per change.
    const padKey = `${Math.round(padding.top / 8)}:${Math.round(padding.bottom / 8)}:${Math.round(padding.left / 8)}:${Math.round(padding.right / 8)}`;
    const firstPad = useRef(padKey);
    // Once the player has moved the map, it's theirs: only their own buttons move it again.
    const touched = useRef(false);
    useEffect(() => {
      if (padKey === firstPad.current) return;
      firstPad.current = padKey;
      if (!touched.current) fitTo(all, true);
    }, [padKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      fitAll: (animated = true) => fitTo(all, animated),
      focusDigit: (k) => fitTo(digitPts[k], true),
      centreOn: (p) => void map.current?.getCamera().then((cam) => map.current?.animateCamera({ ...cam, center: p }, { duration: 300 })),
    }));

    const strokes = useMemo(
      () =>
        course.digits.flatMap((d, k) =>
          d.edges.map((e) => {
            const share = walked?.[k]?.[e.edgeId] ?? 0;
            const dimmed = focus != null && focus !== k;
            return { key: `${k}:${e.edgeId}`, k: k as 0 | 1, path: ll(e.coords), done: share >= WALKED, dimmed };
          }),
        ),
      [course, walked, focus],
    );

    return (
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={QUIET_MAP}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        onMapReady={() => {
          fitTo(all, false);
          // Google's map can report ready before its final size: frame again once it has settled.
          setTimeout(() => !touched.current && fitTo(all, false), 350);
        }}
        onPanDrag={() => (touched.current = true)}
        accessibilityLabel={`Map of the course for ${course.number}`}
      >
        {showApproach
          ? course.approach.map((e) => <Polyline key={`a:${e.edgeId}`} coordinates={ll(e.coords)} strokeColor={withAlpha(NT.link, 0.45)} strokeWidth={LINE.approach} lineDashPattern={[...DASH.approach]} lineCap="round" />)
          : null}
        {course.connector.map((e) => (
          <Polyline key={`c:${e.edgeId}`} coordinates={ll(e.coords)} strokeColor={NT.link} strokeWidth={LINE.link} lineDashPattern={[...DASH.link]} lineCap="round" zIndex={1} />
        ))}
        {finish.map((e) => (
          <Polyline key={`f:${e.edgeId}`} coordinates={ll(e.coords)} strokeColor={withAlpha(NT.finish, 0.85)} strokeWidth={LINE.finish} lineCap="round" lineJoin="round" zIndex={1} />
        ))}
        {strokes.map((s) => (
          <Polyline
            key={s.key}
            coordinates={s.path}
            // Before the race (no progress given) the whole course is drawn full; during it, walked streets stand out.
            strokeColor={withAlpha(digitColor(s.k), s.dimmed ? 0.45 : !walked || s.done ? NT.done : NT.todo)}
            strokeWidth={s.done ? LINE.digitDone : LINE.digit}
            lineCap="round"
            lineJoin="round"
            zIndex={s.done ? 3 : 2}
          />
        ))}
        {/* Digit two's dotted white centre: told apart from digit one without colour. */}
        {strokes
          .filter((s) => s.k === 1)
          .map((s) => (
            <Polyline key={`${s.key}:c`} coordinates={s.path} strokeColor={withAlpha(NT.twoCentre, s.dimmed ? 0.5 : 0.95)} strokeWidth={LINE.centre} lineDashPattern={[...DASH.twoCentre]} lineCap="round" zIndex={4} />
          ))}
        {track.map((seg, i) => (seg.length > 1 ? <Polyline key={`t:${i}`} coordinates={seg} strokeColor={withAlpha(NT.walked, 0.7)} strokeWidth={LINE.walked} lineCap="round" zIndex={5} /> : null))}

        {others.map((o) => (
          <Marker key={`o:${o.key}`} coordinate={o.start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} onPress={o.onPress} accessibilityLabel={`Route ${o.label} starts here. Tap to show it`}>
            <View style={styles.other}>
              <Text style={styles.otherText}>{o.label}</Text>
            </View>
          </Marker>
        ))}
        <Marker coordinate={course.start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Start corner">
          <View style={styles.start}>
            <FlagIcon size={14} color={text.inverse} weight="fill" />
          </View>
        </Marker>
        {course.end && finish.length ? (
          <Marker coordinate={course.end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Finish corner">
            <View style={styles.end}>
              <FlagCheckeredIcon size={14} color={text.primary} weight="fill" />
            </View>
          </Marker>
        ) : null}
        {course.digits.map((d, k) => (k === 0 && startOnDigit ? null : (
          <Marker key={`n${k}`} coordinate={d.start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel={`Digit ${k + 1} starts here`}>
            <View style={[styles.badge, { backgroundColor: digitColor(k as 0 | 1) }]}>
              <Text style={styles.badgeText}>{k + 1}</Text>
            </View>
          </Marker>
        )))}
        {position ? (
          <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={10} accessibilityLabel="You">
            <View style={styles.me}>
              <View style={styles.meDot} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    );
  }),
);
CourseMap.displayName = "CourseMap";

const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const styles = StyleSheet.create({
  start: { width: 28, height: 28, borderRadius: 14, backgroundColor: text.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  other: { minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: text.tertiary },
  otherText: { fontSize: 12, fontWeight: "900", color: text.secondary },
  end: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: text.primary },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  badgeText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  me: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(47,111,222,0.18)", alignItems: "center", justifyContent: "center" },
  meDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2F6FDE", borderWidth: 3, borderColor: "#FFFFFF" },
});
