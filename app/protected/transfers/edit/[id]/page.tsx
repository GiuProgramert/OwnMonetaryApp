import EditTransferForm from "@/components/transfers/edit-form";
import FormContainer from "@/components/form-container";
import { getTransferById } from "@/lib/services/transfers";
import { getAccounts } from "@/lib/services/accounts";
import { notFound } from "next/navigation";
import { resolveReturnTo } from "@/lib/return-to";

export default async function EditTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = resolveReturnTo(rawReturnTo, "/protected/movements");
  const [transfer, accounts] = await Promise.all([
    getTransferById(id),
    getAccounts(),
  ]);

  if (!transfer) {
    notFound();
  }

  return (
    <FormContainer title="Editar transferencia" href={returnTo}>
      <EditTransferForm initialValues={transfer} returnTo={returnTo} accounts={accounts} />
    </FormContainer>
  );
}
