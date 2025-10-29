import { Movement, MovementFilter } from "@/lib/schemas/movements";
import { createClient } from "@/lib/supabase/server";

export default async function getMovements({
  movementTypeId,
  startDate,
  endDate,
  accountId,
}: MovementFilter) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  let query = supabase.from("movements").select(
    `
      id,
      date,
      description,
      amount,
      type,
      created_at,
      updated_at,
      accounts!inner(name,color,user_id),
      movement_types!inner(name,color)
    `
  );

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  if (movementTypeId) {
    query = query.eq("movement_type_id", movementTypeId);
  }

  if (startDate) {
    query = query.gte("date", startDate);
  }

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query
    .eq("accounts.user_id", user.data.user.id)
    .order("date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data as Movement[];
}
