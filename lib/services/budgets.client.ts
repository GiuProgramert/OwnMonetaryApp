import type { Budget, createBudget as CreateBudget } from "@/lib/schemas/budgets";
import { budgetSchema } from "@/lib/schemas/budgets";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { monthToDate, resolveMonth } from "@/lib/budgets/month";

/** Constraint única `(user_id, movement_type_id)`; el form la detecta por este texto. */
export const duplicateBudgetMessage = "budgets_user_movement_type_key";

export async function createBudget(params: CreateBudget) {
  const supabase = createBrowserClient();
  const parsed = budgetSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("budgets")
    .insert([parsed.data])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as Budget;
}

export async function updateBudgetClient(id: string, params: CreateBudget) {
  const supabase = createBrowserClient();
  const parsed = budgetSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("budgets")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Solo el mes en curso, nunca los pasados: reescribirlos destruye el histórico.
  const { error: periodError } = await supabase.from("budget_periods").upsert(
    {
      budget_id: id,
      period_month: monthToDate(resolveMonth({})),
      amount: parsed.data.amount,
    },
    { onConflict: "budget_id,period_month" }
  );

  if (periodError) {
    throw new Error(periodError.message);
  }

  return data as unknown as Budget;
}

export async function deleteBudget(id: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("budgets").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
