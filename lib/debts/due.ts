/**
 * Fechas de vencimiento de deudas, siempre en hora local (nunca `toISOString()`,
 * que convierte a UTC y en Paraguay puede devolver el día anterior).
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** `YYYY-MM-DD` → `"27/09/2026"`. Sobre el string, sin `Date`, para no depender de la zona del runtime. */
export function formatDueDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/** `YYYY-MM-DD` de hoy, en hora local. */
export function todayLocal(): string {
  return toDateString(new Date());
}

/** `YYYY-MM-DD` de hoy + `days`, en hora local. */
export function addDaysLocal(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/** Días entre hoy y `date` (`YYYY-MM-DD`); negativo si `date` ya pasó. */
export function daysUntil(date: string): number {
  const target = parseLocalDate(date);
  const today = parseLocalDate(todayLocal());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function dueLabel(date: string): string {
  const days = daysUntil(date);

  if (days === 0) {
    return "Vence hoy";
  }

  if (days === 1) {
    return "Vence mañana";
  }

  if (days === -1) {
    return "Venció ayer";
  }

  if (days > 1) {
    return `Vence en ${days} días`;
  }

  return `Vencida hace ${Math.abs(days)} días`;
}

export type DueTone = "overdue" | "soon" | "normal";

export function dueTone(date: string): DueTone {
  const days = daysUntil(date);

  if (days < 0) {
    return "overdue";
  }

  if (days <= 7) {
    return "soon";
  }

  return "normal";
}
