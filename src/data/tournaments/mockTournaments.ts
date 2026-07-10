import type {
  TournamentEvent,
  TournamentLeaderboardRow,
} from "@/types/tournament";

// ─────────────────────────────────────────────
// Dev mock data for tournament MVP.
// These will be replaced by Supabase queries once
// tournament_events / tournament_entries tables exist
// (migration 0043).
// ─────────────────────────────────────────────

/** Helper: return an ISO date string offset by `daysFromNow` days. */
const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
};

const MOCK_EVENTS: TournamentEvent[] = [
  {
    id: "tnt-mock-001",
    title: "Weekly Sit Challenge",
    description:
      "Hold a reliable sit stay. Best 30-second video wins. Judges look for calm, steady positioning.",
    status: "registration_open",
    challengeGameId: "bh001",
    registrationOpensAt: daysFromNow(-1),
    registrationClosesAt: daysFromNow(7),
    startsAt: daysFromNow(8),
    endsAt: daysFromNow(15),
    entryCurrency: "silver",
    entryCost: 15,
    maxParticipants: 100,
    participantCount: 12,
    maxAttemptsPerEntry: 3,
    prizeFirst: "500 Gold + PAWS Trophy",
    prizeSecond: "250 Gold",
    prizeThird: "100 Gold",
    createdAt: daysFromNow(-2),
  },
  {
    id: "tnt-mock-002",
    title: "Best Recall Cup",
    description:
      "Come when called from 20 ft. Fastest reliable recall wins. Must show dog starting from a stay or down position.",
    status: "active",
    challengeGameId: "bw001",
    registrationOpensAt: daysFromNow(-14),
    registrationClosesAt: daysFromNow(-7),
    startsAt: daysFromNow(-6),
    endsAt: daysFromNow(3),
    entryCurrency: "silver",
    entryCost: 25,
    maxParticipants: 50,
    participantCount: 34,
    maxAttemptsPerEntry: 3,
    prizeFirst: "1000 Gold + Best Recall Badge",
    prizeSecond: "500 Gold",
    prizeThird: "200 Gold",
    createdAt: daysFromNow(-20),
  },
  {
    id: "tnt-mock-003",
    title: "Trick Dog Showcase",
    description:
      "Show off your dog's best trick! Judges evaluate creativity, clarity of cue, and enthusiasm. Any trick accepted.",
    status: "reviewing",
    challengeGameId: "hs001",
    registrationOpensAt: daysFromNow(-21),
    registrationClosesAt: daysFromNow(-14),
    startsAt: daysFromNow(-13),
    endsAt: daysFromNow(-3),
    entryCurrency: "silver",
    entryCost: 20,
    maxParticipants: 60,
    participantCount: 45,
    maxAttemptsPerEntry: 3,
    prizeFirst: "750 Gold + Trick Champion Badge",
    prizeSecond: "375 Gold",
    prizeThird: "150 Gold",
    createdAt: daysFromNow(-25),
  },
  {
    id: "tnt-mock-004",
    title: "Calm Stay Weekend",
    description:
      "A relaxed 2-minute stay on a mat. Best calm performance wins. No excitement or movement after the initial settle.",
    status: "settled",
    challengeGameId: "hs001",
    registrationOpensAt: daysFromNow(-30),
    registrationClosesAt: daysFromNow(-23),
    startsAt: daysFromNow(-22),
    endsAt: daysFromNow(-15),
    entryCurrency: "silver",
    entryCost: 20,
    maxParticipants: 50,
    participantCount: 28,
    maxAttemptsPerEntry: 3,
    prizeFirst: "750 Gold + Calm Champion Badge",
    prizeSecond: "375 Gold",
    prizeThird: "150 Gold",
    createdAt: daysFromNow(-35),
  },
];

export const getMockTournaments = (): TournamentEvent[] => MOCK_EVENTS;

export const getMockTournamentById = (
  id: string,
): TournamentEvent | undefined => MOCK_EVENTS.find((e) => e.id === id);

export const getMockLeaderboard = (
  _tournamentId: string,
): TournamentLeaderboardRow[] => {
  // Static example data — same for every dev mock tournament.
  // In Phase 2, this will be fetched from tournament_entries + profiles.
  //
  // TODO: For settled tournaments, show finalised winners.
  //   For active/reviewing tournaments, show provisional scores.
  return [
    {
      rank: 1,
      entryId: "entry-mock-a",
      dogId: "dog-mock-1",
      dogName: "Luna",
      avatarUrl: null,
      score: 98.5,
      submittedAt: daysFromNow(-4),
      isCurrentUser: false,
    },
    {
      rank: 2,
      entryId: "entry-mock-b",
      dogId: "dog-mock-2",
      dogName: "Max",
      avatarUrl: null,
      score: 92.0,
      submittedAt: daysFromNow(-3),
      isCurrentUser: false,
    },
    {
      rank: 3,
      entryId: "entry-mock-c",
      dogId: "dog-mock-3",
      dogName: "Bella",
      avatarUrl: null,
      score: 87.3,
      submittedAt: daysFromNow(-5),
      isCurrentUser: true,
    },
    {
      rank: 4,
      entryId: "entry-mock-d",
      dogId: "dog-mock-4",
      dogName: "Charlie",
      avatarUrl: null,
      score: 81.0,
      submittedAt: daysFromNow(-4),
      isCurrentUser: false,
    },
    {
      rank: 5,
      entryId: "entry-mock-e",
      dogId: "dog-mock-5",
      dogName: "Daisy",
      avatarUrl: null,
      score: 76.8,
      submittedAt: daysFromNow(-2),
      isCurrentUser: false,
    },
  ];
};