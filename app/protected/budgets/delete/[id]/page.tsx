import DeleteBudgetForm from "@/components/budgets/delete-form";
import FormContainer from "@/components/form-container";
import { getBudgetById } from "@/lib/services/budgets";
import { notFound } from "next/navigation";

export default async function DeleteBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = await getBudgetById(id);

  if (!budget) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar presupuesto" href="/protected/budgets">
      <DeleteBudgetForm initialValues={budget} />
    </FormContainer>
  );
}
