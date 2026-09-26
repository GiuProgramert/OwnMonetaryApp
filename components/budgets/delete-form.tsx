"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Budget } from "@/lib/schemas/budgets";
import { deleteBudget } from "@/lib/services/budgets.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: Budget;
}

export default function DeleteBudgetForm({ initialValues }: Props) {
  const router = useRouter();

  const onSubmit = async () => {
    await deleteBudget(initialValues.id);
    await revalidateMyDataAndRedirect("/protected/budgets");
  };

  return (
    <div className="flex flex-col gap-2">
      <span>
        ¿Está seguro que quiere eliminar el presupuesto de &quot;
        {initialValues.movement_types.name}&quot;?
      </span>
      <span className="text-sm text-muted-foreground">
        El borrado se lleva <strong>todo el histórico</strong> mensual de este
        presupuesto y no se puede deshacer. Si solo querés dejar de usarlo sin
        perder el histórico, pausalo desde la edición.
      </span>
      <div className="flex gap-2">
        <Button onClick={onSubmit}>Eliminar</Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
