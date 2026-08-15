import CreateMovementForm from "@/components/movements/create-form";
import FormContainer from "@/components/form-container";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function CreateMovementPage() {
  const [accounts, movementTypes] = await Promise.all([
    getAccounts(),
    getMovementTypes(),
  ]);

  return (
    <FormContainer title="Crear un nuevo movimiento" href="/protected/movements">
      <CreateMovementForm accounts={accounts} movementTypes={movementTypes} />
    </FormContainer>
  );
}
