import EditAccountForm from "@/components/accounts/edit.form";
import FormContainer from "@/components/form-container";
import { getAccountById } from "@/lib/services/accounts";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccountById(id);

  return (
    <FormContainer
      title="Editar cuenta"
      href="/protected/accounts"
    >
      <EditAccountForm initialValues={account} />
    </FormContainer>
  );
}
