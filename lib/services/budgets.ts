import type {
  Budget,
  BudgetHistoryRow,
  BudgetStatus,
} from "@/lib/schemas/budgets";
import { createClient } from "@/lib/supabase/server";
import { getMonthLabel, monthToDate, resolveMonth } from "@/lib/budgets/month";
import { notFoundDetailMessage } from "../constants";

const BUDGET_SELECT =
  "id,user_id,movement_type_id,amount,is_active,created_at,updated_at,movement_types!inner(name,color)";

export async function getBudgets() {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .eq("user_id", user.data.user.id)
    .order("name", { referencedTable: "movement_types", ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as Budget[];
}

export async function getBudgetById(id: string) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .eq("id", id)
    .eq("user_id", user.data.user.id)
    .single();

  if (error && error.details !== notFoundDetailMessage) {
    throw new Error(error.message);
  }

  if (error && error.details === notFoundDetailMessage) {
    return null;
  }

  return data as unknown as Budget;
}

/**
 * ⚠️ No cachear: `ensure_budget_periods` escribe durante el render. Si esta lectura se
 * envuelve en un cache de Next, la escritura deja de correr (o corre una sola vez).
 */
export async function getBudgetStatus(month: string): Promise<BudgetStatus[]> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const p_month = monthToDate(resolveMonth({ month }));

  // El orden importa: si get_budget_status corre antes, el mes en curso todavía no tiene
  // fila y nunca queda registrado en el histórico.
  const ensured = await supabase.rpc("ensure_budget_periods", { p_month });

  if (ensured.error) {
    throw new Error(ensured.error.message);
  }

  const { data, error } = await supabase.rpc("get_budget_status", { p_month });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    ...row,
    remaining: row.amount_limit - row.spent,
    percentage: row.amount_limit > 0 ? (row.spent / row.amount_limit) * 100 : 0,
  }));
}

export async function getBudgetHistory(
  budgetId: string,
  months = 12
): Promise<BudgetHistoryRow[]> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_budget_history", {
    p_budget_id: budgetId,
    p_months: months,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    ...row,
    monthLabel: getMonthLabel(row.period_month.slice(0, 7)),
    remaining: row.amount_limit - row.spent,
  }));
}
