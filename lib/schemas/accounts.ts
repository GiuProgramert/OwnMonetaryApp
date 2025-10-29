import z from "zod";
import { hexColorRegex } from "@/lib/constants";

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre es muy largo"),
  color: z
    .string()
    .min(1, "El color es requerido")
    .max(7, "El color debe tener 7 caracteres como máximo")
    .regex(hexColorRegex, "Formato de color inválido"),
});

export type createAccount = z.infer<typeof accountSchema>;

export type Account = {
  id: string;
  name: string;
  current_balance: number;
  color: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};
