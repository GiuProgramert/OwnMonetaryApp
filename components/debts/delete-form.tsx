"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/dashboard/format";
import { DebtStatus, debtKindOptions } from "@/lib/schemas/debts";
import { deleteDebt } from "@/lib/services/debts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: DebtStatus;
}

export default function DeleteDebtForm({ initialValues }: Props) {
  const router = useRouter();

  const kindLabel = debtKindOptions.find(
    (option) => option.value === initialValues.kind
  )?.label;

  const onSubmit = async () => {
    try {
      await deleteDebt(initialValues.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar la deuda"
      );
      return;
    }

    await revalidateMyDataAndRedirect("/protected/debts");
  };

  return (
    <div className="flex flex-col gap-4">
      <p>¿Estás seguro de que deseas eliminar la siguiente deuda?</p>
      <div className="rounded-md border p-4 text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Nombre: </span>
          {initialValues.name}
        </p>
        <p>
          <span className="text-muted-foreground">Tipo: </span>
          {kindLabel}
        </p>
        <p>
          <span className="text-muted-foreground">Pagado: </span>
          {formatCurrency(initialValues.paid_amount)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Los {initialValues.payments_count} pagos registrados quedan como
        movimientos sin deuda asociada; el saldo de las cuentas no cambia.
      </p>
      <div className="flex gap-2">
        <Button onClick={onSubmit}>Eliminar</Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
