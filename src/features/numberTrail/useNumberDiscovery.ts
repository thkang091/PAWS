import { useCallback, useRef, useState } from "react";

import { allAs, type NumberAvailability, type Radius, type SearchPlace } from "@/features/numberTrail/discoveryFlow";
import { NumberRaceError, discoverNearbyNumbers } from "@/services/numberRaceService";

/** Asking again continues a scan the server cut short; this many rounds at most before saying what's still unchecked. */
const MAX_ROUNDS = 8;

/**
 * The 0 to 99 scan around one place. Numbers appear as soon as the server has verified them; the player can stop and
 * use what is already verified. A failed request marks unchecked numbers CHECK_FAILED, never "not found".
 */
export const useNumberDiscovery = (matchId?: string) => {
  const [numbers, setNumbers] = useState<NumberAvailability[]>(allAs("NOT_YET_CHECKED"));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedRadiusM, setChecked] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const run = useRef(0);

  const scan = useCallback(
    async (place: SearchPlace, radiusM: Radius) => {
      const id = ++run.current;
      setRunning(true);
      setError(null);
      setReason(null);
      setChecked(null);
      setNumbers(allAs("CHECKING"));
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const r = await discoverNearbyNumbers({ latitude: place.latitude, longitude: place.longitude, radiusM, manual: place.manual, matchId });
          if (id !== run.current) return;
          if (r.failed) {
            setNumbers(allAs("CHECK_FAILED"));
            setError(r.reason ?? "routing_unavailable");
            break;
          }
          // While more rounds are coming, unchecked numbers are still being checked.
          setNumbers(r.numbers.map((n) => (n.status === "NOT_YET_CHECKED" && r.partial ? { ...n, status: "CHECKING" as const } : n)));
          setChecked(r.checkedRadiusM);
          setReason(r.reason);
          if (!r.partial) break;
          if (round === MAX_ROUNDS - 1) setNumbers(r.numbers);
        }
      } catch (e) {
        if (id !== run.current) return;
        // Whatever was verified stays; the rest is a failed check, not "not found".
        setNumbers((list) => list.map((n) => (n.status === "CHECKING" ? { ...n, status: "CHECK_FAILED" as const } : n)));
        setError((e as NumberRaceError).code ?? "server_error");
      } finally {
        if (id === run.current) setRunning(false);
      }
    },
    [matchId],
  );

  /** Stop here: verified numbers stay usable; the rest is shown as not checked. */
  const stop = useCallback(() => {
    run.current++;
    setRunning(false);
    setNumbers((list) => list.map((n) => (n.status === "CHECKING" ? { ...n, status: "NOT_YET_CHECKED" as const } : n)));
  }, []);

  return { numbers, running, error, checkedRadiusM, reason, scan, stop };
};
