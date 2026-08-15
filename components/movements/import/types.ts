import { Type } from "@/lib/schemas/movements";

export type PreviewRowStatus = "new" | "already-imported" | "duplicate-in-file" | "error";

export type PreviewRow = {
  key: string;
  status: PreviewRowStatus;
  included: boolean;
  movementTypeId: string;
  externalId: string | null;
  date: string | null;
  description: string;
  amount: number | null;
  type: Type | null;
  reason: string | null;
};
