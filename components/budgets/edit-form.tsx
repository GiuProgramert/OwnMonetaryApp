"use client";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import BudgetFormFields from "@/components/budgets/budget-form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Budget, budgetSchema } from "@/lib/schemas/budgets";
import { MovementType } from "@/lib/schemas/movement-types";
import {
  duplicateBudgetMessage,
  updateBudgetClient,
} from "@/lib/services/budgets.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: Budget;
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function EditBudgetForm({ initialValues, movementTypes }: Props) {
  const methods = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      movement_type_id: initialValues.movement_type_id,
      amount: initialValues.amount,
      is_active: initialValues.is_active,
    },
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof budgetSchema>) => {
    try {
      await updateBudgetClient(initialValues.id, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      toast.error(
        message.includes(duplicateBudgetMessage)
          ? "Ya existe un presupuesto para este tipo de movimiento"
          : "No se pudo guardar el presupuesto"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/budgets");
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <BudgetFormFields movementTypes={movementTypes} />
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Checkbox
                id="is_active"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <div className="grid gap-1">
            <Label htmlFor="is_active">Activo</Label>
            <p className="text-sm text-muted-foreground">
              Pausar un presupuesto (desmarcarlo) conserva todo su histórico;
              eliminarlo lo borra.
            </p>
          </div>
        </div>
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
