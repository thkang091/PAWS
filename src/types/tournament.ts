export type TournamentStatus =
  | "draft"
  | "scheduled"
  | "registration_open"
  | "registration_closed"
  | "active"
  | "reviewing"
  | "settled"
  | "cancelled";

export type TournamentCurrency = "silver" | "gold";

export type TournamentEvent = {
  id: string;
  title: string;
  description: string;
  status: TournamentStatus;
  challengeGameId: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  entryCurrency: TournamentCurrency;
  entryCost: number;
  maxParticipants: number;
  participantCount: number;
  maxAttemptsPerEntry: number;
  prizeFirst: string;
  prizeSecond: string;
  prizeThird: string;
  createdAt: string;
};

export type TournamentEntryStatus =
  | "joined"
  | "active"
  | "disqualified"
  | "withdrawn";

export type TournamentEntry = {
  id: string;
  tournamentId: string;
  dogId: string;
  userId: string;
  status: TournamentEntryStatus;
  joinedAt: string;
  attemptsUsed: number;
  bestScore: number | null;
  currentRank: number | null;
};

export type TournamentLeaderboardRow = {
  rank: number;
  entryId: string;
  dogId: string;
  dogName: string;
  avatarUrl: string | null;
  score: number;
  submittedAt: string;
  isCurrentUser: boolean;
};