import { Movement, movementSchema } from "@/lib/schemas/movements";
import type { createMovement } from "@/lib/schemas/movements";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export async function createMovement(params: createMovement) {
  const supabase = createBrowserClient();
  const parsed = movementSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("movements")
    .insert([parsed.data])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Movement;
}

export async function updateMovement(id: string, params: createMovement) {
  const supabase = createBrowserClient();
  const parsed = movementSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("movements")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Movement;
}

export async function deleteMovement(id: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("movements").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
