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
  date: z.string().min(1, "La fecha es requerida"),
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

// TODO: transferencias entre cuentas (implica cambio de modelo de datos)

export type Movement = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: Type;
  account_id: string;
  movement_type_id: string;
  created_at: string;
  updated_at: string;
  accounts: Pick<Account, "name" | "color" | "user_id">;
  movement_types: Pick<MovementType, "name" | "color">;
};
