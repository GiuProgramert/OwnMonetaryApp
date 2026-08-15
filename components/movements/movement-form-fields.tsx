"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AccountSelect from "@/components/account-select";
import MovementTypeSelect from "@/components/movement-type-select";
import AmountInput from "@/components/movements/amount-input";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import { createMovement, typeOptions } from "@/lib/schemas/movements";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function MovementFormFields({ accounts, movementTypes }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<createMovement>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="date"
          {...register("date")}
          className="bg-gray-600 border rounded-md p-2"
        />
        {errors.date && (
          <p className="text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          {...register("description")}
          className="bg-gray-600 border rounded-md p-2"
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="amount">Monto</Label>
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <AmountInput id="amount" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="type">Naturaleza</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Selecciona la naturaleza" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && (
          <p className="text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

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
        {errors.account_id && (
          <p className="text-sm text-red-600">{errors.account_id.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="movement_type_id">Tipo de movimiento</Label>
        <Controller
          name="movement_type_id"
          control={control}
          render={({ field }) => (
            <MovementTypeSelect
              id="movement_type_id"
              movementTypes={movementTypes}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.movement_type_id && (
          <p className="text-sm text-red-600">
            {errors.movement_type_id.message}
          </p>
        )}
      </div>
    </div>
  );
}
