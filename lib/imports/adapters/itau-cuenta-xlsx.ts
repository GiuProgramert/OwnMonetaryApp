import { BankAdapter, ExtractIssue, ExtractedRow } from "@/lib/imports/types";
import { normalizeDate } from "@/lib/imports/helpers/date";
import { parseAmount } from "@/lib/imports/helpers/amount";
import {
  checkRequiredColumns,
  columnIndex,
  isBlankRow,
  locateHeaderRow,
} from "@/lib/imports/helpers/headers";
import { readXlsxMatrix } from "@/lib/imports/readers/xlsx";

const REQUIRED_HEADERS = ["Fecha", "Descripcion", "Movimiento", "Debitos", "Creditos"];

function extractRowsFromMatrix(matrix: unknown[][]) {
  const match = locateHeaderRow(matrix, REQUIRED_HEADERS);
  const check = checkRequiredColumns(match, REQUIRED_HEADERS);

  if (!check.ok || !match) {
    throw new Error(
      "El archivo no coincide con el formato esperado para Itaú — Extracto de cuenta."
    );
  }

  const dateCol = columnIndex(match, "Fecha");
  const descriptionCol = columnIndex(match, "Descripcion");
  const documentCol = columnIndex(match, "Movimiento");
  const debitCol = columnIndex(match, "Debitos");
  const creditCol = columnIndex(match, "Creditos");

  const rows: ExtractedRow[] = [];
  const issues: ExtractIssue[] = [];

  for (let i = match.headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];

    if (isBlankRow(row)) {
      break;
    }

    const source = { row: i + 1, raw: row.map((cell) => String(cell ?? "")).join(" | ") };

    try {
      const dateCell = row[dateCol];
      const descriptionCell = row[descriptionCol];

      if (dateCell == null || descriptionCell == null) {
        issues.push({ source, reason: "Falta la fecha o la descripción" });
        continue;
      }

      const date = normalizeDate(dateCell as string | Date | number);
      const description = String(descriptionCell).trim();
      const documentCell = row[documentCol];
      const externalId =
        documentCell != null && String(documentCell).trim() !== ""
          ? String(documentCell).trim()
          : null;

      const debit = parseAmount((row[debitCol] as string | number | null) ?? 0);
      const credit = parseAmount((row[creditCol] as string | number | null) ?? 0);
      const hasDebit = debit.value !== 0;
      const hasCredit = credit.value !== 0;

      if (hasDebit && hasCredit) {
        issues.push({ source, reason: "La fila tiene monto en débito y crédito a la vez" });
        continue;
      }

      if (!hasDebit && !hasCredit) {
        issues.push({ source, reason: "La fila no tiene monto" });
        continue;
      }

      rows.push({
        date,
        description,
        amount: hasCredit ? credit.value : debit.value,
        type: hasCredit ? "credit" : "debit",
        externalId,
        source,
      });
    } catch (error) {
      issues.push({
        source,
        reason: error instanceof Error ? error.message : "Error al leer la fila",
      });
    }
  }

  return { rows, issues };
}

export const itauCuentaXlsxAdapter: BankAdapter = {
  id: "itau-cuenta-xlsx",
  label: "Itaú — Extracto de cuenta (Excel)",
  accept: [".xlsx", ".xls"],
  assertFormat(probe) {
    const match = locateHeaderRow(probe.matrix, REQUIRED_HEADERS);
    return checkRequiredColumns(match, REQUIRED_HEADERS);
  },
  async extract(file) {
    const matrix = await readXlsxMatrix(file);
    return extractRowsFromMatrix(matrix);
  },
};
