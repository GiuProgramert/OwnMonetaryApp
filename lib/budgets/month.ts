/**
 * Helpers de mes calendario, siempre en hora local (no `toISOString()`, que convierte
 * a UTC y en Paraguay devuelve el día anterior). Un mes se identifica como `YYYY-MM`.
 */

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function formatMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return formatMonth(now.getFullYear(), now.getMonth());
}

export function resolveMonth(params: { month?: string }): string {
  if (params.month && MONTH_REGEX.test(params.month)) {
    return params.month;
  }

  return currentMonth();
}

/** `YYYY-MM-01`, lo que reciben las RPC. */
export function monthToDate(month: string): string {
  return `${month}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return formatMonth(shifted.getFullYear(), shifted.getMonth());
}

/** `"Octubre 2026"`. */
export function getMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

export function isCurrentMonth(month: string): boolean {
  return month === currentMonth();
}
