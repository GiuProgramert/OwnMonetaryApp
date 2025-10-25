import type { MovementType } from "@/lib/schemas/movement-types";
import { createClient } from "@/lib/supabase/server";

export async function getMovementTypes() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movement_types")
    .select("id,name,description,color,created_at,updated_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as MovementType[];
}

export async function getMovementTypeById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movement_types")
    .select("id,name,description,color,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as MovementType;
}
