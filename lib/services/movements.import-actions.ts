"use server";

import { getExistingExternalIds } from "@/lib/services/movements";

/** Boundary de Server Action para el wizard de importación (Client Component). */
export async function checkExistingExternalIds(accountId: string, externalIds: string[]) {
  return getExistingExternalIds(accountId, externalIds);
}
