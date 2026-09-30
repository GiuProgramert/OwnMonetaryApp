import type { MovementType } from "@/lib/schemas/movement-types";
import { createClient } from "@/lib/supabase/server";
import { notFoundDetailMessage, transferMovementTypeId } from "../constants";

export async function getMovementTypes({
  includeTransferType = false,
}: { includeTransferType?: boolean } = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("movement_types")
    .select("id,name,description,color,exclude_from_expense_charts,created_at,updated_at");

  if (!includeTransferType) {
    query = query.neq("id", transferMovementTypeId);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as MovementType[];
}

export async function getMovementTypeById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movement_types")
    .select("id,name,description,color,exclude_from_expense_charts,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error && error.details !== notFoundDetailMessage) {
    throw new Error(error.message);
  }

  if (error && error.details === notFoundDetailMessage) {
    return null;
  }

  return data as MovementType;
}

export async function getExcludedFromExpenseChartsTypeNames(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movement_types")
    .select("name")
    .eq("exclude_from_expense_charts", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.name);
}
