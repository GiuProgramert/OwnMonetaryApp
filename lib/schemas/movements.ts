import { z } from "zod";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";

export type MovementFilter = {
  accountId: string | undefined;
  movementTypeId: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  page: number | undefined;
};

export const typeEnum = z.enum(["credit", "debit"]);

export type Type = z.infer<typeof typeEnum>;

export const typeOptions: { value: Type; label: string }[] = [
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];

export const movementSchema = z.object({
  // `YYYY-MM-DD` (importación, sin hora) o `YYYY-MM-DDTHH:mm` (`datetime-local`).
  date: z
    .string()
    .min(1, "La fecha es requerida")
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/,
      "La fecha no es válida"
    ),
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .max(255, "La descripción es muy larga"),
  amount: z.int().positive("El monto debe ser un número entero positivo"),
  type: typeEnum,
  account_id: z.uuid("Cuenta inválida"),
  movement_type_id: z.uuid("Tipo de movimiento inválido"),
});

export type createMovement = z.infer<typeof movementSchema>;

export const importedMovementSchema = movementSchema.extend({
  external_id: z.string().min(1),
});

export type createImportedMovement = z.infer<typeof importedMovementSchema>;

export type Movement = {
  id: string;
  /**
   * Sigue siendo `string`, pero desde que la columna es `timestamp` trae la hora
   * (`"2026-09-26T14:30:00"`). TS no marca los lugares que asumen solo fecha: usar
   * `formatMovementDate` / `toInputValue` de `lib/movements/datetime.ts`.
   */
  date: string;
  description: string;
  amount: number;
  type: Type;
  account_id: string;
  movement_type_id: string;
  transfer_id: string | null;
  created_at: string;
  updated_at: string;
  accounts: Pick<Account, "name" | "color" | "user_id">;
  movement_types: Pick<MovementType, "name" | "color">;
};
