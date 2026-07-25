export const LIVE_RESULT_DISCIPLINE_CODES = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as const;
export type LiveResultDisciplineCode = (typeof LIVE_RESULT_DISCIPLINE_CODES)[number];

export const DEFAULT_LIVE_RESULT_DISCIPLINES: LiveResultDisciplineCode[] = ["RUN", "BENCH", "STOCK"];

export function normalizeLiveResultDisciplines(value: unknown): LiveResultDisciplineCode[] {
  if (!Array.isArray(value)) return DEFAULT_LIVE_RESULT_DISCIPLINES;

  const selected = value.filter((item): item is LiveResultDisciplineCode =>
    LIVE_RESULT_DISCIPLINE_CODES.includes(item as LiveResultDisciplineCode),
  );

  return [...new Set(selected)];
}
