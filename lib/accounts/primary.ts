import { Account } from "@/lib/schemas/accounts";

/** Sentinela de "todas las cuentas". Viaja explícito en la URL: `?accountId=all`. */
export const allAccountsParam = "all";

export type ResolvedAccountFilter = {
  /** uuid para filtrar contra la base, o `undefined` = sin filtro. Nunca `"all"`. */
  accountId: string | undefined;
  /** Lo que va en la URL y en el `<AccountSelect>`: un uuid o `"all"`. Nunca vacío. */
  param: string;
  /** `true` cuando la cuenta la puso el default (la principal) y no el usuario. */
  isPrimaryDefault: boolean;
};

/**
 * Primera cuenta marcada como principal. Se permiten varias por usuario a
 * propósito (no hay índice único en la base): `getAccounts()` ordena por `name`
 * ascendente, así que "la primera" es la primera alfabéticamente.
 */
export function getPrimaryAccountId(
  accounts: Pick<Account, "id" | "is_primary">[]
): string | undefined {
  return accounts.find((account) => account.is_primary)?.id;
}

/**
 * Resuelve los tres estados del parámetro `accountId`:
 * - ausente  → la cuenta principal (o todas, si el usuario no tiene ninguna)
 * - `"all"`  → todas las cuentas (el usuario limpió el filtro a propósito)
 * - un uuid  → esa cuenta
 *
 * Puro y síncrono, mismo molde que `resolveDateRange` (`lib/dashboard/date-range.ts`).
 * El uuid no se valida contra `accounts`: la RLS ya impide leer cuentas ajenas y
 * un uuid desconocido simplemente devuelve cero resultados.
 */
export function resolveAccountFilter(
  params: { accountId?: string },
  accounts: Pick<Account, "id" | "is_primary">[]
): ResolvedAccountFilter {
  if (params.accountId === allAccountsParam) {
    return {
      accountId: undefined,
      param: allAccountsParam,
      isPrimaryDefault: false,
    };
  }

  if (params.accountId) {
    return {
      accountId: params.accountId,
      param: params.accountId,
      isPrimaryDefault: false,
    };
  }

  const primaryId = getPrimaryAccountId(accounts);

  if (primaryId) {
    return { accountId: primaryId, param: primaryId, isPrimaryDefault: true };
  }

  return {
    accountId: undefined,
    param: allAccountsParam,
    isPrimaryDefault: false,
  };
}
