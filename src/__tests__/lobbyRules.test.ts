import { ROUTES, battleView, isBattle, roomView, startBlocker, teamCounts, teamsSet, unevenNote } from "@/features/rooms/lobbyRules";
import { TOURNAMENT_GAMES } from "@/features/tournament/catalog";

type M = { ready: boolean; isHost: boolean; team: "blue" | "orange" | null };
const host = (team: M["team"] = "blue"): M => ({ ready: false, isHost: true, team });
const player = (team: M["team"], ready = true): M => ({ ready, isHost: false, team });

describe("team lobby rules", () => {
  const base = { game: "steal_territory" as const, regionId: null, regionPublished: false };

  it("needs at least two players", () => {
    expect(startBlocker({ ...base, members: [host()] })).toBe("Needs 1 more player");
  });

  it("waits for everyone but the host to be ready", () => {
    expect(startBlocker({ ...base, members: [host(), player("orange", false), player("blue", false)] })).toBe("Waiting for 2 to be ready");
  });

  it("needs every player on a team", () => {
    expect(startBlocker({ ...base, members: [host(), player(null)] })).toBe("Put every player on a team");
  });

  it("needs someone on each team", () => {
    expect(startBlocker({ ...base, members: [host("blue"), player("blue")] })).toBe("Both teams need a player");
  });

  it("starts territory without a region", () => {
    expect(startBlocker({ ...base, members: [host("blue"), player("orange")] })).toBeNull();
  });

  it("needs a published road area for road games", () => {
    const members = [host("blue"), player("orange")];
    expect(startBlocker({ ...base, game: "steal_road", members })).toBe("Pick a road area");
    // A picked area that was disabled after it was picked blocks again.
    expect(startBlocker({ ...base, game: "steal_road", members, regionId: "r1", regionPublished: false })).toBe("Pick a road area");
    expect(startBlocker({ ...base, game: "steal_road", members, regionId: "r1", regionPublished: true })).toBeNull();
  });

  it("keeps Find the Mafia's own rules", () => {
    const four = [host(null), player(null), player(null), player(null)];
    expect(startBlocker({ ...base, game: "find_mafia", members: four.slice(0, 3) })).toBe("Needs 1 more player");
    expect(startBlocker({ ...base, game: "find_mafia", members: four, mafiaSetupReady: false })).toBe("Set the checkpoints first");
    expect(startBlocker({ ...base, game: "find_mafia", members: four, mafiaSetupReady: true })).toBeNull();
  });

  it("caps rooms at ten", () => {
    expect(startBlocker({ ...base, members: [host(), ...Array.from({ length: 10 }, () => player("orange"))] })).toBe("Up to 10 players");
  });

  it("counts teams and notes uneven ones without blocking", () => {
    const members = [host("blue"), player("blue"), player("blue"), player("orange")];
    expect(teamCounts(members)).toEqual({ blue: 3, orange: 1, none: 0 });
    expect(teamsSet(members)).toBe(true);
    expect(unevenNote(members)).toBe("Teams are uneven, 3 Blue and 1 Orange.");
    expect(unevenNote([host("blue"), player("blue"), player("orange")])).toBeNull();
    expect(startBlocker({ ...base, members })).toBeNull();
  });
});

describe("battle navigation", () => {
  it("lists both battle games as playable nearby; every nearby game opens Make a room or Join game", () => {
    for (const key of ["steal_territory", "steal_road"] as const) {
      const g = TOURNAMENT_GAMES.find((x) => x.key === key)!;
      expect(g.playable).toBe(true);
      expect(g.mode).toBe("nearby");
      expect(g.route).toBe(ROUTES.nearby);
      expect(g.players).toBe("2 to 10 players");
    }
    expect(TOURNAMENT_GAMES.find((x) => x.key === "find_mafia")?.players).toBe("4 to 10 players");
    expect(TOURNAMENT_GAMES.find((x) => x.key === "find_mafia")?.route).toBe(ROUTES.nearby);
  });

  it("goes from details to creating a room for that game", () => {
    expect(ROUTES.create("steal_territory")).toBe("/game/room/create?game=steal_territory");
    expect(ROUTES.create("steal_road")).toBe("/game/room/create?game=steal_road");
  });

  it("knows which games are battles", () => {
    expect(isBattle("steal_road")).toBe(true);
    expect(isBattle("steal_territory")).toBe(true);
    expect(isBattle("find_mafia")).toBe(false);
    expect(isBattle(undefined)).toBe(false);
  });

  const flow = (game: "steal_territory" | "steal_road") => {
    const v = (roomStatus: "open" | "playing" | "finished" | "cancelled", match: { status: "countdown" | "active" | "completed" } | null) => roomView({ hasState: true, game, roomStatus, match });
    return [roomView({ hasState: false }), v("open", null), v("playing", { status: "countdown" }), v("playing", { status: "active" }), v("finished", { status: "completed" }), v("open", { status: "completed" })];
  };

  it.each(["steal_territory", "steal_road"] as const)("%s walks lobby, battle and back to the lobby on play again", (game) => {
    expect(flow(game)).toEqual(["loading", "lobby", "battle", "battle", "battle", "lobby"]);
  });

  it("shows errors and closed rooms", () => {
    expect(roomView({ hasState: false, errorCode: "room_not_found" })).toBe("error");
    expect(roomView({ hasState: true, game: "steal_road", roomStatus: "cancelled", match: { status: "cancelled" } })).toBe("closed");
  });

  it("keeps a battle room in the lobby until its match row exists", () => {
    expect(roomView({ hasState: true, game: "steal_road", roomStatus: "playing", match: null })).toBe("lobby");
  });

  it("moves the battle screen from countdown to play to results by the server clock", () => {
    const startsAt = new Date(10_000).toISOString();
    expect(battleView("countdown", 5_000, startsAt)).toBe("countdown");
    expect(battleView("active", 5_000, startsAt)).toBe("countdown");
    expect(battleView("active", 11_000, startsAt)).toBe("play");
    expect(battleView("finalizing", 11_000, startsAt)).toBe("play");
    expect(battleView("completed", 11_000, startsAt)).toBe("result");
    expect(battleView("cancelled", 1_000, startsAt)).toBe("result");
  });

  it("puts every admin screen under one roof", () => {
    expect(ROUTES.regions).toBe("/game/battle/regions");
    expect(ROUTES.newRegion).toBe("/game/battle/regions/new");
    expect(ROUTES.region("abc")).toBe("/game/battle/regions/abc");
  });
});

describe("online games", () => {
  it("lists exactly the three online games, all playable; Match My Dog is gone", () => {
    const { TOURNAMENT_GAMES: games } = jest.requireActual("@/features/tournament/catalog") as typeof import("@/features/tournament/catalog");
    expect(games.filter((g) => g.mode === "online").map((g) => g.key)).toEqual(["largest_country", "photo_pose", "dog_reels"]);
    expect(games.every((g) => g.playable)).toBe(true);
    expect(games.some((g) => g.key === "match_my_dog")).toBe(false);
    expect(games.find((g) => g.key === "dog_reels")?.route).toBe("/game/tournament/reels");
  });
});
