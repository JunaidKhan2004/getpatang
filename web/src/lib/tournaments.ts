/** Tournament types. Mirror backend/src/modules/tournaments. */

export type TournamentStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ParticipantStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "WITHDRAWN" | "REJECTED" | "DISQUALIFIED";
export type MatchStatus = "SCHEDULED" | "CHECK_IN" | "LIVE" | "COMPLETED" | "CANCELLED" | "DISPUTED";

export interface TournamentCard {
  id: string;
  slug: string;
  name: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  status: TournamentStatus;
  maxParticipants: number;
  entryFee: number;
  minAge: number;
  season: string;
  bannerUrl: string | null;
  organizerName: string;
  prizeInfo: string | null;
  registeredCount: number;
  registrationOpen: boolean;
}

export interface TournamentDetail extends TournamentCard {
  description: string;
  venueAddress: string | null;
  format: string;
  rules: string;
  safetyRules: string;
  approvedMaterials: string;
  venueRestrictions: string | null;
  permitReference: string | null;
  organizerContact: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  matchCount: number;
  waitlistedCount: number;
  myEntry: { id: string; status: ParticipantStatus; statusNote: string | null; finalPlacement: number | null } | null;
  champion: { userId: string; name: string } | null;
}

export interface MatchPlayer {
  participantId: string;
  userId: string;
  name: string;
  city: string | null;
  seed: number | null;
}

export interface MatchView {
  id: string;
  round: number;
  roundName: string | null;
  matchNumber: number;
  position: number;
  status: MatchStatus;
  isBye: boolean;
  isWalkover: boolean;
  playerA: MatchPlayer | null;
  playerB: MatchPlayer | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  scheduledAt: string | null;
  location: string | null;
  official: { id: string; name: string } | null;
  resultNote: string | null;
  disputeReason: string | null;
  tournament: { id: string; slug: string; name: string; venue: string; city: string; status: TournamentStatus };
}

export interface Participant {
  id: string;
  seed: number | null;
  status: ParticipantStatus;
  finalPlacement: number | null;
  player: { userId: string; name: string; city: string | null; avatarUrl: string | null };
}

export interface RankingRow {
  rank: number;
  player: { userId: string; name: string; city: string | null; avatarUrl: string | null };
  points: number;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  championships: number;
  bestPlacement: number | null;
}

export interface PlayerProfile {
  player: { userId: string; name: string; city: string | null; bio: string | null; avatarUrl: string | null; memberSince: string };
  stats: { rank: number | null; points: number; tournaments: number; championships: number; matches: number; wins: number; losses: number; winRate: number | null };
  badges: { key: string; label: string; description: string }[];
  results: { tournament: { slug: string; name: string; startsAt: string; city: string }; placement: number; points: number; wins: number; losses: number }[];
  upcoming: { slug: string; name: string; startsAt: string; status: TournamentStatus; city: string }[];
  recentMatches: (MatchView & { won: boolean; opponent: MatchPlayer | null })[];
}

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Scheduled",
  CHECK_IN: "Check-in",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export const MATCH_STATUS_TONE: Record<MatchStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  SCHEDULED: "neutral",
  CHECK_IN: "info",
  LIVE: "danger",
  COMPLETED: "success",
  CANCELLED: "neutral",
  DISPUTED: "warning",
};

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Upcoming",
  IN_PROGRESS: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  PENDING: "Spot held (fee pending)",
  CONFIRMED: "Confirmed",
  WAITLISTED: "Waiting list",
  WITHDRAWN: "Withdrawn",
  REJECTED: "Not accepted",
  DISQUALIFIED: "Disqualified",
};

export function placementLabel(p: number | null) {
  if (!p) return "—";
  if (p === 1) return "Champion";
  if (p === 2) return "Runner-up";
  if (p === 3) return "Semi-finalist";
  if (p === 5) return "Quarter-finalist";
  return `Top ${(p - 1) * 2}`;
}

/** Registration as seen by organizers (includes contact details). */
export interface AdminParticipant {
  id: string;
  status: ParticipantStatus;
  seed: number | null;
  statusNote: string | null;
  finalPlacement: number | null;
  registeredAt: string;
  user: { id: string; fullName: string; email: string; phone: string | null; profile: { city: string | null; dateOfBirth: string | null } | null };
}
