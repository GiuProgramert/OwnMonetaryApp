import { Account } from "@/lib/schemas/accounts";
import { createClient } from "@/lib/supabase/server";
import { notFoundDetailMessage } from "../constants";

export async function getAccounts() {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,current_balance,color,created_at,updated_at,user_id")
    .eq("user_id", user.data.user.id)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as Account[];
}

export async function getAccountById(id: string) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,current_balance,color,created_at,updated_at,user_id")
    .eq("id", id)
    .eq("user_id", user.data.user.id)
    .single();

  if (error && error.details !== notFoundDetailMessage) {
    throw new Error(error.message);
  }

  if (error && error.details === notFoundDetailMessage) {
    return null;
  }

  return data as Account;
}
