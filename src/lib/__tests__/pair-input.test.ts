import { describe, expect, it } from "vitest";
import {
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
});

