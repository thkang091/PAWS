import * as Location from "expo-location";

import { GPS_RULES, type GpsFix } from "../../../../supabase/functions/tournament/geo";

/**
 * The phone's GPS, and nothing else: permission, a watch that reports raw fixes, and a one-off reading. Deciding
 * which fixes count, drawing them and saving them happen elsewhere.
 *
 * Foreground only. Tracking stops when PAWS is not on screen; background tracking needs expo-task-manager and the
 * native location background mode, which this build does not have.
 */

export type LocationAccess = "granted" | "denied" | "blocked" | "unavailable";

const toFix = (l: Location.LocationObject): GpsFix => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracyM: l.coords.accuracy ?? null,
  capturedAt: l.timestamp,
});

export const LocationTracking = {
  /** Asks only when it can; once refused, the system will not show the prompt again. */
  async requestAccess(): Promise<LocationAccess> {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return "granted";
      if (!current.canAskAgain) return "blocked";
      const asked = await Location.requestForegroundPermissionsAsync();
      return asked.granted ? "granted" : asked.canAskAgain ? "denied" : "blocked";
    } catch {
      return "unavailable";
    }
  },

  async servicesOn(): Promise<boolean> {
    return Location.hasServicesEnabledAsync().catch(() => false);
  },

  /** Reports every fix the phone gives. Returns a function that stops the watch. */
  async watch(onFix: (fix: GpsFix) => void): Promise<() => void> {
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: GPS_RULES.sampleMs, distanceInterval: GPS_RULES.sampleMeters },
      (l) => onFix(toFix(l)),
    );
    return () => sub.remove();
  },

  async current(): Promise<GpsFix | null> {
    try {
      return toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
    } catch {
      return null;
    }
  },
};
