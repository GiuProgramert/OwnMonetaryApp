"use client";

import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import AmountInput from "@/components/movements/amount-input";
import MovementTypeSelect from "@/components/movement-type-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  amountModeOptions,
  debtKindOptions,
  debtSchema,
} from "@/lib/schemas/debts";
import { MovementType } from "@/lib/schemas/movement-types";

interface Props {
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  /** Deshabilita el select de tipo (servicio/cuotas): ver `edit-form.tsx`. */
  disableKind?: boolean;
}

export default function DebtFormFields({ movementTypes, disableKind }: Props) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<z.infer<typeof debtSchema>>();

  const kind = watch("kind");
  const amountMode = watch("amount_mode");
  const isInstallments = kind === "installments";
  const totalInstallments = watch("total_installments");
  const pendingInstallments = watch("pending_installments");
  const paidSoFar =
    totalInstallments !== undefined && pendingInstallments !== undefined
      ? totalInstallments - pendingInstallments
      : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="kind">Tipo</Label>
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disableKind}
            >
              <SelectTrigger id="kind" className="w-full">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {debtKindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.kind && (
          <p className="text-sm text-destructive">{errors.kind.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="amount_mode">Modalidad</Label>
        <Controller
          name="amount_mode"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="amount_mode" className="w-full">
                <SelectValue placeholder="Selecciona la modalidad" />
              </SelectTrigger>
              <SelectContent>
                {amountModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.amount_mode && (
          <p className="text-sm text-destructive">{errors.amount_mode.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="amount">
          {amountMode === "variable" ? "Monto base (aproximado)" : "Monto"}
        </Label>
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
          <p className="text-sm text-destructive">
            {errors.movement_type_id.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="first_due_date">Próximo vencimiento</Label>
        <Input id="first_due_date" type="date" {...register("first_due_date")} />
        <p className="text-sm text-muted-foreground">
          La próxima cuota o factura que vas a pagar.
        </p>
        {errors.first_due_date && (
          <p className="text-sm text-destructive">{errors.first_due_date.message}</p>
        )}
      </div>

      {isInstallments && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="total_installments">Total de cuotas</Label>
            <Controller
              name="total_installments"
              control={control}
              render={({ field }) => (
                <Input
                  id="total_installments"
                  type="number"
                  min={1}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              )}
            />
            {errors.total_installments && (
              <p className="text-sm text-destructive">
                {errors.total_installments.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pending_installments">Cuotas pendientes</Label>
            <Controller
              name="pending_installments"
              control={control}
              render={({ field }) => (
                <Input
                  id="pending_installments"
                  type="number"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              )}
            />
            {paidSoFar !== undefined && totalInstallments !== undefined && (
              <p className="text-sm text-muted-foreground">
                {paidSoFar} de {totalInstallments} ya pagadas
              </p>
            )}
            {errors.pending_installments && (
              <p className="text-sm text-destructive">
                {errors.pending_installments.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
