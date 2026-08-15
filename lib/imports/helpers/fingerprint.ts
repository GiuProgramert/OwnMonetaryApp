import { ExtractedRow } from "@/lib/imports/types";

function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** huella = sha256(date | type | amount | normalizeDescription(description)), truncada */
async function buildFingerprint(row: ExtractedRow): Promise<string> {
  const payload = `${row.date}|${row.type}|${row.amount}|${normalizeDescription(row.description)}`;
  const hash = await sha256Hex(payload);
  return hash.slice(0, 12);
}

/** `doc:<id>` cuando el extracto trae identificador, `fp:<huella>:<ocurrencia>` cuando no. */
export async function buildExternalId(
  row: ExtractedRow,
  occurrenceIndex: number
): Promise<string> {
  if (row.externalId) {
    return `doc:${row.externalId}`;
  }

  const fingerprint = await buildFingerprint(row);
  return `fp:${fingerprint}:${occurrenceIndex}`;
}

/**
 * Calcula el `external_id` prefijado de cada fila, en el mismo orden que `rows`.
 *
 * El identificador del extracto (`doc:`) no siempre es único dentro del archivo: algunos bancos
 * (confirmado en Itaú) reutilizan el mismo número de comprobante para líneas relacionadas pero
 * distintas (p. ej. un cargo y su IVA). Por eso, igual que la huella (`fp:`), `doc:` también lleva
 * sufijo de ocurrencia cuando se repite dentro del archivo — pero solo entonces, para que el caso
 * común siga siendo el `doc:<id>` limpio que describe el diseño.
 */
export async function computeExternalIds(rows: ExtractedRow[]): Promise<string[]> {
  const docCounts = new Map<string, number>();
  const fingerprints: (string | null)[] = [];

  for (const row of rows) {
    if (row.externalId) {
      docCounts.set(row.externalId, (docCounts.get(row.externalId) ?? 0) + 1);
      fingerprints.push(null);
    } else {
      fingerprints.push(await buildFingerprint(row));
    }
  }

  const docOccurrence = new Map<string, number>();
  const fpOccurrence = new Map<string, number>();

  return rows.map((row, index) => {
    if (row.externalId) {
      const total = docCounts.get(row.externalId) ?? 1;

      if (total === 1) {
        return `doc:${row.externalId}`;
      }

      const occurrenceIndex = docOccurrence.get(row.externalId) ?? 0;
      docOccurrence.set(row.externalId, occurrenceIndex + 1);
      return `doc:${row.externalId}:${occurrenceIndex}`;
    }

    const fingerprint = fingerprints[index] as string;
    const occurrenceIndex = fpOccurrence.get(fingerprint) ?? 0;
    fpOccurrence.set(fingerprint, occurrenceIndex + 1);
    return `fp:${fingerprint}:${occurrenceIndex}`;
  });
}
