/**
 * Conversiones entre strings `YYYY-MM-DD` y `Date` para los selectores de fecha, siempre en hora
 * local (nunca `toISOString()`, que convierte a UTC y en Paraguay puede devolver el día anterior).
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `Date` → `YYYY-MM-DD` en hora local. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → `Date` a la medianoche local, o `undefined` si el string no es una fecha. */
export function parseDateString(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);

  if (date.getMonth() !== month - 1) {
    return undefined;
  }

  return date;
}

/** `YYYY-MM-DD` → `"21/11/2026"`. Sobre el string, para que el server y el cliente rendericen igual. */
export function formatDateString(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
