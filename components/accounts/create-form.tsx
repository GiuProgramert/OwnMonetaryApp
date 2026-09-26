"use client";
// TODO: extract shared fields into components/accounts/account-form-fields.tsx,
// same pattern as components/movements/movement-form-fields.tsx.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { accountSchema } from "@/lib/schemas/accounts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createAccount } from "@/lib/services/accounts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

export default function CreateAccountForm() {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", color: "#000000", is_primary: false },
  });

  const onSubmit = async (data: z.infer<typeof accountSchema>) => {
    await createAccount(data);
    revalidateMyDataAndRedirect("/protected/accounts");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex gap-2 w-full">
            <Input
              id="color"
              type="color"
              {...register("color")}
              className="w-20 p-0"
            />
            <Input
              id="color"
              disabled
              value={getValues("color") || "#000000"}
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
          name="is_primary"
          render={({ field }) => (
            <Checkbox
              id="is_primary"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="is_primary">Cuenta principal</Label>
          <p className="text-sm text-muted-foreground">
            Queda preseleccionada al filtrar movimientos y al cargar uno nuevo.
            Podés marcar más de una: se usa la primera por orden alfabético.
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
