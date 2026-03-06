export interface Pareja {
  id: string;
  nombre: string;
}

export interface GrupoConfig {
  g3: number;
  g4: number;
}

export interface RankingEntry {
  pareja: Pareja;
  gf: number;
  gc: number;
  diff: number;
}

export interface BracketMatch {
  round: number;
  idx: number;
  t1: Pareja | null;
  t2: Pareja | null;
  isBye: boolean;
  score1: number | null;
  score2: number | null;
}

export interface MatchResult {
  pareja1Id: string;
  pareja2Id: string;
  gamesPareja1: number;
  gamesPareja2: number;
  completado?: boolean;
}

export interface Round1Result {
  winner: number;
  loser: number;
}

export interface TiebreakInfo {
  parejas: Pareja[];
  byeSlotsInDispute: number;
}
