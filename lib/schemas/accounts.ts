import z from "zod";

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre es muy largo"),
});

export type createAccount = z.infer<typeof accountSchema>;

export type Account = {
  id: string;
  name: string;
  current_balance: number;
  created_at: string;
  updated_at: string;
  user_id: string;
};
