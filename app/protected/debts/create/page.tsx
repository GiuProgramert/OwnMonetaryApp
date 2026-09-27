import CreateDebtForm from "@/components/debts/create-form";
import FormContainer from "@/components/form-container";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function CreateDebtPage() {
  const movementTypes = await getMovementTypes();

  return (
    <FormContainer title="Crear una nueva deuda" href="/protected/debts">
      <CreateDebtForm movementTypes={movementTypes} />
    </FormContainer>
  );
}
