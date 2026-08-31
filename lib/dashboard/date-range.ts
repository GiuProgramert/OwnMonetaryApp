export type DateRange = { startDate: string; endDate: string };

/**
 * Formatea en hora local (no `toISOString()`, que convierte a UTC y en Paraguay
 * devuelve el día anterior — la columna `date` en la base es `date`, sin zona horaria).
 */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

export function getPreviousMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

export function getLastNMonthsRange(months: number): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

export function getCurrentYearRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

/**
 * Si `startDate`/`endDate` no vienen en la URL, cae al mes actual (default del dashboard).
 */
export function resolveDateRange(params: {
  startDate?: string;
  endDate?: string;
}): DateRange {
  if (params.startDate && params.endDate) {
    return { startDate: params.startDate, endDate: params.endDate };
  }

  return getCurrentMonthRange();
}
