import { z } from "zod";

export const debtKindEnum = z.enum(["service", "installments"]);

export type DebtKind = z.infer<typeof debtKindEnum>;

export const debtKindOptions: { value: DebtKind; label: string }[] = [
  { value: "service", label: "Servicio" },
  { value: "installments", label: "En cuotas" },
];

export const amountModeEnum = z.enum(["fixed", "variable"]);

export type AmountMode = z.infer<typeof amountModeEnum>;

export const amountModeOptions: { value: AmountMode; label: string }[] = [
  { value: "fixed", label: "Monto fijo" },
  { value: "variable", label: "Monto variable" },
];

export const debtSchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido").max(100, "El nombre es muy largo"),
    kind: debtKindEnum,
    amount_mode: amountModeEnum,
    amount: z.int().positive("El monto debe ser un número entero positivo"),
    movement_type_id: z.uuid("Tipo de movimiento inválido"),
    // `YYYY-MM-DD`.
    first_due_date: z
      .string()
      .min(1, "El vencimiento es requerido")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
    total_installments: z.int().positive().optional(),
    // No es una columna: el client service la convierte a `initial_paid_installments`.
    pending_installments: z.int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "installments") {
      return;
    }

    if (!data.total_installments) {
      ctx.addIssue({
        code: "custom",
        path: ["total_installments"],
        message: "El total de cuotas es requerido",
      });
    }

    if (data.pending_installments === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["pending_installments"],
        message: "Las cuotas pendientes son requeridas",
      });
    }

    if (
      data.total_installments &&
      data.pending_installments !== undefined &&
      (data.pending_installments < 1 || data.pending_installments > data.total_installments)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["pending_installments"],
        message: "Las cuotas pendientes deben estar entre 1 y el total",
      });
    }
  });

export type createDebt = z.infer<typeof debtSchema>;

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  kind: DebtKind;
  amount_mode: AmountMode;
  amount: number;
  movement_type_id: string;
  first_due_date: string;
  total_installments: number | null;
  initial_paid_installments: number;
  is_finished: boolean;
  created_at: string;
  updated_at: string;
};

export type DebtStatus = Debt & {
  movement_type_name: string;
  movement_type_color: string;
  payments_count: number;
  paid_amount: number;
  paid_installments: number | null;
  remaining_installments: number | null;
  remaining_amount: number | null;
  finished: boolean;
  next_due_date: string | null;
};

export const debtPaymentSchema = z.object({
  account_id: z.uuid("Cuenta inválida"),
  // Mismo regex que `movementSchema`: `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm`.
  date: z
    .string()
    .min(1, "La fecha es requerida")
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "La fecha no es válida"),
  amount: z.int().positive("El monto debe ser un número entero positivo"),
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .max(255, "La descripción es muy larga"),
});

export type createDebtPayment = z.infer<typeof debtPaymentSchema>;
