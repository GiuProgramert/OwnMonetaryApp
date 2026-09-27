"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import DebtFormFields from "@/components/debts/debt-form-fields";
import { Button } from "@/components/ui/button";
import { DebtStatus, debtSchema } from "@/lib/schemas/debts";
import { MovementType } from "@/lib/schemas/movement-types";
import { updateDebt } from "@/lib/services/debts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: DebtStatus;
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  /** Pantalla desde la que se entró (listado o detalle), resuelta en la page. */
  returnTo: string;
}

export default function EditDebtForm({
  initialValues,
  movementTypes,
  returnTo,
}: Props) {
  const methods = useForm<z.infer<typeof debtSchema>>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: initialValues.name,
      kind: initialValues.kind,
      amount_mode: initialValues.amount_mode,
      amount: initialValues.amount,
      movement_type_id: initialValues.movement_type_id,
      first_due_date: initialValues.first_due_date,
      total_installments: initialValues.total_installments ?? undefined,
      pending_installments: initialValues.remaining_installments ?? undefined,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof debtSchema>) => {
    try {
      await updateDebt(initialValues.id, data, initialValues.payments_count);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la deuda"
      );
      return;
    }

    await revalidateMyDataAndRedirect(returnTo);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <DebtFormFields movementTypes={movementTypes} disableKind />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
