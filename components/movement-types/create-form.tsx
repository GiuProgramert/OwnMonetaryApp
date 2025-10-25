"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { movementTypeSchema } from "@/lib/schemas/movement-types";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { createMovementType } from "@/lib/services/movement-types.client";
import { useRouter } from "next/navigation";

export default function CreateMovementTypeForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<z.infer<typeof movementTypeSchema>>({
    resolver: zodResolver(movementTypeSchema),
  });

  const onSubmit = async (data: z.infer<typeof movementTypeSchema>) => {
    await createMovementType(data);
    router.back();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
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
            {...register("color")}
            className="bg-gray-600 border rounded-md w-20 p-0"
          />
          <Input
            id="color"
            disabled
            value={getValues("color") || "#000000"}
            className="bg-gray-600 border rounded-md p-2"
          />
        </div>
        {errors.color && (
          <p className="text-sm text-red-600">{errors.color.message}</p>
        )}
      </div>
      <div>
        <Button>Crear</Button>
      </div>
    </form>
  );
}
