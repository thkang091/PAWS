/**
 * Number Trail on the phone (Phase N3): GPS status from the tracker's real lifecycle (standing still is not a GPS
 * failure), the glyph geometry, and Follow the Shape gone from every route while its engine stays.
 */
import { GPS_STATUS_RULES, gpsNeedsAttention, gpsStatusOf } from "@/features/numberTrail/gpsStatus";
import { GLYPH, digitPair, numberStrokes } from "@/features/numberTrail/glyphGeometry";
import { TOURNAMENT_GAMES } from "@/features/tournament/catalog";
import { MIN_PLAYERS } from "@/features/rooms/lobbyRules";
import { ALL_NUMBERS } from "../../supabase/functions/tournament/digits";

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "../..");

const base = { access: "granted" as const, servicesOn: true, paused: false, startedAt: 0, lastFixAt: 0, lastAccuracyM: 6, lastMovedAt: 0, now: 0 };

describe("GPS status", () => {
  it("standing still with fixes still arriving is waiting for movement, never lost", () => {
    // 40 s without moving, but the direct check confirmed a fix 10 s ago.
    expect(gpsStatusOf({ ...base, now: 40_000, lastFixAt: 30_000, lastMovedAt: 0 })).toBe("still");
    expect(gpsNeedsAttention("still")).toBe(false);
  });
  it("moving with good fixes is active", () => expect(gpsStatusOf({ ...base, now: 5_000, lastFixAt: 4_000, lastMovedAt: 4_000 })).toBe("active"));
  it("lost only when no fix arrives from the watch or a direct check for a long time", () => {
    expect(gpsStatusOf({ ...base, now: GPS_STATUS_RULES.lostMs + 1_000, lastFixAt: 0 })).toBe("lost");
    expect(gpsStatusOf({ ...base, now: GPS_STATUS_RULES.lostMs - 1_000, lastFixAt: 0 })).not.toBe("lost");
  });
  it("searching at first, lost only after a while without any fix", () => {
    expect(gpsStatusOf({ ...base, lastFixAt: null, lastMovedAt: null, now: 10_000 })).toBe("searching");
    expect(gpsStatusOf({ ...base, lastFixAt: null, lastMovedAt: null, now: GPS_STATUS_RULES.firstFixMs + 1 })).toBe("lost");
  });
  it("permission, location services, pause and poor accuracy", () => {
    expect(gpsStatusOf({ ...base, access: "blocked" })).toBe("denied");
    expect(gpsStatusOf({ ...base, servicesOn: false })).toBe("off");
    expect(gpsStatusOf({ ...base, paused: true })).toBe("paused");
    expect(gpsStatusOf({ ...base, now: 1_000, lastFixAt: 1_000, lastAccuracyM: 40 })).toBe("poor");
    for (const s of ["denied", "off", "lost", "poor"] as const) expect(gpsNeedsAttention(s)).toBe(true);
  });
});

describe("the number glyph", () => {
  it("draws every number, leading zeros kept, in the frame", () => {
    for (const n of ALL_NUMBERS) {
      const g = numberStrokes(n);
      expect(g.paths[0].startsWith("M")).toBe(true);
      expect(g.paths[1].startsWith("M")).toBe(true);
      expect(g.width).toBeCloseTo(GLYPH.width);
      for (const [x, y] of g.starts) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(GLYPH.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(GLYPH.height);
      }
    }
  });
  it("digit one ends where the link to digit two is shortest", () => {
    const [a, b] = digitPair("42");
    const link = Math.hypot(b.start[0] - a.end[0], b.start[1] - a.end[1]);
    // The 4's right stroke top to the 2's top-left corner: just the gap between the digits.
    expect(link).toBeLessThan(0.7);
  });
});

describe("Follow the Shape is replaced by Number Trail", () => {
  it("the hub lists Number Trail as a nearby game and no longer lists Follow the Shape", () => {
    expect(TOURNAMENT_GAMES.some((g) => g.key === "follow_shape")).toBe(false);
    const nt = TOURNAMENT_GAMES.find((g) => g.key === "number_trail")!;
    expect(nt).toMatchObject({ mode: "nearby", title: "Number Trail", route: "/game/tournament?mode=nearby" });
    expect(MIN_PLAYERS.number_trail).toBe(2);
  });
  it("no route reaches the old screens; the shared routing engine stays", () => {
    for (const f of ["follow-shape", "shapes", "shape-setup", "shape-routes", "shape-walk", "shape-result"]) {
      expect(fs.existsSync(path.join(root, `app/game/tournament/${f}.tsx`))).toBe(false);
    }
    const layout: string = fs.readFileSync(path.join(root, "app/game/_layout.tsx"), "utf8");
    expect(layout).not.toMatch(/shape-|follow-shape|tournament\/shapes/);
    expect(layout).toMatch(/number-trail\/room\/\[id\]/);
    for (const f of ["osm.ts", "routes.ts", "routeScore.ts"]) expect(fs.existsSync(path.join(root, `supabase/functions/tournament/${f}`))).toBe(true);
  });
  it("no user-facing screen mentions Follow the Shape or its shapes", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx$/.test(e.name)) files.push(p);
      }
    };
    walk(path.join(root, "app"));
    walk(path.join(root, "src/features/tournament"));
    walk(path.join(root, "src/features/numberTrail"));
    for (const f of files) {
      const text: string = fs.readFileSync(f, "utf8");
      // Strings shown to people, not code comments.
      const shown = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect([f, /Follow the Shape|Heart challenge|Star challenge|Triangle challenge/.test(shown)]).toEqual([f, false]);
    }
  });
  it("no temporary preview routes ship", () => {
    expect(fs.existsSync(path.join(root, "app/nt-preview"))).toBe(false);
    expect(fs.existsSync(path.join(root, "app/nt-preview.tsx"))).toBe(false);
  });
});
