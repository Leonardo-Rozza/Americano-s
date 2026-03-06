import { generateSeedOrder } from "./seeding";
import type { BracketMatch, Pareja } from "./types";

export type GroupRivals = Record<string, string[]>;

function nextPow2(value: number): number {
  if (value <= 1) {
    return 2;
  }
  let p = 1;
  while (p < value) {
    p *= 2;
  }
  return p;
}

function areRivals(t1: Pareja | null, t2: Pareja | null, groupRivals: GroupRivals): boolean {
  if (!t1 || !t2) {
    return false;
  }
  return groupRivals[t1.id]?.includes(t2.id) ?? false;
}

function tryResolveFirstRoundConflicts(round1: BracketMatch[], groupRivals: GroupRivals): void {
  for (let i = 0; i < round1.length; i += 1) {
    const current = round1[i];
    if (!areRivals(current.t1, current.t2, groupRivals)) {
      continue;
    }

    let solved = false;
    for (let j = i + 1; j < round1.length && !solved; j += 1) {
      const other = round1[j];
      if (!other.t1 || !other.t2 || other.isBye) {
        continue;
      }

      const candidates: Array<["t1" | "t2", "t1" | "t2"]> = [
        ["t1", "t1"],
        ["t1", "t2"],
        ["t2", "t1"],
        ["t2", "t2"],
      ];

      for (const [slotA, slotB] of candidates) {
        const a = current[slotA];
        const b = other[slotB];
        if (!a || !b) {
          continue;
        }

        current[slotA] = b;
        other[slotB] = a;

        const currentOk = !areRivals(current.t1, current.t2, groupRivals);
        const otherOk = !areRivals(other.t1, other.t2, groupRivals);
        if (currentOk && otherOk) {
          solved = true;
          break;
        }

        current[slotA] = a;
        other[slotB] = b;
      }
    }
  }
}

export function buildBracket(rankedParejas: Pareja[], groupRivals: GroupRivals = {}): BracketMatch[][] {
  const n = rankedParejas.length;
  if (n === 0) {
    return [];
  }

  const P = nextPow2(n);
  const seedOrder = generateSeedOrder(P);
  const slots = seedOrder.map((seed) => (seed <= n ? rankedParejas[seed - 1] : null));

  const rounds: BracketMatch[][] = [];
  const round1: BracketMatch[] = [];
  for (let i = 0; i < P / 2; i += 1) {
    const t1 = slots[i * 2];
    const t2 = slots[i * 2 + 1];
    const isBye = !t1 || !t2;
    round1.push({
      round: 1,
      idx: i,
      t1,
      t2,
      isBye,
      score1: null,
      score2: null,
    });
  }

  tryResolveFirstRoundConflicts(round1, groupRivals);
  rounds.push(round1);

  const totalRounds = Math.log2(P);
  for (let round = 2; round <= totalRounds; round += 1) {
    const matchesInRound = P / 2 ** round;
    const matches: BracketMatch[] = [];
    for (let idx = 0; idx < matchesInRound; idx += 1) {
      matches.push({
        round,
        idx,
        t1: null,
        t2: null,
        isBye: false,
        score1: null,
        score2: null,
      });
    }
    rounds.push(matches);
  }

  return rounds;
}

export function getBracketSize(participants: number): number {
  return nextPow2(participants);
}
