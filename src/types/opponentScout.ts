/** AI-generated scouting intel framed around beating this opponent. */
export interface OpponentScoutIntel {
  /** One-paragraph psychological / style read. */
  playingStyle: string;
  /** Predictability 0–100 (higher = more exploitable patterns). */
  predictabilityScore: number;
  /** Concrete ways to gain an edge. */
  howToBeatThem: string[];
  /** Your practical upper hands / mismatch edges. */
  yourEdges: string[];
  /** Things they do well — avoid walking into these. */
  dangerZones: string[];
  /** Suggested openings / structures when they have White. */
  prepVsTheirWhite: {
    recommendation: string;
    why: string;
    keyIdeas: string[];
  };
  /** Suggested openings / structures when they have Black. */
  prepVsTheirBlack: {
    recommendation: string;
    why: string;
    keyIdeas: string[];
  };
  /** Short pre-game checklist. */
  preGameChecklist: string[];
  /** Mid-game practical tips under clock pressure. */
  overTheBoardTips: string[];
  /** Psychological / tilt patterns. */
  psychologicalNotes: string[];
  /** One crisp battle-plan headline. */
  battlePlanHeadline: string;
}

export interface ColorRecord {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export interface OpeningStat {
  name: string;
  eco?: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  asColor: 'white' | 'black' | 'both';
}

export interface TimeControlStat {
  label: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export type FormResult = 'W' | 'D' | 'L';

export interface OpponentGameStats {
  totalGames: number;
  overall: ColorRecord;
  asWhite: ColorRecord;
  asBlack: ColorRecord;
  openingsAsWhite: OpeningStat[];
  openingsAsBlack: OpeningStat[];
  worstOpenings: OpeningStat[];
  bestOpenings: OpeningStat[];
  timeControls: TimeControlStat[];
  recentForm: FormResult[];
  currentStreak: { type: FormResult; count: number };
  /** Share of losses that immediately follow another loss (tilt proxy). */
  tiltRate: number;
  averageMoves: number;
  preferredTimeControl: string;
  ratingTrend: {
    earliest: number | null;
    latest: number | null;
    delta: number | null;
  };
}

export interface OpponentLiveProfile {
  avatarUrl: string | null;
  ratings: {
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
    puzzle: number | null;
  };
  url: string | null;
}

/** Matchup edge derived from your profile vs their report. */
export interface MatchupEdge {
  yourStrengths: string[];
  theirWeaknesses: string[];
  leveragePoints: string[];
  cautionPoints: string[];
}
