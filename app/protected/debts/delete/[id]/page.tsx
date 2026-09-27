import DeleteDebtForm from "@/components/debts/delete-form";
import FormContainer from "@/components/form-container";
import { getDebtById } from "@/lib/services/debts";
import { notFound } from "next/navigation";

export default async function DeleteDebtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debt = await getDebtById(id);

  if (!debt) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar deuda" href="/protected/debts">
      <DeleteDebtForm initialValues={debt} />
    </FormContainer>
  );
}
