import { buildPlayerIdentityKey } from "@/lib/player-identity";
import { areSamePlayers, buildPairName, isValidPlayerName, normalizePlayerName } from "@/lib/pair-utils";

export const NAME_FORMAT_HELP = "Solo letras y espacios. Numero opcional al final (ej: Perez 2).";

export type PairInput = {
  jugador1: string;
  jugador2: string;
};

export type PairValidationResult = {
  missingJugador1: boolean;
  missingJugador2: boolean;
  invalidJugador1: boolean;
  invalidJugador2: boolean;
  samePlayers: boolean;
  duplicateJugador1: boolean;
  duplicateJugador2: boolean;
  isValid: boolean;
  preview: string | null;
};

export function normalizePairInput<T extends PairInput>(pair: T): T {
  return {
    ...pair,
    jugador1: normalizePlayerName(pair.jugador1),
    jugador2: normalizePlayerName(pair.jugador2),
  };
}

export function normalizePairInputs<T extends PairInput>(pairs: T[]): T[] {
  return pairs.map((pair) => normalizePairInput(pair));
}

export function validatePairInput(pair: PairInput): PairValidationResult {
  const normalized = normalizePairInput(pair);
  const missingJugador1 = normalized.jugador1.length === 0;
  const missingJugador2 = normalized.jugador2.length === 0;
  const invalidJugador1 = !missingJugador1 && !isValidPlayerName(normalized.jugador1);
  const invalidJugador2 = !missingJugador2 && !isValidPlayerName(normalized.jugador2);
  const samePlayers =
    !missingJugador1 &&
    !missingJugador2 &&
    areSamePlayers(normalized.jugador1, normalized.jugador2);

  return {
    missingJugador1,
    missingJugador2,
    invalidJugador1,
    invalidJugador2,
    samePlayers,
    duplicateJugador1: false,
    duplicateJugador2: false,
    isValid: !missingJugador1 && !missingJugador2 && !invalidJugador1 && !invalidJugador2 && !samePlayers,
    preview:
      !missingJugador1 && !missingJugador2
        ? buildPairName(normalized.jugador1, normalized.jugador2)
        : null,
  };
}

function buildDuplicatePlayerFlags(pairs: PairInput[]) {
  const normalizedPairs = normalizePairInputs(pairs);
  const duplicateFlags = normalizedPairs.map(() => ({
    duplicateJugador1: false,
    duplicateJugador2: false,
  }));
  const occurrences = new Map<string, Array<{ index: number; field: keyof PairInput }>>();

  normalizedPairs.forEach((pair, index) => {
    (["jugador1", "jugador2"] as const).forEach((field) => {
      const value = pair[field];
      if (!value || !isValidPlayerName(value)) {
        return;
      }

      const key = buildPlayerIdentityKey(value);
      const current = occurrences.get(key) ?? [];
      current.push({ index, field });
      occurrences.set(key, current);
    });
  });

  for (const entries of occurrences.values()) {
    const distinctPairCount = new Set(entries.map((entry) => entry.index)).size;
    if (distinctPairCount < 2) {
      continue;
    }

    for (const entry of entries) {
      duplicateFlags[entry.index][entry.field === "jugador1" ? "duplicateJugador1" : "duplicateJugador2"] = true;
    }
  }

  return duplicateFlags;
}

export function buildPairValidations(pairs: PairInput[]): PairValidationResult[] {
  const normalizedPairs = normalizePairInputs(pairs);
  const duplicateFlags = buildDuplicatePlayerFlags(normalizedPairs);

  return normalizedPairs.map((pair, index) => {
    const baseValidation = validatePairInput(pair);
    const duplicateValidation = duplicateFlags[index];

    return {
      ...baseValidation,
      ...duplicateValidation,
      isValid:
        baseValidation.isValid &&
        !duplicateValidation.duplicateJugador1 &&
        !duplicateValidation.duplicateJugador2,
    };
  });
}

export function countInvalidPairInputs(pairs: PairInput[]): number {
  return buildPairValidations(pairs).filter((pair) => !pair.isValid).length;
}

export function addPairValidationIssues(
  pair: PairInput,
  addIssue: (field: keyof PairInput, message: string) => void,
) {
  const normalized = normalizePairInput(pair);

  if (!isValidPlayerName(normalized.jugador1)) {
    addIssue("jugador1", "Nombre 1 tiene formato invalido.");
  }

  if (!isValidPlayerName(normalized.jugador2)) {
    addIssue("jugador2", "Nombre 2 tiene formato invalido.");
  }

  if (areSamePlayers(normalized.jugador1, normalized.jugador2)) {
    addIssue("jugador2", "Nombre 1 y Nombre 2 no pueden ser iguales.");
  }
}

export function addDuplicatePlayerIssues(
  pairs: PairInput[],
  addIssue: (index: number, field: keyof PairInput, message: string) => void,
) {
  const duplicateFlags = buildDuplicatePlayerFlags(pairs);

  duplicateFlags.forEach((flags, index) => {
    if (flags.duplicateJugador1) {
      addIssue(index, "jugador1", "Este jugador ya fue cargado en otra pareja.");
    }

    if (flags.duplicateJugador2) {
      addIssue(index, "jugador2", "Este jugador ya fue cargado en otra pareja.");
    }
  });
}
