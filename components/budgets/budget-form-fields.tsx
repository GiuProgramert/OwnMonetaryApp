"use client";

import { Controller, useFormContext } from "react-hook-form";
import AmountInput from "@/components/amount-input";
import MovementTypeSelect from "@/components/movement-type-select";
import { Label } from "@/components/ui/label";
import { budgetSchema } from "@/lib/schemas/budgets";
import { MovementType } from "@/lib/schemas/movement-types";
import { z } from "zod";

interface Props {
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function BudgetFormFields({ movementTypes }: Props) {
  const {
    control,
    formState: { errors },
  } = useFormContext<z.infer<typeof budgetSchema>>();

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="movement_type_id">Tipo de movimiento</Label>
        <Controller
          control={control}
          name="movement_type_id"
          render={({ field }) => (
            <MovementTypeSelect
              id="movement_type_id"
              movementTypes={movementTypes}
              value={field.value || undefined}
              onChange={field.onChange}
            />
          )}
        />
        {errors.movement_type_id && (
          <p className="text-sm text-destructive">
            {errors.movement_type_id.message}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="amount">Tope mensual (Gs.)</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              id="amount"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>
    </div>
  );
}
