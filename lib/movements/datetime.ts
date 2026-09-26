/**
 * Conversiones de `movements.date` (columna `timestamp` sin zona: la app asume hora de Paraguay).
 * Todo en hora local; nunca `toISOString()`, que convierte a UTC.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DDTHH:mm` en hora local, para el default de un `datetime-local`. */
export function nowForInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Valor de la base → valor de un `datetime-local`. `slice(0, 16)` porque la base trae segundos
 * (y microsegundos con el default `localtimestamp`), que un `datetime-local` sin `step` rechaza.
 */
export function toInputValue(dbValue: string): string {
  return dbValue.slice(0, 16);
}

/**
 * `"26/09/2026"` o `"26/09/2026, 14:30"`. La hora se omite a las 00:00 (los importados entran
 * ahí). La medianoche se detecta sobre el string, no con `getHours()`, para no depender de la
 * zona horaria del runtime.
 */
export function formatMovementDate(dbValue: string): string {
  const [datePart, timePart] = dbValue.replace(" ", "T").split("T");
  const [year, month, day] = datePart.split("-");
  const date = `${day}/${month}/${year}`;
  const time = timePart?.slice(0, 5);

  if (!time || time === "00:00") {
    return date;
  }

  return `${date}, ${time}`;
}
