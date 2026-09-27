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

/**
 * Día siguiente a `date` (`yyyy-MM-dd`), en hora local. Sirve para armar fines de rango
 * exclusivos (`< nextDay(endDate)`) sobre columnas con hora.
 */
export function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return toDateString(new Date(year, month - 1, day + 1));
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

export const MAX_DAILY_RANGE_DAYS = 92;

/** Últimos `n` días en hora local, hoy incluido (`getLastNDaysRange(7)` termina hoy). */
export function getLastNDaysRange(n: number): DateRange {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1));
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

/** Todos los días entre `startDate` y `endDate` (`yyyy-MM-dd`), ambos inclusive. */
export function enumerateDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = nextDay(day);
  }
  return days;
}

export type DailyExpensesPreset = "7d" | "30d" | "custom";

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Resuelve el período propio del gráfico de gastos diarios (independiente del filtro de fechas
 * global). Ausente o inválido ⇒ `30d`. `custom` exige fechas bien formadas, `startDate <= endDate`
 * y no más de `MAX_DAILY_RANGE_DAYS` días — si no, también cae a `30d`.
 */
export function resolveDailyExpensesRange(params: {
  dailyRange?: string;
  dailyStart?: string;
  dailyEnd?: string;
}): { preset: DailyExpensesPreset; startDate: string; endDate: string } {
  if (params.dailyRange === "7d") {
    return { preset: "7d", ...getLastNDaysRange(7) };
  }

  if (params.dailyRange === "custom") {
    const { dailyStart, dailyEnd } = params;
    if (
      dailyStart &&
      dailyEnd &&
      isValidDateString(dailyStart) &&
      isValidDateString(dailyEnd) &&
      dailyStart <= dailyEnd &&
      enumerateDays(dailyStart, dailyEnd).length <= MAX_DAILY_RANGE_DAYS
    ) {
      return { preset: "custom", startDate: dailyStart, endDate: dailyEnd };
    }
  }

  return { preset: "7d", ...getLastNDaysRange(30) };
}
