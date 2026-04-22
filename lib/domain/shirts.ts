export const SHIRT_SIZES = [
  { id: "K116", label: "Kinder 116" },
  { id: "K128", label: "Kinder 128" },
  { id: "K140", label: "Kinder 140" },
  { id: "K152", label: "Kinder 152" },
  { id: "K164", label: "Kinder 164" },
  { id: "XS", label: "XS" },
  { id: "S", label: "S" },
  { id: "M", label: "M" },
  { id: "L", label: "L" },
  { id: "XL", label: "XL" },
  { id: "XXL", label: "XXL" },
  { id: "XXXL", label: "XXXL" },
] as const;

export const SHIRT_SIZE_IDS = SHIRT_SIZES.map((size) => size.id);

export type ShirtSizeId = (typeof SHIRT_SIZE_IDS)[number];

export function isShirtOrderClosed(deadline?: string | Date | null) {
  if (!deadline) return false;

  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;

  const endOfDayUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  );

  return Date.now() > endOfDayUtc;
}

export function parseDateInputEndOfDay(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}T23:59:59.999Z`);
}
