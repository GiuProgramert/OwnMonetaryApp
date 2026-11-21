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
    throw new Error("Los datos del tipo de movimiento no son válidos");
  }

  const { data, error } = await supabase
    .from("movement_types")
    .insert([parsed.data])
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      throw new Error("Solo el dueño de la app puede crear tipos de movimiento");
    }

    if (error.code === "23505") {
      throw new Error("Ya existe un tipo de movimiento con ese nombre");
    }

    throw new Error(error.message);
  }

  return data as MovementType;
}
