"use client";

import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import toast from "react-hot-toast";
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
import MovementTypeCombobox from "@/components/movement-type-combobox";
import CreateMovementTypeDialog from "@/components/movement-types/create-dialog";
import { revalidatePathServer } from "@/lib/services/revalidate";
import AmountInput from "@/components/amount-input";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import { createMovement, typeOptions } from "@/lib/schemas/movements";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function MovementFormFields({ accounts, movementTypes }: Props) {
  const [types, setTypes] = useState(movementTypes);
  const [createName, setCreateName] = useState<string | null>(null);
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<createMovement>();

  const handleCreated = (type: MovementType) => {
    setTypes((prev) =>
      [...prev, type].sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
    setValue("movement_type_id", type.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setCreateName(null);
    toast.success("Tipo de movimiento creado");
    void revalidatePathServer("/protected/movement-types");
  };

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="datetime-local"
          {...register("date")}
        />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
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
          <p className="text-sm text-destructive">{errors.amount.message}</p>
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
          <p className="text-sm text-destructive">{errors.type.message}</p>
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
          <p className="text-sm text-destructive">{errors.account_id.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="movement_type_id">Tipo de movimiento</Label>
        <Controller
          name="movement_type_id"
          control={control}
          render={({ field }) => (
            <MovementTypeCombobox
              id="movement_type_id"
              movementTypes={types}
              value={field.value}
              onChange={field.onChange}
              onCreateRequest={setCreateName}
            />
          )}
        />
        {errors.movement_type_id && (
          <p className="text-sm text-destructive">
            {errors.movement_type_id.message}
          </p>
        )}
        <CreateMovementTypeDialog
          open={createName !== null}
          defaultName={createName ?? ""}
          onOpenChange={(open) => {
            if (!open) {
              setCreateName(null);
            }
          }}
          onCreated={handleCreated}
        />
      </div>
    </div>
  );
}
