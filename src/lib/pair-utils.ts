import { areSamePlayerIdentity, normalizePlayerName } from "@/lib/player-identity";

export { normalizePlayerName } from "@/lib/player-identity";

const LEGACY_SEPARATORS = [" - ", " / "] as const;
const GENERIC_PAIR_NAME_REGEX = /^Pareja \d+$/;
const PLAYER_NAME_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*(?: [0-9]+)?$/;

export type PairPlayers = {
  jugador1: string;
  jugador2: string;
};

export type PairMode = "CUSTOM" | "GENERIC";

export function isValidPlayerName(value: string) {
  const normalized = normalizePlayerName(value);
  return PLAYER_NAME_REGEX.test(normalized);
}

export function areSamePlayers(jugador1: string, jugador2: string) {
  return areSamePlayerIdentity(jugador1, jugador2);
}

export function buildPairName(jugador1: string, jugador2: string) {
  return `${normalizePlayerName(jugador1)} - ${normalizePlayerName(jugador2)}`;
}

export function trySplitLegacyPairName(nombre: string) {
  const cleanName = normalizePlayerName(nombre);
  if (!cleanName) {
    return null;
  }

  for (const separator of LEGACY_SEPARATORS) {
    if (!cleanName.includes(separator)) {
      continue;
    }

    const parts = cleanName.split(separator).map(normalizePlayerName);
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      continue;
    }

    return { jugador1: parts[0], jugador2: parts[1] } satisfies PairPlayers;
  }

  return null;
}

export function resolvePairPlayers(input: { jugador1?: string | null; jugador2?: string | null; nombre?: string | null }) {
  const jugador1 = input.jugador1 ? normalizePlayerName(input.jugador1) : "";
  const jugador2 = input.jugador2 ? normalizePlayerName(input.jugador2) : "";
  if (jugador1 && jugador2) {
    return { jugador1, jugador2 } satisfies PairPlayers;
  }

  if (!jugador1 && !jugador2 && input.nombre) {
    return trySplitLegacyPairName(input.nombre);
  }

  return { jugador1, jugador2 } satisfies PairPlayers;
}

export function resolvePairDisplayName(input: { nombre?: string | null; jugador1?: string | null; jugador2?: string | null }) {
  const players = resolvePairPlayers(input);
  if (players && players.jugador1 && players.jugador2) {
    return buildPairName(players.jugador1, players.jugador2);
  }

  const fallback = input.nombre ? input.nombre.trim() : "";
  return fallback || "Pareja";
}

export function buildGenericPairName(position: number) {
  return `Pareja ${position}`;
}

export function isGenericPairName(nombre?: string | null) {
  if (!nombre) {
    return false;
  }
  return GENERIC_PAIR_NAME_REGEX.test(nombre.trim());
}

export function isGenericPair(input: { nombre?: string | null; jugador1?: string | null; jugador2?: string | null }) {
  return !input.jugador1 && !input.jugador2 && isGenericPairName(input.nombre);
}
