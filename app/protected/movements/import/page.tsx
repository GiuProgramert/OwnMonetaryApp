import ImportWizard from "@/components/movements/import/import-wizard";
import FormContainer from "@/components/form-container";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function ImportMovementsPage() {
  const [accounts, movementTypes] = await Promise.all([
    getAccounts(),
    getMovementTypes(),
  ]);

  return (
    <FormContainer title="Importar movimientos" href="/protected/movements">
      <ImportWizard accounts={accounts} movementTypes={movementTypes} />
    </FormContainer>
  );
}
