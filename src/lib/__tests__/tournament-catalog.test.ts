import { describe, expect, it } from "vitest";
import {
  isFormatSupportedForSport,
  isTournamentCombinationEnabled,
} from "@/lib/tournament-catalog";

describe("tournament-catalog", () => {
  it("habilita solo PADEL + AMERICANO en este corte", () => {
    expect(isTournamentCombinationEnabled("PADEL", "AMERICANO")).toBe(true);
    expect(isTournamentCombinationEnabled("PADEL", "LARGO")).toBe(false);
    expect(isTournamentCombinationEnabled("FUTBOL", "AMERICANO")).toBe(false);
  });

  it("declara formatos soportados por cada deporte", () => {
    expect(isFormatSupportedForSport("PADEL", "LIGA")).toBe(true);
    expect(isFormatSupportedForSport("FUTBOL", "LARGO")).toBe(true);
    expect(isFormatSupportedForSport("TENIS", "AMERICANO")).toBe(true);
  });
});
