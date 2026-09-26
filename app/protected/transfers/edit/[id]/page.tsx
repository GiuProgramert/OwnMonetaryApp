import EditTransferForm from "@/components/transfers/edit-form";
import FormContainer from "@/components/form-container";
import { getTransferById } from "@/lib/services/transfers";
import { getAccounts } from "@/lib/services/accounts";
import { notFound } from "next/navigation";

export default async function EditTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transfer, accounts] = await Promise.all([
    getTransferById(id),
    getAccounts(),
  ]);

  if (!transfer) {
    notFound();
  }

  return (
    <FormContainer title="Editar transferencia" href="/protected/movements">
      <EditTransferForm initialValues={transfer} accounts={accounts} />
    </FormContainer>
  );
}
