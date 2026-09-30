"use client";
import { MovementType, movementTypeSchema } from "@/lib/schemas/movement-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import z from "zod";
import { updateMovementTypeClient as updateMovementType } from "@/lib/services/movement-types.client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: MovementType;
}

export default function EditMovementTypeForm({ initialValues }: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof movementTypeSchema>>({
    resolver: zodResolver(movementTypeSchema),
  });

  const onSubmit = async (data: z.infer<typeof movementTypeSchema>) => {
    await updateMovementType(initialValues.id, data);
    revalidateMyDataAndRedirect("/protected/movement-types");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            defaultValue={initialValues.name}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            defaultValue={initialValues.description || ""}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex gap-2 w-full">
            <Input
              id="color"
              type="color"
              defaultValue={initialValues.color}
              {...register("color")}
              className="w-20 p-0"
            />
            <Input
              id="color"
              disabled
              value={initialValues.color}
              onChange={() => {}}
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
          defaultValue={initialValues.exclude_from_expense_charts}
          render={({ field }) => (
            <Checkbox
              id="exclude_from_expense_charts"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="exclude_from_expense_charts">
            Excluir de los gráficos de gastos
          </Label>
          <p className="text-sm text-muted-foreground">
            No aparece en «Gastos por tipo» ni en «Gastos diarios por tipo». Sigue contando en
            saldos, egresos y flujo mensual.
          </p>
        </div>
      </div>
      <div>
        <Button>Guardar</Button>
      </div>
    </form>
  );
}
