"use client";
import { MovementType, movementTypeSchema } from "@/lib/schemas/movement-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          defaultValue={initialValues.name}
          {...register("name")}
          className="bg-gray-600 border rounded-md p-2"
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          defaultValue={initialValues.description || ""}
          {...register("description")}
          className="bg-gray-600 border rounded-md p-2"
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
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
            className="bg-gray-600 border rounded-md w-20 p-0"
          />
          <Input
            id="color"
            disabled
            value={initialValues.color}
            onChange={() => {}}
            className="bg-gray-600 border rounded-md p-2"
          />
        </div>
        {errors.color && (
          <p className="text-sm text-red-600">{errors.color.message}</p>
        )}
      </div>
      <div>
        <Button>Guardar</Button>
      </div>
    </form>
  );
}
