import type { TrackPoint } from "../../../../supabase/functions/tournament/geo";

/**
 * Which recorded points still need to reach the server. Points are numbered in order; the server confirms the
 * highest number it holds, and anything at or below that is never sent again.
 */

export const BATCH_SIZE = 60;
/** Send once this many points are waiting, or on the regular timer, whichever comes first. */
export const SEND_AT = 20;
export const SEND_EVERY_MS = 15_000;

export const pendingPoints = (points: readonly TrackPoint[], sentThrough: number) => points.filter((p) => p.seq > sentThrough);

export const nextBatch = (points: readonly TrackPoint[], sentThrough: number, size = BATCH_SIZE) => pendingPoints(points, sentThrough).slice(0, size);

/** The server's confirmation only ever moves forward, so a late reply can never resend points. */
export const confirm = (sentThrough: number, storedThrough: number) => Math.max(sentThrough, storedThrough);
