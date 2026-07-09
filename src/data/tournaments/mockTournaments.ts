import type {
  TournamentEvent,
  TournamentLeaderboardRow,
} from "@/types/tournament";

// ─────────────────────────────────────────────
// Dev mock data for tournament MVP.
// These will be replaced by Supabase queries once
// tournament_events / tournament_entries tables exist.
// ─────────────────────────────────────────────

const MOCK_EVENTS: TournamentEvent[] = [
  {
    id: "tnt-mock-001",
    title: "Weekly Sit Challenge",
    description:
      "Hold a reliable sit stay. Best 30-second video wins. Judges look for calm, steady positioning.",
    status: "registration_open",
    challengeGameId: "bh001",
    registrationOpensAt: "2026-07-06T00:00:00Z",
    registrationClosesAt: "2026-07-10T23:59:59Z",
    startsAt: "2026-07-11T00:00:00Z",
    endsAt: "2026-07-18T23:59:59Z",
    entryCurrency: "silver",
    entryCost: 15,
    maxParticipants: 100,
    participantCount: 12,
    maxAttemptsPerEntry: 3,
    prizeFirst: "500 Gold + PAWS Trophy",
    prizeSecond: "250 Gold",
    prizeThird: "100 Gold",
    createdAt: "2026-07-01T12:00:00Z",
  },
  {
    id: "tnt-mock-002",
    title: "Best Recall Cup",
    description:
      "Come when called from 20 ft. Fastest reliable recall wins. Must show dog starting from a stay or down position.",
    status: "active",
    challengeGameId: "bw001",
    registrationOpensAt: "2026-06-01T00:00:00Z",
    registrationClosesAt: "2026-06-02T23:59:59Z",
    startsAt: "2026-06-03T00:00:00Z",
    endsAt: "2026-06-10T23:59:59Z",
    entryCurrency: "silver",
    entryCost: 25,
    maxParticipants: 50,
    participantCount: 34,
    maxAttemptsPerEntry: 3,
    prizeFirst: "1000 Gold + Best Recall Badge",
    prizeSecond: "500 Gold",
    prizeThird: "200 Gold",
    createdAt: "2026-05-15T12:00:00Z",
  },
  {
    id: "tnt-mock-003",
    title: "Calm Stay Weekend",
    description:
      "A relaxed 2-minute stay on a mat. Best calm performance wins. No excitement or movement after the initial settle.",
    status: "settled",
    challengeGameId: "hs001",
    registrationOpensAt: "2026-05-01T00:00:00Z",
    registrationClosesAt: "2026-05-02T23:59:59Z",
    startsAt: "2026-05-03T00:00:00Z",
    endsAt: "2026-05-10T23:59:59Z",
    entryCurrency: "silver",
    entryCost: 20,
    maxParticipants: 50,
    participantCount: 28,
    maxAttemptsPerEntry: 3,
    prizeFirst: "750 Gold + Calm Champion Badge",
    prizeSecond: "375 Gold",
    prizeThird: "150 Gold",
    createdAt: "2026-04-20T12:00:00Z",
  },
];

export const getMockTournaments = (): TournamentEvent[] => MOCK_EVENTS;

export const getMockTournamentById = (
  id: string,
): TournamentEvent | undefined => MOCK_EVENTS.find((e) => e.id === id);

export const getMockLeaderboard = (
  _tournamentId: string,
): TournamentLeaderboardRow[] => {
  // Static example data — same for every dev mock tournament
  return [
    {
      rank: 1,
      entryId: "entry-mock-a",
      dogId: "dog-mock-1",
      dogName: "Luna",
      avatarUrl: null,
      score: 98.5,
      submittedAt: "2026-07-08T14:30:00Z",
      isCurrentUser: false,
    },
    {
      rank: 2,
      entryId: "entry-mock-b",
      dogId: "dog-mock-2",
      dogName: "Max",
      avatarUrl: null,
      score: 92.0,
      submittedAt: "2026-07-08T16:00:00Z",
      isCurrentUser: false,
    },
    {
      rank: 3,
      entryId: "entry-mock-c",
      dogId: "dog-mock-3",
      dogName: "Bella",
      avatarUrl: null,
      score: 87.3,
      submittedAt: "2026-07-07T09:15:00Z",
      isCurrentUser: true,
    },
  ];
};