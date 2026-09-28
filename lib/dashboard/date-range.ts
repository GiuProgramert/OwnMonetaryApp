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

/**
 * Zona de la app. `movements.date` guarda hora de Paraguay sin zona, así que "hoy" tiene que
 * salir de esta zona y no de la del proceso Node (en un deploy en UTC, entre las 21:00 y las 24:00
 * `new Date()` ya es mañana).
 */
export const APP_TIME_ZONE = "America/Asuncion";

/** Hoy (`yyyy-MM-dd`) en `APP_TIME_ZONE`, sin importar la zona del runtime. */
export function todayInAppTimeZone(): string {
  // `en-CA` formatea como `yyyy-MM-dd`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `date` (`yyyy-MM-dd`) más `days` días; aritmética de calendario, sin zona horaria. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

/** Últimos `n` días, hoy incluido (`getLastNDaysRange(7)` termina hoy, en `APP_TIME_ZONE`). */
export function getLastNDaysRange(n: number): DateRange {
  const today = todayInAppTimeZone();
  return { startDate: addDays(today, -(n - 1)), endDate: today };
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
 * global). Ausente o inválido ⇒ `7d`. `custom` exige fechas bien formadas, `startDate <= endDate`
 * y no más de `MAX_DAILY_RANGE_DAYS` días — si no, también cae a `7d`.
 *
 * `endDate` es el rango efectivo, cortado en hoy: el gráfico nunca muestra días futuros.
 * `requestedEndDate` es el "Hasta" que eligió el usuario, para los inputs del filtro. Si el rango
 * es íntegramente futuro, `endDate < startDate` (rango vacío).
 */
export function resolveDailyExpensesRange(params: {
  dailyRange?: string;
  dailyStart?: string;
  dailyEnd?: string;
}): {
  preset: DailyExpensesPreset;
  startDate: string;
  endDate: string;
  requestedEndDate: string;
} {
  const today = todayInAppTimeZone();

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
      return {
        preset: "custom",
        startDate: dailyStart,
        endDate: dailyEnd < today ? dailyEnd : today,
        requestedEndDate: dailyEnd,
      };
    }
  }

  if (params.dailyRange === "30d") {
    const range = getLastNDaysRange(30);
    return { preset: "30d", ...range, requestedEndDate: range.endDate };
  }

  const range = getLastNDaysRange(7);
  return { preset: "7d", ...range, requestedEndDate: range.endDate };
}
