import type { DebtStatus } from "@/lib/schemas/debts";
import { createClient } from "@/lib/supabase/server";
import { addDaysLocal } from "@/lib/debts/due";

export async function getDebts(): Promise<DebtStatus[]> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_debts_status");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as DebtStatus[];
}

export async function getDebtById(id: string): Promise<DebtStatus | null> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_debts_status", { p_debt_id: id });

  if (error) {
    throw new Error(error.message);
  }

  const row = (data ?? [])[0] as unknown as DebtStatus | undefined;

  return row ?? null;
}

/**
 * Filtra en JS las filas ya agregadas por `getDebts()` (una por deuda): correcto,
 * mismo razonamiento que `BudgetsCard`.
 */
export async function getUpcomingDebts(days = 7): Promise<DebtStatus[]> {
  const debts = await getDebts();
  const limit = addDaysLocal(days);

  return debts.filter(
    (debt) => !debt.finished && debt.next_due_date !== null && debt.next_due_date <= limit
  );
}
