"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DebtStatus } from "@/lib/schemas/debts";
import { setDebtFinished } from "@/lib/services/debts.client";
import { revalidatePathServer } from "@/lib/services/revalidate";

interface Props {
  debt: DebtStatus;
}

export default function FinishButton({ debt }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // En cuotas finalizada por cuotas (no por is_finished), reabrir no tiene efecto:
  // la fórmula de get_debts_status la sigue dando por finalizada.
  const finishedByInstallments =
    debt.finished && !debt.is_finished && debt.kind === "installments";

  if (finishedByInstallments) {
    return null;
  }

  const onClick = async () => {
    setIsPending(true);

    try {
      await setDebtFinished(debt.id, !debt.is_finished);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo actualizar la deuda"
      );
      setIsPending(false);
      return;
    }

    await revalidatePathServer(`/protected/debts/${debt.id}`);
    router.refresh();
    setIsPending(false);
  };

  return (
    <Button variant="outline" onClick={onClick} disabled={isPending}>
      {debt.is_finished ? "Reabrir" : "Marcar como finalizada"}
    </Button>
  );
}
