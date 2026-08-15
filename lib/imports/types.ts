import { Type } from "@/lib/schemas/movements";

export type ExtractedRow = {
  date: string; // "yyyy-MM-dd"
  description: string;
  amount: number; // siempre positivo, el signo va en `type`
  type: Type;
  externalId: string | null; // nro. de comprobante del extracto, sin prefijo
  source: { page?: number; row: number; raw: string };
};

export type ExtractIssue = {
  source: { page?: number; row: number; raw: string };
  reason: string;
};

export type ExtractResult = {
  rows: ExtractedRow[];
  issues: ExtractIssue[];
};

export type FormatCheck =
  | { ok: true }
  | { ok: false; missing: string[]; found: string[] };

export type AdapterProbe = {
  matrix: unknown[][];
};

export type BankAdapter = {
  id: string;
  label: string;
  accept: string[];
  assertFormat: (probe: AdapterProbe) => FormatCheck;
  extract: (file: File) => Promise<ExtractResult>;
};
