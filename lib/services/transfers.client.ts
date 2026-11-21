import { createTransfer as createTransferInput, transferSchema } from "@/lib/schemas/transfers";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export async function createTransfer(params: createTransferInput) {
  const supabase = createBrowserClient();
  const parsed = transferSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateTransfer(transferId: string, params: createTransferInput) {
  const supabase = createBrowserClient();
  const parsed = transferSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { error } = await supabase.rpc("update_transfer", {
    p_transfer_id: transferId,
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

/**
 * Cambia la fecha de una transferencia (las dos patas) releyendo el resto de los campos y
 * pasándolos por `update_transfer`.
 */
export async function moveTransfer(transferId: string, date: string) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from("movements")
    .select("account_id, type, amount, description")
    .eq("transfer_id", transferId);

  if (error) {
    throw new Error(error.message);
  }

  const debit = data?.find((row) => row.type === "debit");
  const credit = data?.find((row) => row.type === "credit");

  if (!data || data.length !== 2 || !debit || !credit) {
    throw new Error("Transferencia desapareada");
  }

  return updateTransfer(transferId, {
    from_account_id: debit.account_id,
    to_account_id: credit.account_id,
    amount: Number(debit.amount),
    date,
    description: debit.description,
  });
}

export async function deleteTransfer(transferId: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.rpc("delete_transfer", {
    p_transfer_id: transferId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
