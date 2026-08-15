"use client";

import { Button } from "@/components/ui/button";
import { Movement } from "@/lib/schemas/movements";
import { deleteMovement } from "@/lib/services/movements.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function DeleteMovementForm({
  initialValues,
}: {
  initialValues: Movement;
}) {
  const router = useRouter();

  const onSubmit = async () => {
    try {
      await deleteMovement(initialValues.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el movimiento"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/movements");
  };

  return (
    <div className="flex flex-col gap-4">
      <p>¿Estás seguro de que deseas eliminar el siguiente movimiento?</p>
      <div className="rounded-md border p-4 text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Descripción: </span>
          {initialValues.description}
        </p>
        <p>
          <span className="text-muted-foreground">Monto: </span>
          Gs. {initialValues.amount.toLocaleString("es-PY")}
        </p>
        <p>
          <span className="text-muted-foreground">Cuenta: </span>
          {initialValues.accounts.name}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" onClick={onSubmit}>
          Eliminar
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
