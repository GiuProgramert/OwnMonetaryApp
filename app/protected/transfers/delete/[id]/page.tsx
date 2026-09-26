import DeleteTransferForm from "@/components/transfers/delete-form";
import FormContainer from "@/components/form-container";
import { getTransferById } from "@/lib/services/transfers";
import { notFound } from "next/navigation";

export default async function DeleteTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transfer = await getTransferById(id);

  if (!transfer) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar transferencia" href="/protected/movements">
      <DeleteTransferForm initialValues={transfer} />
    </FormContainer>
  );
}
