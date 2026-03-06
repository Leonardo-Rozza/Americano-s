import { describe, expect, it } from "vitest";
import { buildBracket, getBracketSize } from "../bracket";
import type { Pareja } from "../types";

function makeParejas(n: number): Pareja[] {
  return Array.from({ length: n }, (_, idx) => ({
    id: `p${idx + 1}`,
    nombre: `Pareja ${idx + 1}`,
  }));
}

function countByeSlots(round: { t1: Pareja | null; t2: Pareja | null }[]): number {
  return round.reduce((acc, match) => acc + (match.t1 ? 0 : 1) + (match.t2 ? 0 : 1), 0);
}

describe("bracket", () => {
  it("12 parejas -> cuadro de 16, 4 BYEs", () => {
    const pairs = makeParejas(12);
    const rounds = buildBracket(pairs);
    expect(getBracketSize(pairs.length)).toBe(16);
    expect(rounds.length).toBe(4);
    expect(countByeSlots(rounds[0])).toBe(4);
  });

  it("13 parejas -> cuadro de 16, 3 BYEs", () => {
    const pairs = makeParejas(13);
    const rounds = buildBracket(pairs);
    expect(getBracketSize(pairs.length)).toBe(16);
    expect(countByeSlots(rounds[0])).toBe(3);
  });

  it("21 parejas -> cuadro de 32, 11 BYEs", () => {
    const pairs = makeParejas(21);
    const rounds = buildBracket(pairs);
    expect(getBracketSize(pairs.length)).toBe(32);
    expect(rounds.length).toBe(5);
    expect(countByeSlots(rounds[0])).toBe(11);
  });

  it("evita cruce directo de rivales de grupo cuando hay swap valido", () => {
    const pairs = makeParejas(4);
    const groupRivals = {
      p1: ["p4"],
      p4: ["p1"],
    };

    const rounds = buildBracket(pairs, groupRivals);
    const matchWithP1 = rounds[0].find((m) => m.t1?.id === "p1" || m.t2?.id === "p1");
    expect(matchWithP1).toBeDefined();
    expect([matchWithP1?.t1?.id, matchWithP1?.t2?.id]).not.toContain("p4");
  });
});
