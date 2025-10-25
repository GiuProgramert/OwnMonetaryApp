import EditMovementTypeForm from "@/components/movement-type/edit-form";
import FormContainer from "@/components/form-container";
import { getMovementTypeById } from "@/lib/services/movement-types";

export default async function EditMovementTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movementType = await getMovementTypeById(id);

  return (
    <FormContainer title="Editar tipos de movimiento">
      <EditMovementTypeForm initialValues={movementType} />
    </FormContainer>
  );
}
