import EditMovementForm from "@/components/movements/edit-form";
import FormContainer from "@/components/form-container";
import { getMovementById } from "@/lib/services/movements";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";
import { notFound } from "next/navigation";

export default async function EditMovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [movement, accounts, movementTypes] = await Promise.all([
    getMovementById(id),
    getAccounts(),
    getMovementTypes(),
  ]);

  if (!movement) {
    notFound();
  }

  return (
    <FormContainer title="Editar movimiento" href="/protected/movements">
      <EditMovementForm
        initialValues={movement}
        accounts={accounts}
        movementTypes={movementTypes}
      />
    </FormContainer>
  );
}
