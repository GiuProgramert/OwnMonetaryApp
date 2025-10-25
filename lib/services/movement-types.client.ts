import type { MovementType } from "@/lib/schemas/movement-types";
import { movementTypeSchema } from "@/lib/schemas/movement-types";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { createMovementType } from "@/lib/schemas/movement-types";

export async function updateMovementTypeClient(
  id: string,
  params: Partial<MovementType>
) {
  const supabase = createBrowserClient();
  const parsed = movementTypeSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("movement_types")
    .update(params)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as MovementType;
}

export async function deleteMovementType(id: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("movement_types").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function createMovementType(params: createMovementType) {
  const supabase = createBrowserClient();
  const parsed = movementTypeSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { data, error } = await supabase
    .from("movement_types")
    .insert([parsed.data])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as MovementType;
}
