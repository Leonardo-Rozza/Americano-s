import type { CategoriaPadel as PrismaCategoriaPadel } from "@prisma/client";

export const PADEL_CATEGORY_VALUES = [
  "TERCERA",
  "CUARTA",
  "TERCERA_CUARTA",
  "QUINTA",
  "SEXTA",
  "QUINTA_SEXTA",
  "SEPTIMA",
  "SEXTA_SEPTIMA",
  "OCTAVA",
  "NOVENA",
  "OCTAVA_NOVENA",
] as const satisfies readonly PrismaCategoriaPadel[];

export type PadelCategory = PrismaCategoriaPadel;

const CATEGORY_LABELS: Record<PadelCategory, string> = {
  TERCERA: "3ra",
  CUARTA: "4ta",
  TERCERA_CUARTA: "3ra / 4ta",
  QUINTA: "5ta",
  SEXTA: "6ta",
  QUINTA_SEXTA: "5ta / 6ta",
  SEPTIMA: "7ma",
  SEXTA_SEPTIMA: "6ta / 7ma",
  OCTAVA: "8va",
  NOVENA: "9na",
  OCTAVA_NOVENA: "8va / 9na",
};

const CATEGORY_SET = new Set<string>(PADEL_CATEGORY_VALUES);

export function isPadelCategory(value: string): value is PadelCategory {
  return CATEGORY_SET.has(value);
}

export function parsePadelCategory(value: string | null | undefined): PadelCategory | null {
  if (!value) {
    return null;
  }

  return isPadelCategory(value) ? value : null;
}

export function getPadelCategoryLabel(category: PadelCategory | null | undefined) {
  if (!category) {
    return null;
  }

  return CATEGORY_LABELS[category];
}

export function listPadelCategories() {
  return PADEL_CATEGORY_VALUES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));
}
