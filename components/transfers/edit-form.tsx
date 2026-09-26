"use client";

import { Button } from "@/components/ui/button";
import { toInputValue } from "@/lib/movements/datetime";
import TransferFormFields from "@/components/transfers/transfer-form-fields";
import {
  Transfer,
  transferSchema,
  createTransfer as CreateTransferInput,
} from "@/lib/schemas/transfers";
import { Account } from "@/lib/schemas/accounts";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { updateTransfer } from "@/lib/services/transfers.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";
import toast from "react-hot-toast";

interface Props {
  initialValues: Transfer;
  accounts: Pick<Account, "id" | "name" | "color">[];
}

export default function EditTransferForm({ initialValues, accounts }: Props) {
  const methods = useForm<CreateTransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      date: toInputValue(initialValues.date),
      description: initialValues.description,
      amount: initialValues.amount,
      from_account_id: initialValues.from_account_id,
      to_account_id: initialValues.to_account_id,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: CreateTransferInput) => {
    try {
      await updateTransfer(initialValues.transfer_id, data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la transferencia"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/movements");
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TransferFormFields accounts={accounts} />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
