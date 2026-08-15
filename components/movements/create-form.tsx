"use client";

import { Button } from "@/components/ui/button";
import MovementFormFields from "@/components/movements/movement-form-fields";
import { movementSchema } from "@/lib/schemas/movements";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { createMovement } from "@/lib/services/movements.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";
import toast from "react-hot-toast";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function CreateMovementForm({ accounts, movementTypes }: Props) {
  const methods = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      description: "",
      amount: 0,
      type: "debit",
      account_id: "",
      movement_type_id: "",
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof movementSchema>) => {
    try {
      await createMovement(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el movimiento"
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
            {isSubmitting ? "Creando..." : "Crear"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
