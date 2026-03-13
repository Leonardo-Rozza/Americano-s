import { describe, expect, it } from "vitest";
import {
  addDuplicatePlayerIssues,
  addPairValidationIssues,
  buildPairValidations,
  normalizePairInput,
  validatePairInput,
} from "../pair-input";

describe("pair-input", () => {
  it("normaliza y valida correctamente parejas personalizadas", () => {
    const normalized = normalizePairInput({
      jugador1: "  Ana  ",
      jugador2: " Bea ",
    });

    expect(normalized).toEqual({
      jugador1: "Ana",
      jugador2: "Bea",
    });
    expect(validatePairInput(normalized)).toMatchObject({
      isValid: true,
      preview: "Ana - Bea",
    });
  });

  it("detecta nombres repetidos y formato invalido", () => {
    const validations = buildPairValidations([
      { jugador1: "Ana", jugador2: "Ana" },
      { jugador1: "Juan@", jugador2: "Pedro" },
    ]);

    expect(validations[0]).toMatchObject({
      samePlayers: true,
      isValid: false,
    });
    expect(validations[1]).toMatchObject({
      invalidJugador1: true,
      isValid: false,
    });
  });

  it("detecta jugadores repetidos entre distintas parejas", () => {
    const validations = buildPairValidations([
      { jugador1: "Juan", jugador2: "Perez" },
      { jugador1: "Juan", jugador2: "Lopez" },
    ]);

    expect(validations[0]).toMatchObject({
      duplicateJugador1: true,
      isValid: false,
    });
    expect(validations[1]).toMatchObject({
      duplicateJugador1: true,
      isValid: false,
    });
  });

  it("expone issues reutilizables para zod", () => {
    const issues: Array<{ field: string; message: string }> = [];

    addPairValidationIssues(
      {
        jugador1: "Ana",
        jugador2: "Ana",
      },
      (field, message) => {
        issues.push({ field, message });
      },
    );

    expect(issues).toEqual([
      {
        field: "jugador2",
        message: "Nombre 1 y Nombre 2 no pueden ser iguales.",
      },
    ]);
  });

  it("expone issues de jugadores duplicados entre parejas", () => {
    const issues: Array<{ index: number; field: string; message: string }> = [];

    addDuplicatePlayerIssues(
      [
        { jugador1: "Juan", jugador2: "Perez" },
        { jugador1: "Juan", jugador2: "Lopez" },
      ],
      (index, field, message) => {
        issues.push({ index, field, message });
      },
    );

    expect(issues).toEqual([
      {
        index: 0,
        field: "jugador1",
        message: "Este jugador ya fue cargado en otra pareja.",
      },
      {
        index: 1,
        field: "jugador1",
        message: "Este jugador ya fue cargado en otra pareja.",
      },
    ]);
  });
});
