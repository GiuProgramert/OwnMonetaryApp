"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AccountSelect from "@/components/account-select";
import AmountInput from "@/components/movements/amount-input";
import { Account } from "@/lib/schemas/accounts";
import { createTransfer } from "@/lib/schemas/transfers";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
}

export default function TransferFormFields({ accounts }: Props) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<createTransfer>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="amount">Monto</Label>
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <AmountInput id="amount" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="from_account_id">Cuenta de origen</Label>
        <Controller
          name="from_account_id"
          control={control}
          render={({ field }) => (
            <AccountSelect
              id="from_account_id"
              accounts={accounts}
              value={field.value}
              onChange={field.onChange}
              excludeId={watch("to_account_id")}
            />
          )}
        />
        {errors.from_account_id && (
          <p className="text-sm text-destructive">{errors.from_account_id.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="to_account_id">Cuenta de destino</Label>
        <Controller
          name="to_account_id"
          control={control}
          render={({ field }) => (
            <AccountSelect
              id="to_account_id"
              accounts={accounts}
              value={field.value}
              onChange={field.onChange}
              excludeId={watch("from_account_id")}
            />
          )}
        />
        {errors.to_account_id && (
          <p className="text-sm text-destructive">{errors.to_account_id.message}</p>
        )}
      </div>
    </div>
  );
}
