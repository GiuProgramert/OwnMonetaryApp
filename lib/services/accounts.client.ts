import { Account, accountSchema } from "@/lib/schemas/accounts";
import type { createAccount } from "@/lib/schemas/accounts";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export async function updateAccount(id: string, params: Partial<Account>) {
  const supabase = createBrowserClient();
  const parsed = accountSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("accounts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Account;
}

export async function createAccount(params: createAccount) {
  const supabase = createBrowserClient();
  const parsed = accountSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }
  const { data, error } = await supabase
    .from("accounts")
    .insert([parsed.data])
    .select()
    .single();

    if (error) {
    throw new Error(error.message);
  }

  return data as Account;
}

export async function deleteAccount(id: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  
  if (error) {
    throw new Error(error.message);
  }

  return true;
}
