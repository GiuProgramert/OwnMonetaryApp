import { Transfer } from "@/lib/schemas/transfers";
import { createClient } from "@/lib/supabase/server";

type TransferRow = {
  account_id: string;
  amount: number;
  date: string;
  description: string;
  type: "credit" | "debit";
  accounts: { name: string };
};

export async function getTransferById(transferId: string) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("movements")
    .select("account_id,amount,date,description,type,accounts!inner(name,user_id)")
    .eq("transfer_id", transferId)
    .eq("accounts.user_id", user.data.user.id);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as unknown as TransferRow[];
  const from = rows.find((row) => row.type === "debit");
  const to = rows.find((row) => row.type === "credit");

  if (!from || !to) {
    return null;
  }

  return {
    transfer_id: transferId,
    from_account_id: from.account_id,
    to_account_id: to.account_id,
    from_account_name: from.accounts.name,
    to_account_name: to.accounts.name,
    amount: from.amount,
    date: from.date,
    description: from.description,
  } satisfies Transfer;
}
