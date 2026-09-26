import { z } from "zod";
import { MovementType } from "@/lib/schemas/movement-types";

export const budgetSchema = z.object({
  movement_type_id: z.uuid("Tipo de movimiento inválido"),
  amount: z.int().positive("El monto debe ser un número entero positivo"),
  is_active: z.boolean(),
});

export type createBudget = z.infer<typeof budgetSchema>;

export type Budget = {
  id: string;
  user_id: string;
  movement_type_id: string;
  amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  movement_types: Pick<MovementType, "name" | "color">;
};

export type BudgetStatus = {
  budget_id: string;
  movement_type_id: string;
  name: string;
  color: string;
  amount_limit: number;
  spent: number;
  is_active: boolean;
  /** `amount_limit - spent`; negativo cuando el presupuesto se excedió. */
  remaining: number;
  /** `spent / amount_limit * 100`; puede pasar de 100. */
  percentage: number;
};

export type BudgetHistoryRow = {
  period_month: string;
  monthLabel: string;
  amount_limit: number;
  spent: number;
  remaining: number;
};

/** `month` en formato `YYYY-MM`. */
export type BudgetFilter = { month: string | undefined };
