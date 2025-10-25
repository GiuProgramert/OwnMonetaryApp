import FormContainer from "@/components/form-container";
import CreateMovementTypeForm from "@/components/movement-type/create-form";

export default function CreateMovementTypePage() {
  return (
    <FormContainer title="Crear un nuevo tipo de movimiento">
      <CreateMovementTypeForm />
    </FormContainer>
  );
}
