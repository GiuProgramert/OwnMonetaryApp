import { z } from "zod";
import { hexColorRegex } from "@/lib/constants";

export const movementTypeSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre es muy largo"),
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .max(255, "La descripción es muy larga"),
  color: z
    .string()
    .min(1, "El color es requerido")
    .max(7, "El color debe tener 7 caracteres como máximo")
    .regex(hexColorRegex, "Formato de color inválido"),
});

export type createMovementType = z.infer<typeof movementTypeSchema>;

export type MovementType = {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
};
