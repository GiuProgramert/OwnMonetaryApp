import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import DebtMovementsTable from "@/components/debts/debt-movements-table";
import DebtSummary from "@/components/debts/debt-summary";
import FinishButton from "@/components/debts/finish-button";
import FormContainer from "@/components/form-container";
import { Button } from "@/components/ui/button";
import { getDebtById } from "@/lib/services/debts";
import { getMovementsByDebt } from "@/lib/services/movements";

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debt = await getDebtById(id);

  if (!debt) {
    notFound();
  }

  const movements = await getMovementsByDebt(id);

  return (
    <FormContainer title={debt.name} href="/protected/debts" wide>
      <div className="space-y-6">
        <DebtSummary debt={debt} />

        <div className="flex flex-wrap gap-2">
          {!debt.finished && (
            <Button asChild>
              <Link href={`/protected/debts/${id}/pay`}>Pagar</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/protected/debts/edit/${id}`}>
              <Pencil />
              <span>Editar</span>
            </Link>
          </Button>
          <FinishButton debt={debt} />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Pagos</h2>
          <DebtMovementsTable movements={movements} />
        </div>
      </div>
    </FormContainer>
  );
}
