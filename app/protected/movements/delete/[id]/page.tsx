import DeleteMovementForm from "@/components/movements/delete-form";
import FormContainer from "@/components/form-container";
import { getMovementById } from "@/lib/services/movements";
import { notFound } from "next/navigation";

export default async function DeleteMovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movement = await getMovementById(id);

  if (!movement) {
    notFound();
  }

  return (
    <FormContainer title="Eliminar movimiento" href="/protected/movements">
      <DeleteMovementForm initialValues={movement} />
    </FormContainer>
  );
}
