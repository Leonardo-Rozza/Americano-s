import { describe, expect, it } from "vitest";
import {
  getPadelCategoryLabel,
  listPadelCategories,
  parsePadelCategory,
} from "../padel-category";

describe("padel-category", () => {
  it("expone labels legibles para categorias intermedias", () => {
    expect(getPadelCategoryLabel("TERCERA_CUARTA")).toBe("3ra / 4ta");
    expect(getPadelCategoryLabel("QUINTA_SEXTA")).toBe("5ta / 6ta");
    expect(getPadelCategoryLabel("SEXTA_SEPTIMA")).toBe("6ta / 7ma");
    expect(getPadelCategoryLabel("OCTAVA_NOVENA")).toBe("8va / 9na");
  });

  it("parsea y lista las categorias intermedias con valores canonicos", () => {
    expect(parsePadelCategory("QUINTA_SEXTA")).toBe("QUINTA_SEXTA");
    expect(parsePadelCategory("QUINTA / SEXTA")).toBeNull();
    expect(listPadelCategories()).toContainEqual({
      value: "QUINTA_SEXTA",
      label: "5ta / 6ta",
    });
  });
});
