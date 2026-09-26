"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import BudgetFormFields from "@/components/budgets/budget-form-fields";
import { Button } from "@/components/ui/button";
import { budgetSchema } from "@/lib/schemas/budgets";
import { MovementType } from "@/lib/schemas/movement-types";
import {
  createBudget,
  duplicateBudgetMessage,
} from "@/lib/services/budgets.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function CreateBudgetForm({ movementTypes }: Props) {
  const methods = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { movement_type_id: "", amount: 0, is_active: true },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof budgetSchema>) => {
    try {
      await createBudget(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      toast.error(
        message.includes(duplicateBudgetMessage)
          ? "Ya existe un presupuesto para este tipo de movimiento"
          : "No se pudo crear el presupuesto"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/budgets");
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <BudgetFormFields movementTypes={movementTypes} />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
