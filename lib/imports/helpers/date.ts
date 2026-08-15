const DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function excelSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000);
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "dd/MM/yyyy" | Date | serial de Excel -> "yyyy-MM-dd" */
export function normalizeDate(value: string | Date | number): string {
  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === "number") {
    return formatDate(excelSerialToDate(value));
  }

  const trimmed = value.trim();
  const match = trimmed.match(DATE_REGEX);

  if (!match) {
    throw new Error(`Fecha con formato desconocido: "${value}"`);
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
