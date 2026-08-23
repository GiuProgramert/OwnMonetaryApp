import { BankAdapter, ExtractIssue, ExtractedRow, FormatCheck } from "@/lib/imports/types";
import { parseAmount } from "@/lib/imports/helpers/amount";
import { groupIntoLines, TextLine } from "@/lib/imports/helpers/lines";
import { readPdfItems } from "@/lib/imports/readers/pdf";

const REQUIRED_HEADER_PHRASES = [
  "Fecha Conf.",
  "Fecha Tran.",
  "Número Comprobante",
  "Descripción de la Transacción",
  "Importe Débito",
  "Importe Crédito",
  "Saldo Actual",
];

// Fecha Conf. | Fecha Tran. | Nro. Comprobante | Descripción | Ofi. | Débito | Crédito | Saldo
const TRANSACTION_LINE_REGEX =
  /^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\S+)\s+(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;

const ROW_CANDIDATE_PREFIX = /^\d{2}\/\d{2}\s+\d{2}\/\d{2}\s/;

function checkHeaderPhrases(lines: string[]): FormatCheck {
  const text = lines.join("\n");
  const missing = REQUIRED_HEADER_PHRASES.filter((phrase) => !text.includes(phrase));

  if (missing.length > 0) {
    const found = REQUIRED_HEADER_PHRASES.filter((phrase) => text.includes(phrase));
    return { ok: false, missing, found };
  }

  return { ok: true };
}

/**
 * Las filas del extracto solo traen "dd/MM" (sin año): el año se toma de la fecha de estado de
 * cuenta que aparece una sola vez en el encabezado ("Estado de Cta. al dd/MM/yyyy"), tomando el
 * primer patrón dd/MM/yyyy que aparece en el documento.
 *
 * Límite conocido: si el período del extracto cruza un fin de año (p. ej. estado emitido el
 * 05/01 con transacciones del 30/12 anterior), esas filas quedarían mal fechadas con el año del
 * estado. No hay evidencia de ese caso en el archivo de referencia (frecuencia semanal); se deja
 * documentado en vez de resuelto a ciegas.
 */
function findStatementYear(lines: TextLine[]): string | null {
  for (const line of lines) {
    const match = line.raw.match(/\d{2}\/\d{2}\/(\d{4})/);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractRowsFromLines(lines: TextLine[], statementYear: string) {
  const rows: ExtractedRow[] = [];
  const issues: ExtractIssue[] = [];

  for (const line of lines) {
    if (!ROW_CANDIDATE_PREFIX.test(line.raw)) {
      continue;
    }

    const source = { page: line.page, row: line.page * 1000 + Math.round(line.y), raw: line.raw };
    const match = line.raw.match(TRANSACTION_LINE_REGEX);

    if (!match) {
      issues.push({ source, reason: "No se pudo interpretar la fila" });
      continue;
    }

    try {
      const [, , fechaTran, comprobante, description, , debitoRaw, creditoRaw] = match;
      const [day, month] = fechaTran.split("/");
      const date = `${statementYear}-${month}-${day}`;

      const debit = parseAmount(debitoRaw);
      const credit = parseAmount(creditoRaw);
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
        description: description.trim(),
        amount: hasCredit ? credit.value : debit.value,
        type: hasCredit ? "credit" : "debit",
        externalId: comprobante.trim(),
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

export const solarAhorrosPdfAdapter: BankAdapter = {
  id: "solar-ahorros-pdf",
  label: "Solar Banco — Ahorros a la vista (PDF)",
  accept: [".pdf"],
  format: "pdf",
  assertFormat(probe) {
    if (probe.format !== "pdf") {
      return { ok: false, missing: REQUIRED_HEADER_PHRASES, found: [] };
    }

    return checkHeaderPhrases(probe.lines);
  },
  async extract(file) {
    const items = await readPdfItems(file);
    const textLines = groupIntoLines(items);
    const check = checkHeaderPhrases(textLines.map((line) => line.raw));

    if (!check.ok) {
      throw new Error(
        "El archivo no coincide con el formato esperado para Solar Banco — Ahorros a la vista."
      );
    }

    const statementYear = findStatementYear(textLines);

    if (!statementYear) {
      throw new Error("No se pudo determinar el año del extracto (falta la fecha de estado de cuenta).");
    }

    return extractRowsFromLines(textLines, statementYear);
  },
};
