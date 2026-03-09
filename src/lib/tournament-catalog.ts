import type { TournamentFormat, TournamentSport } from "@/lib/tournament-engine/types";

export type TournamentSportOption = {
  id: TournamentSport;
  title: string;
  badge: string;
  description: string;
  participantsLabel: string;
};

export type TournamentFormatOption = {
  id: TournamentFormat;
  title: string;
  badge: string;
  description: string;
  supportedSports: TournamentSport[];
};

const ENABLED_COMBINATION_KEYS = new Set<string>(["PADEL:AMERICANO"]);

export const TOURNAMENT_SPORT_OPTIONS: TournamentSportOption[] = [
  {
    id: "PADEL",
    title: "Padel",
    badge: "PDL",
    description: "Parejas de 2 jugadores, score por games o sets.",
    participantsLabel: "parejas",
  },
  {
    id: "FUTBOL",
    title: "Futbol",
    badge: "FBL",
    description: "Equipos de 5 a 11 jugadores, score por goles.",
    participantsLabel: "equipos",
  },
  {
    id: "TENIS",
    title: "Tenis",
    badge: "TNS",
    description: "Singles o dobles, score por sets.",
    participantsLabel: "participantes",
  },
];

export const TOURNAMENT_FORMAT_OPTIONS: TournamentFormatOption[] = [
  {
    id: "AMERICANO",
    title: "Americano",
    badge: "AMER",
    description: "Se juega en un dia con fase de grupos y eliminatoria.",
    supportedSports: ["PADEL", "FUTBOL", "TENIS"],
  },
  {
    id: "LARGO",
    title: "Largo",
    badge: "LARGO",
    description: "Se juega por fechas, con zonas y playoffs.",
    supportedSports: ["PADEL", "FUTBOL", "TENIS"],
  },
  {
    id: "LIGA",
    title: "Liga",
    badge: "LIGA",
    description: "Round robin completo y categorias.",
    supportedSports: ["PADEL", "FUTBOL", "TENIS"],
  },
];

export function buildCombinationKey(deporte: TournamentSport, formato: TournamentFormat) {
  return `${deporte}:${formato}`;
}

export function isTournamentCombinationEnabled(deporte: TournamentSport, formato: TournamentFormat) {
  return ENABLED_COMBINATION_KEYS.has(buildCombinationKey(deporte, formato));
}

export function isFormatSupportedForSport(deporte: TournamentSport, formato: TournamentFormat) {
  const format = TOURNAMENT_FORMAT_OPTIONS.find((item) => item.id === formato);
  if (!format) {
    return false;
  }
  return format.supportedSports.includes(deporte);
}
