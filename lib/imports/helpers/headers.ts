import { FormatCheck } from "@/lib/imports/types";

export type HeaderMatch = {
  headerRowIndex: number;
  columns: Record<string, number>; // header normalizado -> índice de columna
  found: string[]; // labels de header tal como aparecen en el archivo
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Busca la primera fila de la matriz que contenga todos los headers requeridos, por nombre. */
export function locateHeaderRow(
  matrix: unknown[][],
  requiredHeaders: string[]
): HeaderMatch | null {
  const normalizedRequired = requiredHeaders.map(normalizeHeader);

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex];
    const normalizedCells = row.map(normalizeHeader);
    const hasAllRequired = normalizedRequired.every((header) =>
      normalizedCells.includes(header)
    );

    if (!hasAllRequired) {
      continue;
    }

    const columns: Record<string, number> = {};
    normalizedCells.forEach((cell, colIndex) => {
      if (cell) {
        columns[cell] = colIndex;
      }
    });

    return {
      headerRowIndex: rowIndex,
      columns,
      found: row.map((cell) => String(cell ?? "").trim()).filter(Boolean),
    };
  }

  return null;
}

export function checkRequiredColumns(
  match: HeaderMatch | null,
  requiredHeaders: string[]
): FormatCheck {
  if (!match) {
    return { ok: false, missing: requiredHeaders, found: [] };
  }

  const missing = requiredHeaders.filter(
    (header) => !(normalizeHeader(header) in match.columns)
  );

  if (missing.length > 0) {
    return { ok: false, missing, found: match.found };
  }

  return { ok: true };
}

export function columnIndex(match: HeaderMatch, header: string): number {
  const index = match.columns[normalizeHeader(header)];

  if (index === undefined) {
    throw new Error(`Columna no encontrada: "${header}"`);
  }

  return index;
}

export function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
}
