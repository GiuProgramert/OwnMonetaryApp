"use client";

import { Button } from "@/components/ui/button";
import MovementFormFields from "@/components/movements/movement-form-fields";
import { Movement, movementSchema } from "@/lib/schemas/movements";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { updateMovement } from "@/lib/services/movements.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";
import toast from "react-hot-toast";

interface Props {
  initialValues: Movement;
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function EditMovementForm({
  initialValues,
  accounts,
  movementTypes,
}: Props) {
  const methods = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      date: initialValues.date,
      description: initialValues.description,
      amount: initialValues.amount,
      type: initialValues.type,
      account_id: initialValues.account_id,
      movement_type_id: initialValues.movement_type_id,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof movementSchema>) => {
    try {
      await updateMovement(initialValues.id, data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el movimiento"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/movements");
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <MovementFormFields accounts={accounts} movementTypes={movementTypes} />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
