import DeleteMovementTypeForm from "@/components/movement-type/delete-form";
import FormContainer from "@/components/form-container";
import { getMovementTypeById } from "@/lib/services/movement-types";

export default async function DeleteMovementTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movementType = await getMovementTypeById(id);

  return (
    <FormContainer title="Eliminar el tipo de movimiento">
      <DeleteMovementTypeForm initialValues={movementType} />
    </FormContainer>
  );
}
