import type { Debt, createDebt, createDebtPayment } from "@/lib/schemas/debts";
import { debtPaymentSchema, debtSchema } from "@/lib/schemas/debts";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

function toInsertPayload(params: createDebt) {
  const isInstallments = params.kind === "installments";

  return {
    name: params.name,
    kind: params.kind,
    amount_mode: params.amount_mode,
    amount: params.amount,
    movement_type_id: params.movement_type_id,
    first_due_date: params.first_due_date,
    total_installments: isInstallments ? params.total_installments : null,
    initial_paid_installments: isInstallments
      ? (params.total_installments as number) - (params.pending_installments as number)
      : 0,
  };
}

export async function createDebt(params: createDebt) {
  const parsed = debtSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("debts")
    .insert([toInsertPayload(parsed.data)])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as Debt;
}

/**
 * `paymentsCount` = pagos ya registrados en la app (`DebtStatus.payments_count`).
 * No manda `kind` (se borra y se crea de nuevo para cambiarlo) ni `is_finished`
 * (solo lo escribe `setDebtFinished`).
 */
export async function updateDebt(id: string, params: createDebt, paymentsCount: number) {
  const parsed = debtSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const isInstallments = parsed.data.kind === "installments";
  const initialPaidInstallments = isInstallments
    ? (parsed.data.total_installments as number) -
      (parsed.data.pending_installments as number) -
      paymentsCount
    : 0;

  if (initialPaidInstallments < 0) {
    throw new Error(
      "Las cuotas pendientes más los pagos ya registrados superan el total de cuotas"
    );
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("debts")
    .update({
      name: parsed.data.name,
      amount_mode: parsed.data.amount_mode,
      amount: parsed.data.amount,
      movement_type_id: parsed.data.movement_type_id,
      first_due_date: parsed.data.first_due_date,
      total_installments: isInstallments ? parsed.data.total_installments : null,
      initial_paid_installments: initialPaidInstallments,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as Debt;
}

export async function deleteDebt(id: string) {
  const supabase = createBrowserClient();
  const { error } = await supabase.from("debts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function setDebtFinished(id: string, value: boolean) {
  const supabase = createBrowserClient();
  const { error } = await supabase.from("debts").update({ is_finished: value }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function createDebtPayment(debtId: string, params: createDebtPayment) {
  const parsed = debtPaymentSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase.rpc("create_debt_payment", {
    p_debt_id: debtId,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
