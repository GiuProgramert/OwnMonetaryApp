import DeleteAccountForm from "@/components/accounts/delete-form";
import FormContainer from "@/components/form-container";
import { getAccountById } from "@/lib/services/accounts";
import { notFound } from "next/navigation";

export default async function DeleteAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccountById(id);

  if (!account) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar cuenta" href="/protected/accounts">
      <DeleteAccountForm initialValues={account} />
    </FormContainer>
  );
}
