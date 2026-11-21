import EditMovementForm from "@/components/movements/edit-form";
import FormContainer from "@/components/form-container";
import { getMovementById } from "@/lib/services/movements";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";
import { notFound, redirect } from "next/navigation";
import { resolveReturnTo, withReturnTo } from "@/lib/return-to";

export default async function EditMovementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = resolveReturnTo(rawReturnTo, "/protected/movements");
  const [movement, accounts, movementTypes] = await Promise.all([
    getMovementById(id),
    getAccounts(),
    getMovementTypes(),
  ]);

  if (!movement) {
    notFound();
  }

  if (movement.transfer_id) {
    redirect(
      withReturnTo(`/protected/transfers/edit/${movement.transfer_id}`, returnTo)
    );
  }

  return (
    <FormContainer title="Editar movimiento" href={returnTo}>
      <EditMovementForm
        initialValues={movement}
        accounts={accounts}
        movementTypes={movementTypes}
        returnTo={returnTo}
      />
    </FormContainer>
  );
}
