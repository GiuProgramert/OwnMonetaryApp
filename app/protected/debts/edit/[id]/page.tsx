import EditDebtForm from "@/components/debts/edit-form";
import FormContainer from "@/components/form-container";
import { resolveReturnTo } from "@/lib/return-to";
import { getDebtById } from "@/lib/services/debts";
import { getMovementTypes } from "@/lib/services/movement-types";
import { notFound } from "next/navigation";

export default async function EditDebtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const returnTo = resolveReturnTo((await searchParams).returnTo, `/protected/debts/${id}`);
  const [debt, movementTypes] = await Promise.all([
    getDebtById(id),
    getMovementTypes(),
  ]);

  if (!debt) {
    notFound();
  }

  return (
    <FormContainer title="Editar deuda" href={returnTo}>
      <EditDebtForm
        initialValues={debt}
        movementTypes={movementTypes}
        returnTo={returnTo}
      />
    </FormContainer>
  );
}
