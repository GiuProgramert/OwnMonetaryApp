import EditBudgetForm from "@/components/budgets/edit-form";
import FormContainer from "@/components/form-container";
import { getBudgetById } from "@/lib/services/budgets";
import { getMovementTypes } from "@/lib/services/movement-types";
import { notFound } from "next/navigation";

export default async function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [budget, movementTypes] = await Promise.all([
    getBudgetById(id),
    getMovementTypes(),
  ]);

  if (!budget) {
    notFound();
  }

  return (
    <FormContainer title="Editar presupuesto" href="/protected/budgets">
      <EditBudgetForm initialValues={budget} movementTypes={movementTypes} />
    </FormContainer>
  );
}
