import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";

export type MovementFilter = {
  accountId: string | undefined;
  movementTypeId: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
};

export const enum Type {
  CREDIT = "credit",
  DEBIT = "debit",
}

export type Movement = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: Type;
  created_at: string;
  updated_at: string;
  accounts: Pick<Account, "name" | "color" | "user_id">[];
  movement_types: Pick<MovementType, "name" | "color">[];
};
