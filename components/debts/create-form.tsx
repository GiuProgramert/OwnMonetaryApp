"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import DebtFormFields from "@/components/debts/debt-form-fields";
import { Button } from "@/components/ui/button";
import { debtSchema } from "@/lib/schemas/debts";
import { MovementType } from "@/lib/schemas/movement-types";
import { createDebt } from "@/lib/services/debts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function CreateDebtForm({ movementTypes }: Props) {
  const methods = useForm<z.infer<typeof debtSchema>>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "",
      kind: "service",
      amount_mode: "fixed",
      amount: 0,
      movement_type_id: "",
      first_due_date: "",
      total_installments: undefined,
      pending_installments: undefined,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof debtSchema>) => {
    try {
      await createDebt(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear la deuda"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/debts");
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <DebtFormFields movementTypes={movementTypes} />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
