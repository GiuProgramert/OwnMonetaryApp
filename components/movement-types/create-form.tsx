"use client";

import { Controller, useForm } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { movementTypeSchema, MovementType } from "@/lib/schemas/movement-types";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { createMovementType } from "@/lib/services/movement-types.client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  defaultName?: string;
  onCreated?: (type: MovementType) => void;
  idPrefix?: string;
}

export default function CreateMovementTypeForm({
  defaultName,
  onCreated,
  idPrefix = "",
}: Props) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof movementTypeSchema>>({
    resolver: zodResolver(movementTypeSchema),
    defaultValues: {
      name: defaultName ?? "",
      description: "",
      color: "#6B7280",
      exclude_from_expense_charts: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof movementTypeSchema>) => {
    try {
      const created = await createMovementType(data);

      if (onCreated) {
        onCreated(created);
      } else {
        router.back();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear el tipo de movimiento"
      );
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        void handleSubmit(onSubmit)(e);
      }}
      className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}name`}>Nombre</Label>
          <Input
            id={`${idPrefix}name`}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}description`}>Descripción</Label>
          <Input
            id={`${idPrefix}description`}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}color`}>Color</Label>
          <div className="flex gap-2 w-full">
            <Input
              id={`${idPrefix}color`}
              type="color"
              {...register("color")}
              className="w-20 p-0"
            />
            <Input
              aria-label="Código del color"
              disabled
              value={watch("color") || "#000000"}
            />
          </div>
          {errors.color && (
            <p className="text-sm text-destructive">{errors.color.message}</p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="exclude_from_expense_charts"
          render={({ field }) => (
            <Checkbox
              id={`${idPrefix}exclude_from_expense_charts`}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}exclude_from_expense_charts`}>
            Excluir de los gráficos de gastos
          </Label>
          <p className="text-sm text-muted-foreground">
            No aparece en «Gastos por tipo» ni en «Gastos diarios por tipo». Sigue contando en
            saldos, egresos y flujo mensual.
          </p>
        </div>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear"}
        </Button>
      </div>
    </form>
  );
}
