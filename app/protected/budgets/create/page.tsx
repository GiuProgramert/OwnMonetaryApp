import CreateBudgetForm from "@/components/budgets/create-form";
import FormContainer from "@/components/form-container";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function CreateBudgetPage() {
  const movementTypes = await getMovementTypes();

  return (
    <FormContainer title="Crear un nuevo presupuesto" href="/protected/budgets">
      <CreateBudgetForm movementTypes={movementTypes} />
    </FormContainer>
  );
}
