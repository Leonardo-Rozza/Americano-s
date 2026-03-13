export const PADEL_CATEGORY_VALUES = [
  "TERCERA",
  "CUARTA",
  "QUINTA",
  "SEXTA",
  "SEPTIMA",
  "OCTAVA",
  "NOVENA",
] as const;

export type PadelCategory = (typeof PADEL_CATEGORY_VALUES)[number];

const CATEGORY_LABELS: Record<PadelCategory, string> = {
  TERCERA: "3ra",
  CUARTA: "4ta",
  QUINTA: "5ta",
  SEXTA: "6ta",
  SEPTIMA: "7ma",
  OCTAVA: "8va",
  NOVENA: "9na",
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
