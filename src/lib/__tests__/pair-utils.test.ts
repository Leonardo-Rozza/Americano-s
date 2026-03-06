import { describe, expect, it } from "vitest";
import {
  buildPairName,
  isGenericPair,
  isValidPlayerName,
  resolvePairDisplayName,
  resolvePairPlayers,
  trySplitLegacyPairName,
} from "../pair-utils";

describe("pair-utils", () => {
  it("buildPairName normaliza espacios y usa separador canonico", () => {
    expect(buildPairName("  Rozza ", "  Lopez   ")).toBe("Rozza - Lopez");
  });

  it("trySplitLegacyPairName parsea nombres legacy con guion o slash", () => {
    expect(trySplitLegacyPairName("Rozza - Lopez")).toEqual({ jugador1: "Rozza", jugador2: "Lopez" });
    expect(trySplitLegacyPairName("Perez / Perez")).toEqual({ jugador1: "Perez", jugador2: "Perez" });
  });

  it("trySplitLegacyPairName devuelve null si no encuentra dos partes validas", () => {
    expect(trySplitLegacyPairName("SoloNombre")).toBeNull();
    expect(trySplitLegacyPairName("A - B - C")).toBeNull();
  });

  it("resolvePairPlayers prioriza jugador1/jugador2 y fallback a nombre legacy", () => {
    expect(resolvePairPlayers({ jugador1: " Ana ", jugador2: "  Bea " })).toEqual({
      jugador1: "Ana",
      jugador2: "Bea",
    });
    expect(resolvePairPlayers({ nombre: "Lolo / Pepe", jugador1: null, jugador2: null })).toEqual({
      jugador1: "Lolo",
      jugador2: "Pepe",
    });
  });

  it("resolvePairDisplayName deriva nombre consistente desde jugadores", () => {
    expect(resolvePairDisplayName({ nombre: "viejo", jugador1: "Ana", jugador2: "Bea" })).toBe("Ana - Bea");
    expect(resolvePairDisplayName({ nombre: "Legacy / Pair", jugador1: null, jugador2: null })).toBe("Legacy - Pair");
  });

  it("isValidPlayerName valida solo letras y numero opcional al final", () => {
    expect(isValidPlayerName("Perez")).toBe(true);
    expect(isValidPlayerName("Juan Perez")).toBe(true);
    expect(isValidPlayerName("Perez 2")).toBe(true);
    expect(isValidPlayerName("2Perez")).toBe(false);
    expect(isValidPlayerName("Perez_2")).toBe(false);
    expect(isValidPlayerName("Perez#")).toBe(false);
  });

  it("isGenericPair detecta el formato Pareja N con jugadores vacios", () => {
    expect(isGenericPair({ nombre: "Pareja 1", jugador1: null, jugador2: null })).toBe(true);
    expect(isGenericPair({ nombre: "Pareja A", jugador1: null, jugador2: null })).toBe(false);
    expect(isGenericPair({ nombre: "Pareja 1", jugador1: "Ana", jugador2: "Bea" })).toBe(false);
  });
});
