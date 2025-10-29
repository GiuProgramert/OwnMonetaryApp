import EditMovementTypeForm from "@/components/movement-types/edit-form";
import FormContainer from "@/components/form-container";
import { getMovementTypeById } from "@/lib/services/movement-types";
import { notFound } from "next/navigation";

export default async function EditMovementTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movementType = await getMovementTypeById(id);

  if (!movementType) {
    notFound();
  }

  return (
    <FormContainer
      title="Editar tipos de movimiento"
      href="/protected/movement-types"
    >
      <EditMovementTypeForm initialValues={movementType} />
    </FormContainer>
  );
}
