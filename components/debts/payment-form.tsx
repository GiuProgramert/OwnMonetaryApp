"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import AccountSelect from "@/components/account-select";
import AmountInput from "@/components/amount-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Account } from "@/lib/schemas/accounts";
import { DebtStatus, debtPaymentSchema } from "@/lib/schemas/debts";
import { getMonthLabel } from "@/lib/budgets/month";
import { formatDueDate } from "@/lib/debts/due";
import { nowForInput } from "@/lib/movements/datetime";
import { createDebtPayment } from "@/lib/services/debts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  debt: DebtStatus;
  accounts: Pick<Account, "id" | "name" | "color">[];
  defaultAccountId: string;
  /** Pantalla desde la que se entró (listado, detalle o dashboard), resuelta en la page. */
  returnTo: string;
}

function defaultDescription(debt: DebtStatus): string {
  if (debt.kind === "installments") {
    const next = (debt.paid_installments ?? 0) + 1;
    return `Cuota ${next}/${debt.total_installments} – ${debt.name}`;
  }

  const month = debt.next_due_date ? getMonthLabel(debt.next_due_date.slice(0, 7)) : "";
  return `${debt.name} – ${month}`;
}

export default function PaymentForm({
  debt,
  accounts,
  defaultAccountId,
  returnTo,
}: Props) {
  const methods = useForm<z.infer<typeof debtPaymentSchema>>({
    resolver: zodResolver(debtPaymentSchema),
    defaultValues: {
      account_id: defaultAccountId,
      date: nowForInput(),
      amount: debt.amount,
      description: defaultDescription(debt),
    },
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: z.infer<typeof debtPaymentSchema>) => {
    try {
      await createDebtPayment(debt.id, data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar el pago"
      );
      return;
    }

    await revalidateMyDataAndRedirect(returnTo);
  };

  return (
    <FormProvider {...methods}>
      <p className="text-sm text-muted-foreground mb-4">
        {debt.movement_type_name}
        {debt.next_due_date && ` · vence ${formatDueDate(debt.next_due_date)}`}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="account_id">Cuenta</Label>
            <Controller
              name="account_id"
              control={control}
              render={({ field }) => (
                <AccountSelect
                  id="account_id"
                  accounts={accounts}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {methods.formState.errors.account_id && (
              <p className="text-sm text-destructive">
                {methods.formState.errors.account_id.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" type="datetime-local" {...methods.register("date")} />
            {methods.formState.errors.date && (
              <p className="text-sm text-destructive">
                {methods.formState.errors.date.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Monto</Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <AmountInput
                  id="amount"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={debt.amount_mode === "fixed"}
                />
              )}
            />
            {methods.formState.errors.amount && (
              <p className="text-sm text-destructive">
                {methods.formState.errors.amount.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" {...methods.register("description")} />
            {methods.formState.errors.description && (
              <p className="text-sm text-destructive">
                {methods.formState.errors.description.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar pago"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
