import { Account } from "@/lib/schemas/accounts";
import { createClient } from "@/lib/supabase/server";

export async function getAccounts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,current_balance,created_at,updated_at,user_id")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as Account[];
}

export async function getAccountById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,current_balance,created_at,updated_at,user_id")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Account;
}
