import { describe, expect, it } from "vitest";
import { isValidMatchScore, mergeScoresKeepingDrafts } from "../score-utils";

describe("score-utils", () => {
  it("acepta solo resultados cerrados a 6", () => {
    expect(isValidMatchScore(6, 0)).toBe(true);
    expect(isValidMatchScore(6, 5)).toBe(true);
    expect(isValidMatchScore(5, 6)).toBe(true);
    expect(isValidMatchScore(5, 3)).toBe(false);
    expect(isValidMatchScore(6, 6)).toBe(false);
  });

  it("preserva borradores no guardados cuando llega respuesta del server", () => {
    const prev = {
      a: { s1: "6", s2: "2" },
      b: { s1: "4", s2: "3" },
      c: { s1: "1", s2: "" },
    };

    const merged = mergeScoresKeepingDrafts(prev, [
      { id: "a", gamesPareja1: 6, gamesPareja2: 2 },
      { id: "b", gamesPareja1: null, gamesPareja2: null },
      { id: "c", gamesPareja1: null, gamesPareja2: null },
    ]);

    expect(merged).toEqual({
      a: { s1: "6", s2: "2" },
      b: { s1: "4", s2: "3" },
      c: { s1: "1", s2: "" },
    });
  });
});
