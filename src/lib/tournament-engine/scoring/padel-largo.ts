export type PadelLargoSetScore = {
  p1: number;
  p2: number;
  superTiebreak?: boolean;
};

export type PadelLargoScore = {
  sets: PadelLargoSetScore[];
  walkover?: boolean;
};

export type PadelLargoScoreDraft = {
  set1P1: string;
  set1P2: string;
  set2P1: string;
  set2P2: string;
  set3P1: string;
  set3P2: string;
};

export type PadelLargoValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export type PadelLargoDraftEvaluation =
  | { status: "incomplete" }
  | { status: "invalid"; message: string }
  | { status: "valid"; score: PadelLargoScore; winner: "p1" | "p2" };

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function validatePadelLargoSet(
  p1: number,
  p2: number,
  isSuperTiebreak = false,
): boolean {
  if (!isNonNegativeInt(p1) || !isNonNegativeInt(p2) || p1 === p2) {
    return false;
  }

  if (isSuperTiebreak) {
    const winner = Math.max(p1, p2);
    const loser = Math.min(p1, p2);
    return winner >= 10 && winner - loser >= 2;
  }

  const winner = Math.max(p1, p2);
  const loser = Math.min(p1, p2);
  if (winner === 7) {
    return loser === 5 || loser === 6;
  }
  if (winner === 6) {
    return loser <= 4;
  }
  return false;
}

export function getPadelLargoWinner(score: PadelLargoScore): "p1" | "p2" | null {
  let p1Sets = 0;
  let p2Sets = 0;

  for (const set of score.sets) {
    if (set.p1 > set.p2) {
      p1Sets += 1;
    } else if (set.p2 > set.p1) {
      p2Sets += 1;
    }
  }

  if (p1Sets === 2) {
    return "p1";
  }
  if (p2Sets === 2) {
    return "p2";
  }
  return null;
}

export function getPadelLargoMatchStats(score: PadelLargoScore) {
  let setsP1 = 0;
  let setsP2 = 0;
  let gamesP1 = 0;
  let gamesP2 = 0;

  for (const set of score.sets) {
    gamesP1 += set.p1;
    gamesP2 += set.p2;
    if (set.p1 > set.p2) {
      setsP1 += 1;
    } else if (set.p2 > set.p1) {
      setsP2 += 1;
    }
  }

  return {
    setsP1,
    setsP2,
    gamesP1,
    gamesP2,
    winner: getPadelLargoWinner(score),
  };
}

export function validatePadelLargoScore(
  score: PadelLargoScore,
  options?: { allowSuperTiebreakThirdSet?: boolean },
): PadelLargoValidationResult {
  const allowSuperTiebreakThirdSet = Boolean(options?.allowSuperTiebreakThirdSet);

  if (!score || typeof score !== "object" || !Array.isArray(score.sets)) {
    return { valid: false, message: "Score invalido: estructura incorrecta." };
  }

  if (score.sets.length < 2 || score.sets.length > 3) {
    return { valid: false, message: "Score invalido: el partido debe tener 2 o 3 sets." };
  }

  for (let index = 0; index < score.sets.length; index += 1) {
    const set = score.sets[index];
    const isSuperTiebreak = index === 2 && Boolean(set.superTiebreak);
    if (index < 2 && set.superTiebreak) {
      return { valid: false, message: "Solo el tercer set puede ser super tie-break." };
    }
    if (isSuperTiebreak && !allowSuperTiebreakThirdSet) {
      return { valid: false, message: "El super tie-break en tercer set no esta habilitado." };
    }
    if (!validatePadelLargoSet(set.p1, set.p2, isSuperTiebreak)) {
      return { valid: false, message: `Set ${index + 1} invalido.` };
    }
  }

  const firstTwo = score.sets.slice(0, 2);
  const firstTwoStats = getPadelLargoMatchStats({ sets: firstTwo });
  if (score.sets.length === 2 && firstTwoStats.setsP1 === firstTwoStats.setsP2) {
    return { valid: false, message: "Con sets 1-1 debes cargar un tercer set." };
  }
  if (score.sets.length === 3 && (firstTwoStats.setsP1 === 2 || firstTwoStats.setsP2 === 2)) {
    return { valid: false, message: "No corresponde tercer set cuando el partido ya estaba 2-0." };
  }

  const winner = getPadelLargoWinner(score);
  if (!winner) {
    return { valid: false, message: "No se pudo determinar un ganador valido." };
  }

  if (score.walkover) {
    if (score.sets.length !== 2) {
      return { valid: false, message: "W.O. debe cargarse como 6-0 / 6-0." };
    }
    const s1 = score.sets[0];
    const s2 = score.sets[1];
    const woP1 = s1.p1 === 6 && s1.p2 === 0 && s2.p1 === 6 && s2.p2 === 0;
    const woP2 = s1.p1 === 0 && s1.p2 === 6 && s2.p1 === 0 && s2.p2 === 6;
    if (!woP1 && !woP2) {
      return { valid: false, message: "W.O. invalido: debe ser 6-0 / 6-0." };
    }
  }

  return { valid: true };
}

function parseDraftNumber(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

function hasAnyThirdSetInput(draft: PadelLargoScoreDraft): boolean {
  return draft.set3P1.trim().length > 0 || draft.set3P2.trim().length > 0;
}

export function evaluatePadelLargoDraft(
  draft: PadelLargoScoreDraft,
  options?: { allowSuperTiebreakThirdSet?: boolean },
): PadelLargoDraftEvaluation {
  const set1P1 = parseDraftNumber(draft.set1P1.trim());
  const set1P2 = parseDraftNumber(draft.set1P2.trim());
  const set2P1 = parseDraftNumber(draft.set2P1.trim());
  const set2P2 = parseDraftNumber(draft.set2P2.trim());

  if (set1P1 === null || set1P2 === null || set2P1 === null || set2P2 === null) {
    return { status: "incomplete" };
  }

  const baseSets: PadelLargoSetScore[] = [
    { p1: set1P1, p2: set1P2 },
    { p1: set2P1, p2: set2P2 },
  ];
  const baseStats = getPadelLargoMatchStats({ sets: baseSets });
  const splitAfterTwo = baseStats.setsP1 === 1 && baseStats.setsP2 === 1;

  const includeThirdSet = splitAfterTwo || hasAnyThirdSetInput(draft);
  if (!includeThirdSet) {
    const score: PadelLargoScore = { sets: baseSets };
    const validation = validatePadelLargoScore(score, options);
    if (!validation.valid) {
      return { status: "invalid", message: validation.message };
    }
    const winner = getPadelLargoWinner(score);
    if (!winner) {
      return { status: "invalid", message: "No se pudo determinar el ganador." };
    }
    return { status: "valid", score, winner };
  }

  const set3P1 = parseDraftNumber(draft.set3P1.trim());
  const set3P2 = parseDraftNumber(draft.set3P2.trim());
  if (set3P1 === null || set3P2 === null) {
    return { status: "incomplete" };
  }

  const score: PadelLargoScore = {
    sets: [
      ...baseSets,
      {
        p1: set3P1,
        p2: set3P2,
        superTiebreak: Boolean(options?.allowSuperTiebreakThirdSet),
      },
    ],
  };
  const validation = validatePadelLargoScore(score, options);
  if (!validation.valid) {
    return { status: "invalid", message: validation.message };
  }
  const winner = getPadelLargoWinner(score);
  if (!winner) {
    return { status: "invalid", message: "No se pudo determinar el ganador." };
  }
  return { status: "valid", score, winner };
}

function toDraftCell(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

export function createEmptyPadelLargoDraft(): PadelLargoScoreDraft {
  return {
    set1P1: "",
    set1P2: "",
    set2P1: "",
    set2P2: "",
    set3P1: "",
    set3P2: "",
  };
}

export function toPadelLargoDraft(score: PadelLargoScore | null | undefined): PadelLargoScoreDraft {
  if (!score || !Array.isArray(score.sets)) {
    return createEmptyPadelLargoDraft();
  }
  return {
    set1P1: toDraftCell(score.sets[0]?.p1),
    set1P2: toDraftCell(score.sets[0]?.p2),
    set2P1: toDraftCell(score.sets[1]?.p1),
    set2P2: toDraftCell(score.sets[1]?.p2),
    set3P1: toDraftCell(score.sets[2]?.p1),
    set3P2: toDraftCell(score.sets[2]?.p2),
  };
}

function parseSet(raw: unknown): PadelLargoSetScore | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const set = raw as Record<string, unknown>;
  if (!isNonNegativeInt(set.p1) || !isNonNegativeInt(set.p2)) {
    return null;
  }
  return {
    p1: set.p1,
    p2: set.p2,
    ...(typeof set.superTiebreak === "boolean" ? { superTiebreak: set.superTiebreak } : {}),
  };
}

export function parsePadelLargoScore(raw: unknown): PadelLargoScore | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.sets)) {
    return null;
  }

  const sets: PadelLargoSetScore[] = [];
  for (const rawSet of obj.sets) {
    const parsed = parseSet(rawSet);
    if (!parsed) {
      return null;
    }
    sets.push(parsed);
  }

  if (sets.length === 0) {
    return null;
  }

  return {
    sets,
    ...(typeof obj.walkover === "boolean" ? { walkover: obj.walkover } : {}),
  };
}

export function createPadelLargoWalkoverScore(
  winner: "p1" | "p2",
): PadelLargoScore {
  return winner === "p1"
    ? { sets: [{ p1: 6, p2: 0 }, { p1: 6, p2: 0 }], walkover: true }
    : { sets: [{ p1: 0, p2: 6 }, { p1: 0, p2: 6 }], walkover: true };
}
