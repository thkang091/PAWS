import { confirm, nextBatch, pendingPoints } from "../features/tournament/gps/walkQueue";
import { goodLoop } from "./fixtures/gpsWalks";

describe("sending walk points", () => {
  const points = goodLoop();

  it("sends only what the server has not confirmed, in order", () => {
    expect(pendingPoints(points, 0)).toHaveLength(points.length);
    const batch = nextBatch(points, 20, 10);
    expect(batch.map((p) => p.seq)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });

  it("never resends a confirmed point, even when replies arrive late", () => {
    let sent = 0;
    sent = confirm(sent, 30);
    // An older reply for the first batch lands after the second one.
    sent = confirm(sent, 10);
    expect(sent).toBe(30);
    expect(nextBatch(points, sent).every((p) => p.seq > 30)).toBe(true);
  });

  it("has nothing left once everything is confirmed", () => {
    expect(nextBatch(points, points[points.length - 1].seq)).toEqual([]);
  });
});
