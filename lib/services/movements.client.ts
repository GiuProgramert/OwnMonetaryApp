import { Movement, movementSchema, importedMovementSchema } from "@/lib/schemas/movements";
import type { createMovement, createImportedMovement } from "@/lib/schemas/movements";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

const BULK_INSERT_BATCH_SIZE = 200;

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

export async function bulkCreateMovements(rows: createImportedMovement[]) {
  const supabase = createBrowserClient();

  const validated = rows.map((row) => {
    const parsed = importedMovementSchema.safeParse(row);

    if (!parsed.success) {
      throw new Error("Invalid input");
    }

    return parsed.data;
  });

  let inserted = 0;

  for (let i = 0; i < validated.length; i += BULK_INSERT_BATCH_SIZE) {
    const batch = validated.slice(i, i + BULK_INSERT_BATCH_SIZE);

    const { data, error } = await supabase
      .from("movements")
      .upsert(batch, { onConflict: "account_id,external_id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    inserted += data?.length ?? 0;
  }

  return { inserted, skipped: validated.length - inserted };
}

export async function deleteMovement(id: string) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("movements").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
