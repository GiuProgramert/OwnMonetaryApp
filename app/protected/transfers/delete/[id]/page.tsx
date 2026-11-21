import DeleteTransferForm from "@/components/transfers/delete-form";
import FormContainer from "@/components/form-container";
import { getTransferById } from "@/lib/services/transfers";
import { notFound } from "next/navigation";
import { resolveReturnTo } from "@/lib/return-to";

export default async function DeleteTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = resolveReturnTo(rawReturnTo, "/protected/movements");
  const transfer = await getTransferById(id);

  if (!transfer) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar transferencia" href={returnTo}>
      <DeleteTransferForm initialValues={transfer} returnTo={returnTo} />
    </FormContainer>
  );
}
