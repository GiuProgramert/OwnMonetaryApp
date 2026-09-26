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
