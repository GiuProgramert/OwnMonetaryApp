import CreateAccountForm from "@/components/accounts/create-form";
import FormContainer from "@/components/form-container";

export default function CreateAccountPage() {
  return (
    <FormContainer title="Crear una nueva cuenta" href="/protected/accounts">
      <CreateAccountForm />
    </FormContainer>
  );
}
