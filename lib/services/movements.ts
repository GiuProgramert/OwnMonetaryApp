import { Movement, MovementFilter, Type } from "@/lib/schemas/movements";
import { createClient } from "@/lib/supabase/server";
import { notFoundDetailMessage } from "@/lib/constants";

export const MOVEMENTS_PAGE_SIZE = 25;

const MOVEMENT_COLUMNS = `
  id,
  date,
  description,
  amount,
  type,
  account_id,
  movement_type_id,
  created_at,
  updated_at,
  accounts!inner(name,color,user_id),
  movement_types!inner(name,color)
`;

export default async function getMovements({
  movementTypeId,
  startDate,
  endDate,
  accountId,
  page,
}: MovementFilter) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  let query = supabase
    .from("movements")
    .select(MOVEMENT_COLUMNS, { count: "exact" });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  if (movementTypeId) {
    query = query.eq("movement_type_id", movementTypeId);
  }

  if (startDate) {
    query = query.gte("date", startDate);
  }

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const currentPage = page ?? 1;
  const from = (currentPage - 1) * MOVEMENTS_PAGE_SIZE;
  const to = from + MOVEMENTS_PAGE_SIZE - 1;

  const { data, error, count } = await query
    .eq("accounts.user_id", user.data.user.id)
    .order("date", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return { data: data as unknown as Movement[], count: count ?? 0 };
}

export async function getMovementsTotals({
  movementTypeId,
  startDate,
  endDate,
  accountId,
}: Omit<MovementFilter, "page">) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  let query = supabase
    .from("movements")
    .select("amount,type,accounts!inner(user_id)");

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  if (movementTypeId) {
    query = query.eq("movement_type_id", movementTypeId);
  }

  if (startDate) {
    query = query.gte("date", startDate);
  }

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query.eq(
    "accounts.user_id",
    user.data.user.id
  );

  if (error) {
    throw new Error(error.message);
  }

  const movements = data as unknown as { amount: number; type: Type }[];

  const totals = movements.reduce(
    (acc, movement) => {
      if (movement.type === "credit") {
        acc.income += movement.amount;
      } else {
        acc.expense += movement.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return { ...totals, net: totals.income - totals.expense };
}

/**
 * De los `external_id` candidatos, cuáles ya existen en la cuenta.
 *
 * Server-only, como el resto de este archivo. El wizard de importación (Client Component) la
 * invoca a través de `lib/services/movements.import-actions.ts`, no directamente: un `"use server"`
 * por función no alcanza cuando el módulo que la contiene también importa `next/headers`
 * (vía `createClient`) y ese módulo se referencia desde un Client Component — Next lo rechaza en
 * build. La Server Action necesita vivir en un archivo propio con `"use server"` a nivel de módulo.
 */
export async function getExistingExternalIds(accountId: string, externalIds: string[]) {
  if (externalIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("movements")
    .select("external_id, accounts!inner(user_id)")
    .eq("account_id", accountId)
    .eq("accounts.user_id", user.data.user.id)
    .in("external_id", externalIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as { external_id: string }[]).map((row) => row.external_id);
}

export async function getMovementById(id: string) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("movements")
    .select(MOVEMENT_COLUMNS)
    .eq("id", id)
    .eq("accounts.user_id", user.data.user.id)
    .single();

  if (error && error.details !== notFoundDetailMessage) {
    throw new Error(error.message);
  }

  if (error && error.details === notFoundDetailMessage) {
    return null;
  }

  return data as unknown as Movement;
}
