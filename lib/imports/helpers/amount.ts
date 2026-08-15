export type ParsedAmount = { value: number; negative: boolean };

/** "1.234.567,00" | "(1.234,00)" | -1234.5 -> { value: 1234567, negative } */
export function parseAmount(raw: string | number): ParsedAmount {
  if (typeof raw === "number") {
    return { value: Math.round(Math.abs(raw)), negative: raw < 0 };
  }

  const trimmed = raw.trim();

  if (trimmed === "" || trimmed === "-") {
    return { value: 0, negative: false };
  }

  const parenthesized = /^\(.*\)$/.test(trimmed);
  const unwrapped = parenthesized ? trimmed.slice(1, -1) : trimmed;
  const negative = parenthesized || unwrapped.trim().startsWith("-");
  const stripped = unwrapped.replace(/^-/, "").trim();
  const normalized = stripped.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`Monto con formato desconocido: "${raw}"`);
  }

  return { value: Math.round(Math.abs(parsed)), negative };
}
