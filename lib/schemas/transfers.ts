import { z } from "zod";

export const transferSchema = z
  .object({
    from_account_id: z.uuid("Cuenta de origen inválida"),
    to_account_id: z.uuid("Cuenta de destino inválida"),
    amount: z.int().positive("El monto debe ser un número entero positivo"),
    date: z.string().min(1, "La fecha es requerida"),
    description: z
      .string()
      .min(1, "La descripción es requerida")
      .max(255, "La descripción es muy larga"),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    path: ["to_account_id"],
    message: "La cuenta de destino debe ser distinta a la de origen",
  });

export type createTransfer = z.infer<typeof transferSchema>;

export type Transfer = createTransfer & {
  transfer_id: string;
  from_account_name: string;
  to_account_name: string;
};
