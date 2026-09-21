/**
 * Column contract for the Resultados YoY workbook.
 *
 * Meta/Real 2026 must stay on columns E/F (indexes 4/5). Columns G/H
 * (indexes 6/7) are attainment and gap and must never be used as inputs.
 */
export const RESULTADOS_YOY_COLUMNS = {
  product: 0,
  company: 2,
  meta: 4,
  real: 5,
  attainment: 6,
  gap: 7,
  average: 9,
  previousMeta: 11,
  previousReal: 12,
  previousAttainment: 13,
  previousGap: 14,
  previousAverage: 16,
  yoy: 18,
  yoyGap: 19,
} as const;

export function resultadosYoyCells(row: unknown[]) {
  return {
    product: row[RESULTADOS_YOY_COLUMNS.product],
    company: row[RESULTADOS_YOY_COLUMNS.company],
    meta: row[RESULTADOS_YOY_COLUMNS.meta],
    real: row[RESULTADOS_YOY_COLUMNS.real],
    attainment: row[RESULTADOS_YOY_COLUMNS.attainment],
    gap: row[RESULTADOS_YOY_COLUMNS.gap],
    average: row[RESULTADOS_YOY_COLUMNS.average],
    previousMeta: row[RESULTADOS_YOY_COLUMNS.previousMeta],
    previousReal: row[RESULTADOS_YOY_COLUMNS.previousReal],
    previousAttainment: row[RESULTADOS_YOY_COLUMNS.previousAttainment],
    previousGap: row[RESULTADOS_YOY_COLUMNS.previousGap],
    previousAverage: row[RESULTADOS_YOY_COLUMNS.previousAverage],
    yoy: row[RESULTADOS_YOY_COLUMNS.yoy],
    yoyGap: row[RESULTADOS_YOY_COLUMNS.yoyGap],
  };
}
